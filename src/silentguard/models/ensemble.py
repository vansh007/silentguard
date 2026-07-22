"""The FINAL engine: a frozen RF + CNN equal-weight ensemble, plus its leak-free evaluation.

Why an ensemble: the handcrafted-feature RandomForest and the raw-waveform 1-D CNN are
complementary; averaging their P(true) probabilities beats either alone (higher AUROC,
more false-alarm suppression at the >=99% true-alarm sensitivity floor).

Leak-free, SAME-PROTOCOL evaluation (joint_cross_validate / joint_loao): within every
fold (or every held-out arrhythmia) both models are trained on a fit split, their KEEP
threshold is chosen on a *validation* split held out from training, and only then are they
scored on the untouched test fold. RF, CNN, and the ensemble all use this identical
protocol, so their challenge scores are directly comparable and none is tuned on the data
it is scored on.

Freezing (fit_final_ensemble + FrozenEnsemble): trains RF and CNN on all 750 records,
stores the safety thresholds calibrated on the leak-free out-of-fold ensemble probabilities,
and serializes everything so the product can load and call one entry point (predict_one)
without retraining.
"""
from __future__ import annotations
from pathlib import Path
import json
import numpy as np

from ..config import resolve
from ..evaluation.metrics import challenge_score, full_metrics
from .baseline import build_model, select_threshold
from .cnn import (make_model, train_deep, predict_proba_deep, record_to_channels,
                  _val_split, _agg_metrics, _per_group)
from . import safety
from ..explain.explain import explain_features

W_RF = 0.5   # equal-weight ensemble (no tuning)
W_CNN = 0.5
ARCH = "cnn"


# ----------------------------------------------------------------------------------
# Leak-free, same-protocol evaluation
# ----------------------------------------------------------------------------------
def _fit_fold(Xf_fit, Xw_fit, y_fit, Xf_val, Xw_val, y_val, cfg):
    """Train RF + CNN on the fit split; return (rf, cnn_model, val_probs) for each model.

    val_probs is a dict {'rf','cnn','ens'} of P(true) on the validation split (used only
    to choose thresholds — never the test fold).
    """
    rf = build_model("rf", cfg).fit(Xf_fit, y_fit)
    rf_val = rf.predict_proba(Xf_val)[:, 1]
    cnn_model, cnn_val = train_deep(Xw_fit, y_fit, Xw_val, y_val, cfg, arch=ARCH)
    ens_val = W_RF * rf_val + W_CNN * cnn_val
    return rf, cnn_model, {"rf": rf_val, "cnn": cnn_val, "ens": ens_val}


def _fold_test_probs(rf, cnn_model, Xf_te, Xw_te):
    rf_te = rf.predict_proba(Xf_te)[:, 1]
    cnn_te = predict_proba_deep(cnn_model, Xw_te)
    return {"rf": rf_te, "cnn": cnn_te, "ens": W_RF * rf_te + W_CNN * cnn_te}


def joint_cross_validate(Xf, Xw, y, cfg, groups=None):
    """5-fold CV producing leak-free OOF probs for RF, CNN, and the ensemble (same protocol).

    Returns {'rf':res, 'cnn':res, 'ens':res} where each res has metrics, oof_proba,
    oof_keep, mean_threshold, and (if groups given) per_arrhythmia.
    """
    from sklearn.model_selection import StratifiedKFold
    Xf = np.asarray(Xf, float); Xw = np.asarray(Xw, np.float32); y = np.asarray(y).astype(int)
    seed = int(cfg["eval"]["random_seed"]); fn = int(cfg["eval"]["fn_penalty"])
    skf = StratifiedKFold(n_splits=int(cfg["eval"]["cv_folds"]), shuffle=True, random_state=seed)

    keys = ["rf", "cnn", "ens"]
    oof = {k: np.full(len(y), np.nan) for k in keys}
    keep = {k: np.zeros(len(y), int) for k in keys}
    thrs = {k: [] for k in keys}

    for tr, te in skf.split(Xf, y):
        fit_i, val_i = _val_split(y[tr], seed)
        rf, cnn_model, val_probs = _fit_fold(
            Xf[tr][fit_i], Xw[tr][fit_i], y[tr][fit_i],
            Xf[tr][val_i], Xw[tr][val_i], y[tr][val_i], cfg)
        test_probs = _fold_test_probs(rf, cnn_model, Xf[te], Xw[te])
        for k in keys:
            thr = select_threshold(y[tr][val_i], val_probs[k], fn)  # validation split only
            thrs[k].append(thr)
            oof[k][te] = test_probs[k]
            keep[k][te] = (test_probs[k] >= thr).astype(int)

    out = {}
    for k in keys:
        m = _agg_metrics(y, oof[k], keep[k], float(np.mean(thrs[k])), fn)
        res = {"model": k, "metrics": m, "oof_proba": oof[k], "oof_keep": keep[k],
               "mean_threshold": float(np.mean(thrs[k]))}
        if groups is not None:
            res["per_arrhythmia"] = _per_group(np.asarray(groups), y, keep[k], oof[k], fn)
        out[k] = res
    return out


