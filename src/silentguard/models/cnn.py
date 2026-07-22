"""Deep models on the raw multi-channel waveform window. Build-order step 6.

Two architectures:
  * Conv1DNet          — a small 1-D CNN over the last ~16 s of waveform.
  * AttentionCNNLSTM   — CNN front-end -> BiLSTM -> temporal attention; the attention
                         weights are exposed for explainability (C3).

Channel handling (channels vary per record): we build a fixed 3-channel tensor
  [primary ECG, secondary ECG, pulse (ABP/PLETH)]; missing channels are zero-filled,
which is itself a learnable "this channel is absent" signal.

Evaluation mirrors the classical baseline exactly (same 5-fold CV, same challenge score,
same leak-free threshold rule) so deep and RF/XGB numbers are directly comparable. The
KEEP/SUPPRESS threshold is chosen on a held-out validation split of each training fold
(never on the test fold) — the deep analogue of the baseline's inner-CV OOF selection.

torch is imported lazily so the rest of the package works without it installed.
"""
from __future__ import annotations
import numpy as np

from ..config import resolve
from ..evaluation.metrics import challenge_score, full_metrics
from .baseline import select_threshold


# ----------------------------------------------------------------------------------
# Waveform tensor construction
# ----------------------------------------------------------------------------------
def build_waveform_tensor(cfg: dict, rebuild: bool = False):
    """Load every training record into a fixed [N, 3, T] float32 tensor (cached to npz).

    Channels: 0 = primary ECG, 1 = secondary ECG lead (or zeros), 2 = pulse ABP/PLETH
    (or zeros). Each channel is preprocessed and normalized; the window is the last
    ``signal.window_seconds`` ending at the alarm.

    Returns (X [N,3,T] float32, y [N] int, groups [N] str, record_ids [N] str).
    """
    from ..data.io import load_challenge2015_record, list_challenge2015_records
    from ..preprocessing.filters import preprocess_ecg, remove_baseline_wander, normalize

    fs = int(cfg["signal"]["fs"])
    win_s = float(cfg["signal"]["window_seconds"])
    band = cfg["signal"].get("bandpass_hz", [0.5, 40])
    low, high = float(band[0]), float(band[1])
    T = int(round(win_s * fs))

    cache = resolve(cfg["paths"]["interim"]) / f"challenge2015_waveforms_{int(win_s)}s.npz"
    if cache.exists() and not rebuild:
        d = np.load(cache, allow_pickle=True)
        return d["X"].astype(np.float32), d["y"].astype(int), d["groups"], d["ids"]

    training_dir = resolve(cfg["paths"]["challenge_2015"]) / "training"
    stems = list_challenge2015_records(training_dir)

    CLIP = 8.0  # robust normalization can explode on near-flat signals; clip to a sane z-range

    def _fix_len(a: np.ndarray) -> np.ndarray:
        a = np.nan_to_num(np.clip(np.asarray(a, dtype=np.float32), -CLIP, CLIP))
        if len(a) >= T:
            return a[-T:]
        return np.pad(a, (T - len(a), 0))  # left-pad short signals with zeros

    X, y, groups, ids = [], [], [], []
    for stem in stems:
        try:
            rec = load_challenge2015_record(stem)
            if rec.label is None:
                continue
            chans = np.zeros((3, T), dtype=np.float32)
            leads = rec.ecg_leads()
            if leads:
                ecg1 = preprocess_ecg(rec.window(win_s, rec.signals[leads[0]]), fs, low, high)
                chans[0] = _fix_len(ecg1)
            if len(leads) >= 2:
                ecg2 = preprocess_ecg(rec.window(win_s, rec.signals[leads[1]]), fs, low, high)
                chans[1] = _fix_len(ecg2)
            pulse = rec.pulse_channel()
            if pulse is not None:
                psig = normalize(remove_baseline_wander(rec.window(win_s, pulse[1]), fs))
                chans[2] = _fix_len(psig)
            X.append(chans)
            y.append(int(rec.label))
            groups.append(rec.arrhythmia)
            ids.append(rec.record_id)
        except Exception as e:  # never let one bad record kill the build
            print(f"  [warn] {stem}: {e}")

    X = np.asarray(X, dtype=np.float32)
    y = np.asarray(y, dtype=int)
    groups = np.asarray(groups)
    ids = np.asarray(ids)
    cache.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(cache, X=X, y=y, groups=groups, ids=ids)
    return X, y, groups, ids