def joint_loao(Xf, Xw, y, groups, cfg):
    """Leave-One-Arrhythmia-Out for RF, CNN, and ensemble (same leak-free protocol).

    Threshold for each held-out type is chosen on a validation split of the TRAINING types
    only — never the held-out type. Returns {'rf','cnn','ens'} each with per_group + pooled.
    """
    Xf = np.asarray(Xf, float); Xw = np.asarray(Xw, np.float32)
    y = np.asarray(y).astype(int); groups = np.asarray(groups)
    seed = int(cfg["eval"]["random_seed"]); fn = int(cfg["eval"]["fn_penalty"])
    codes = [c for c in ("ASYSTOLE", "BRADY", "TACHY", "VTACH", "VFIB") if c in set(groups)]

    keys = ["rf", "cnn", "ens"]
    per = {k: {} for k in keys}
    pooled_keep = {k: np.zeros(len(y), int) for k in keys}
    pooled_proba = {k: np.full(len(y), np.nan) for k in keys}

    for g in codes:
        te = groups == g; tr = ~te
        if te.sum() == 0 or tr.sum() == 0:
            continue
        fit_i, val_i = _val_split(y[tr], seed)
        Xf_tr, Xw_tr, y_tr = Xf[tr], Xw[tr], y[tr]
        rf, cnn_model, val_probs = _fit_fold(
            Xf_tr[fit_i], Xw_tr[fit_i], y_tr[fit_i],
            Xf_tr[val_i], Xw_tr[val_i], y_tr[val_i], cfg)
        test_probs = _fold_test_probs(rf, cnn_model, Xf[te], Xw[te])
        for k in keys:
            thr = select_threshold(y_tr[val_i], val_probs[k], fn)  # training types only
            p = test_probs[k]; keep = (p >= thr).astype(int)
            pooled_keep[k][te] = keep; pooled_proba[k][te] = p
            m = full_metrics(y[te], p, threshold=thr, fn_penalty=fn)
            m["challenge_score"] = challenge_score(y[te], keep, fn)
            m["n_true"] = int(np.sum(y[te] == 1)); m["n_false"] = int(np.sum(y[te] == 0))
            m["threshold"] = float(thr)
            per[k][str(g)] = m

    out = {}
    for k in keys:
        out[k] = {"per_group": per[k], "order": codes,
                  "pooled": _agg_metrics(y, pooled_proba[k], pooled_keep[k], 0.5, fn),
                  "pooled_proba": pooled_proba[k], "pooled_keep": pooled_keep[k]}
    return out


# ----------------------------------------------------------------------------------
# Frozen ensemble + product inference entry point
# ----------------------------------------------------------------------------------
class FrozenEnsemble:
    """A trained, serialized RF+CNN ensemble with a single product-facing entry point."""

    def __init__(self, rf, cnn_state, in_ch, feature_names, t_high, t_low, cfg, meta=None):
        self.rf = rf
        self.cnn_state = cnn_state
        self.in_ch = int(in_ch)
        self.feature_names = list(feature_names)
        self.t_high = float(t_high)
        self.t_low = float(t_low)
        self.cfg = cfg
        self.meta = meta or {}
        self._cnn = None  # lazily reconstructed torch module

    def _cnn_model(self):
        if self._cnn is None:
            import torch
            m = make_model(ARCH, in_ch=self.in_ch)
            m.load_state_dict(self.cnn_state)
            m.eval()
            self._cnn = m
        return self._cnn

    def _features_row(self, rec) -> np.ndarray:
        from ..features.waveform_features import extract_feature_vector
        feats = extract_feature_vector(rec, self.cfg)
        return np.array([feats.get(n, np.nan) for n in self.feature_names], dtype=float)

    def predict_proba_one(self, rec) -> float:
        """Ensemble P(true alarm) for one AlarmRecord."""
        x_feat = self._features_row(rec)[None, :]
        x_wave = record_to_channels(rec, self.cfg)[None, ...]
        p_rf = float(self.rf.predict_proba(x_feat)[0, 1])
        p_cnn = float(predict_proba_deep(self._cnn_model(), x_wave)[0])
        return W_RF * p_rf + W_CNN * p_cnn

    def predict_one(self, rec, max_wait_s: float = 30.0) -> dict:
        """The product entry point. Given one record, return the triage decision bundle.

        Returns {p_false, p_true, decision, confidence, reasons, latency_used_s, ...}.
        - decision: SUPPRESS / KEEP / DEFER from the calibrated safety thresholds.
        - confidence: how far the probability sits toward the decided class (0.5..1.0).
        - reasons: top signed SHAP feature contributions toward TRUE (negative => toward false).
        - latency_used_s: 0.0 for a confident real-time decision; max_wait_s if DEFER
          (routed to a human / would keep listening).
        """
        p_true = self.predict_proba_one(rec)
        p_false = 1.0 - p_true
        decision = safety.decide(p_false, self.t_high, self.t_low)
        confidence = float(max(p_true, p_false))
        x_feat = self._features_row(rec)
        try:
            reasons = explain_features(self.rf, x_feat, self.feature_names, k=5)
        except Exception:
            reasons = []
        latency = 0.0 if decision != safety.Decision.DEFER else float(max_wait_s)
        return {
            "record_id": getattr(rec, "record_id", None),
            "arrhythmia": getattr(rec, "arrhythmia", None),
            "p_true": p_true,
            "p_false": p_false,
            "decision": decision.value,
            "confidence": confidence,
            "reasons": [{"feature": n, "contribution_to_true": float(v)} for n, v in reasons],
            "latency_used_s": latency,
        }

    # --- serialization ---
    def save(self, out_dir: str | Path):
        import joblib, torch
        out_dir = Path(out_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        joblib.dump(self.rf, out_dir / "rf.joblib")
        torch.save(self.cnn_state, out_dir / "cnn.pt")
        meta = {"in_ch": self.in_ch, "feature_names": self.feature_names,
                "t_high": self.t_high, "t_low": self.t_low, "arch": ARCH,
                "w_rf": W_RF, "w_cnn": W_CNN,
                "window_seconds": self.cfg["signal"]["window_seconds"],
                "fs": self.cfg["signal"]["fs"], **self.meta}
        with open(out_dir / "ensemble_meta.json", "w") as f:
            json.dump(meta, f, indent=2)
        return out_dir

    @classmethod
    def load(cls, out_dir: str | Path, cfg: dict):
        import joblib, torch
        out_dir = Path(out_dir)
        rf = joblib.load(out_dir / "rf.joblib")
        cnn_state = torch.load(out_dir / "cnn.pt", map_location="cpu")
        with open(out_dir / "ensemble_meta.json") as f:
            meta = json.load(f)
        return cls(rf, cnn_state, meta["in_ch"], meta["feature_names"],
                   meta["t_high"], meta["t_low"], cfg, meta=meta)


def fit_final_ensemble(Xf, Xw, y, cfg, feature_names, t_high, t_low) -> FrozenEnsemble:
    """Train RF and CNN on ALL data and wrap them with the (pre-calibrated) safety thresholds."""
    Xf = np.asarray(Xf, float); Xw = np.asarray(Xw, np.float32); y = np.asarray(y).astype(int)
    seed = int(cfg["eval"]["random_seed"])
    rf = build_model("rf", cfg).fit(Xf, y)
    fit_i, val_i = _val_split(y, seed)  # val split for CNN early stopping
    cnn_model, _ = train_deep(Xw[fit_i], y[fit_i], Xw[val_i], y[val_i], cfg, arch=ARCH)
    cnn_state = {k: v.cpu() for k, v in cnn_model.state_dict().items()}
    return FrozenEnsemble(rf, cnn_state, Xw.shape[1], feature_names, t_high, t_low, cfg)