# ----------------------------------------------------------------------------------
# Architectures (defined lazily so importing this module needs no torch)
# ----------------------------------------------------------------------------------
def _build_modules():
    import torch
    import torch.nn as nn

    class Conv1DNet(nn.Module):
        """Small 1-D CNN: 4 conv blocks + global average pool + MLP head."""

        def __init__(self, in_ch: int = 3, n_classes: int = 2, p_drop: float = 0.3):
            super().__init__()
            def block(ci, co, k, pool):
                return nn.Sequential(
                    nn.Conv1d(ci, co, k, padding=k // 2), nn.BatchNorm1d(co),
                    nn.ReLU(), nn.MaxPool1d(pool),
                )
            self.features = nn.Sequential(
                block(in_ch, 16, 7, 4),
                block(16, 32, 5, 4),
                block(32, 64, 3, 4),
                block(64, 64, 3, 2),
            )
            self.pool = nn.AdaptiveAvgPool1d(1)
            self.head = nn.Sequential(
                nn.Flatten(), nn.Linear(64, 32), nn.ReLU(),
                nn.Dropout(p_drop), nn.Linear(32, n_classes),
            )

        def forward(self, x, return_attn: bool = False):
            z = self.pool(self.features(x))
            logits = self.head(z)
            if return_attn:
                return logits, None
            return logits

    class AttentionCNNLSTM(nn.Module):
        """CNN front-end -> BiLSTM -> additive temporal attention -> classifier.

        forward(x, return_attn=True) also returns the per-timestep attention weights,
        aligned to the pooled CNN sequence, for explainability.
        """

        def __init__(self, in_ch: int = 3, n_classes: int = 2, hidden: int = 64, p_drop: float = 0.3):
            super().__init__()
            def block(ci, co, k, pool):
                return nn.Sequential(
                    nn.Conv1d(ci, co, k, padding=k // 2), nn.BatchNorm1d(co),
                    nn.ReLU(), nn.MaxPool1d(pool),
                )
            self.features = nn.Sequential(
                block(in_ch, 16, 7, 4),
                block(16, 32, 5, 4),
                block(32, 64, 3, 2),
            )
            self.lstm = nn.LSTM(64, hidden, batch_first=True, bidirectional=True)
            self.attn = nn.Linear(2 * hidden, 1)
            self.head = nn.Sequential(
                nn.Dropout(p_drop), nn.Linear(2 * hidden, n_classes),
            )

        def forward(self, x, return_attn: bool = False):
            z = self.features(x)                 # (B, C, T')
            z = z.transpose(1, 2)                # (B, T', C)
            h, _ = self.lstm(z)                  # (B, T', 2H)
            scores = self.attn(h).squeeze(-1)    # (B, T')
            weights = torch.softmax(scores, dim=1)                # (B, T')
            context = torch.sum(weights.unsqueeze(-1) * h, dim=1)  # (B, 2H)
            logits = self.head(context)
            if return_attn:
                return logits, weights
            return logits

    return Conv1DNet, AttentionCNNLSTM


def make_model(arch: str, in_ch: int = 3):
    Conv1DNet, AttentionCNNLSTM = _build_modules()
    if arch == "cnn":
        return Conv1DNet(in_ch=in_ch)
    if arch == "attn":
        return AttentionCNNLSTM(in_ch=in_ch)
    raise ValueError(f"unknown arch {arch!r} (expected 'cnn' or 'attn')")


# ----------------------------------------------------------------------------------
# Training / inference
# ----------------------------------------------------------------------------------
def _seed_everything(seed: int):
    import torch
    np.random.seed(seed)
    torch.manual_seed(seed)


def _class_weights(y, device):
    import torch
    y = np.asarray(y)
    n = len(y)
    w = np.array([n / (2 * max(1, np.sum(y == 0))), n / (2 * max(1, np.sum(y == 1)))], dtype=np.float32)
    return torch.tensor(w, device=device)


def train_deep(X_tr, y_tr, X_val, y_val, cfg, arch="cnn", max_epochs=40, patience=8,
               batch_size=64, lr=1e-3, verbose=False):
    """Train a deep model with balanced-class-weighted CE and early stopping on val loss.

    Returns (model, best_val_ptrue) where best_val_ptrue is P(true) on the validation set
    at the best epoch (used for leak-free threshold selection).
    """
    import torch
    from torch.utils.data import TensorDataset, DataLoader

    seed = int(cfg.get("eval", {}).get("random_seed", 42))
    _seed_everything(seed)
    device = torch.device("cpu")

    model = make_model(arch, in_ch=X_tr.shape[1]).to(device)
    opt = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)
    loss_fn = torch.nn.CrossEntropyLoss(weight=_class_weights(y_tr, device))

    tr_ds = TensorDataset(torch.tensor(X_tr, dtype=torch.float32),
                          torch.tensor(y_tr, dtype=torch.long))
    tr_dl = DataLoader(tr_ds, batch_size=batch_size, shuffle=True)
    Xv = torch.tensor(X_val, dtype=torch.float32)
    yv = torch.tensor(y_val, dtype=torch.long)

    best_loss, best_state, best_val_p, wait = np.inf, None, None, 0
    for epoch in range(max_epochs):
        model.train()
        for xb, yb in tr_dl:
            opt.zero_grad()
            loss = loss_fn(model(xb), yb)
            loss.backward()
            opt.step()
        model.eval()
        with torch.no_grad():
            vlogits = model(Xv)
            vloss = loss_fn(vlogits, yv).item()
            vp = torch.softmax(vlogits, dim=1)[:, 1].numpy()
        if vloss < best_loss - 1e-4:
            best_loss = vloss
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
            best_val_p, wait = vp, 0
        else:
            wait += 1
            if wait >= patience:
                break
        if verbose:
            print(f"    epoch {epoch:2d} val_loss={vloss:.4f}")
    if best_state is not None:
        model.load_state_dict(best_state)
    return model, best_val_p


def predict_proba_deep(model, X, batch_size=128):
    """Return P(true alarm) for each row of X."""
    import torch
    from torch.utils.data import TensorDataset, DataLoader
    model.eval()
    dl = DataLoader(TensorDataset(torch.tensor(X, dtype=torch.float32)),
                    batch_size=batch_size, shuffle=False)
    out = []
    with torch.no_grad():
        for (xb,) in dl:
            out.append(torch.softmax(model(xb), dim=1)[:, 1].numpy())
    return np.concatenate(out)


def attention_weights(model, x_row):
    """Return per-timestep attention weights for one sample (AttentionCNNLSTM only)."""
    import torch
    model.eval()
    with torch.no_grad():
        _, w = model(torch.tensor(x_row[None, ...], dtype=torch.float32), return_attn=True)
    return None if w is None else w.squeeze(0).numpy()


# ----------------------------------------------------------------------------------
# Evaluation (mirrors baseline.cross_validate / domain.leave_one_arrhythmia_out)
# ----------------------------------------------------------------------------------
def _val_split(y_tr, seed, val_frac=0.2):
    """Stratified index split of a training fold into (fit, val)."""
    from sklearn.model_selection import train_test_split
    idx = np.arange(len(y_tr))
    fit_idx, val_idx = train_test_split(idx, test_size=val_frac, random_state=seed, stratify=y_tr)
    return fit_idx, val_idx


def cross_validate_deep(X, y, cfg, arch="cnn", groups=None):
    """5-fold stratified CV for a deep model. Same return shape as baseline.cross_validate."""
    from sklearn.model_selection import StratifiedKFold
    X = np.asarray(X, dtype=np.float32)
    y = np.asarray(y).astype(int)
    n_folds = int(cfg["eval"]["cv_folds"]); seed = int(cfg["eval"]["random_seed"])
    fn_penalty = int(cfg["eval"]["fn_penalty"])
    skf = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=seed)

    oof_proba = np.full(len(y), np.nan)
    oof_keep = np.zeros(len(y), dtype=int)
    thrs = []
    for tr, te in skf.split(X, y):
        fit_i, val_i = _val_split(y[tr], seed)
        model, val_p = train_deep(X[tr][fit_i], y[tr][fit_i], X[tr][val_i], y[tr][val_i], cfg, arch)
        thr = select_threshold(y[tr][val_i], val_p, fn_penalty)
        thrs.append(thr)
        p = predict_proba_deep(model, X[te])
        oof_proba[te] = p
        oof_keep[te] = (p >= thr).astype(int)

    metrics = _agg_metrics(y, oof_proba, oof_keep, float(np.mean(thrs)), fn_penalty)
    out = {"model": f"deep-{arch}", "metrics": metrics, "oof_proba": oof_proba,
           "oof_keep": oof_keep, "fold_thresholds": thrs, "mean_threshold": float(np.mean(thrs))}
    if groups is not None:
        out["per_arrhythmia"] = _per_group(np.asarray(groups), y, oof_keep, oof_proba, fn_penalty)
    return out


def leave_one_arrhythmia_out_deep(X, y, groups, cfg, arch="cnn"):
    """LOAO for a deep model. Same return shape as domain.leave_one_arrhythmia_out."""
    X = np.asarray(X, dtype=np.float32); y = np.asarray(y).astype(int); groups = np.asarray(groups)
    seed = int(cfg["eval"]["random_seed"]); fn_penalty = int(cfg["eval"]["fn_penalty"])
    codes = [c for c in ("ASYSTOLE", "BRADY", "TACHY", "VTACH", "VFIB") if c in set(groups)]

    per_group, pooled_keep, pooled_proba = {}, np.zeros(len(y), int), np.full(len(y), np.nan)
    for g in codes:
        te = groups == g; tr = ~te
        if te.sum() == 0 or tr.sum() == 0:
            continue
        fit_i, val_i = _val_split(y[tr], seed)
        Xtr = X[tr]; ytr = y[tr]
        model, val_p = train_deep(Xtr[fit_i], ytr[fit_i], Xtr[val_i], ytr[val_i], cfg, arch)
        thr = select_threshold(ytr[val_i], val_p, fn_penalty)  # training types only
        p = predict_proba_deep(model, X[te])
        keep = (p >= thr).astype(int)
        pooled_keep[te] = keep; pooled_proba[te] = p
        m = full_metrics(y[te], p, threshold=thr, fn_penalty=fn_penalty)
        m["challenge_score"] = challenge_score(y[te], keep, fn_penalty)
        m["n_true"] = int(np.sum(y[te] == 1)); m["n_false"] = int(np.sum(y[te] == 0))
        m["threshold"] = float(thr)
        per_group[str(g)] = m

    pooled = _agg_metrics(y, pooled_proba, pooled_keep, 0.5, fn_penalty)
    return {"per_group": per_group, "pooled": pooled, "order": codes,
            "pooled_keep": pooled_keep, "pooled_proba": pooled_proba}


def _agg_metrics(y, proba, keep, mean_thr, fn_penalty):
    m = full_metrics(y, proba, threshold=mean_thr, fn_penalty=fn_penalty)
    tp = int(np.sum((y == 1) & (keep == 1))); tn = int(np.sum((y == 0) & (keep == 0)))
    fp = int(np.sum((y == 0) & (keep == 1))); fn = int(np.sum((y == 1) & (keep == 0)))
    m["challenge_score"] = challenge_score(y, keep, fn_penalty)
    m["sensitivity"] = tp / (tp + fn) if (tp + fn) else float("nan")
    m["specificity"] = tn / (tn + fp) if (tn + fp) else float("nan")
    m["ppv"] = tp / (tp + fp) if (tp + fp) else float("nan")
    m.update({"tp": tp, "tn": tn, "fp": fp, "fn": fn})
    return m


def _per_group(groups, y, keep, proba, fn_penalty):
    per = {}
    for code in np.unique(groups):
        mask = groups == code
        yk, kk, pk = y[mask], keep[mask], proba[mask]
        tpt = int(np.sum((yk == 1) & (kk == 1))); fnt = int(np.sum((yk == 1) & (kk == 0)))
        auc = float("nan")
        if len(np.unique(yk)) == 2:
            try:
                from sklearn.metrics import roc_auc_score
                auc = float(roc_auc_score(yk, pk))
            except Exception:
                auc = float("nan")
        per[str(code)] = {"n": int(mask.sum()), "n_true": int(np.sum(yk == 1)),
                          "n_false": int(np.sum(yk == 0)),
                          "challenge_score": challenge_score(yk, kk, fn_penalty),
                          "sensitivity": tpt / (tpt + fnt) if (tpt + fnt) else float("nan"),
                          "auroc": auc}
    return per
