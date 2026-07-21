"""Baseline classifier (RandomForest/XGBoost) on handcrafted features + SQIs.

Build-order step 5 — the REVIEW 1 target. Evaluate with 5-fold CV using the challenge score.

Operating-point honesty: the KEEP/SUPPRESS threshold is selected to maximize the
challenge score on each fold's TRAINING data only, then applied to the held-out
fold. Out-of-fold (OOF) predictions are aggregated for leak-free reporting — no
threshold is ever tuned on the data it is scored on.
"""
from __future__ import annotations
import numpy as np

from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.model_selection import StratifiedKFold
from sklearn.pipeline import Pipeline

from ..evaluation.metrics import challenge_score, full_metrics


def build_model(kind: str, cfg: dict) -> Pipeline:
    """Return an imputer + classifier pipeline. ``kind`` in {"rf", "xgb"}.

    Both handle class imbalance (RF via balanced class weights, XGB via
    scale_pos_weight set at fit time). Median imputation fills NaNs from
    missing channels so records with e.g. no ABP still train.
    """
    seed = int(cfg.get("eval", {}).get("random_seed", 42))
    imputer = SimpleImputer(strategy="median")
    if kind == "rf":
        clf = RandomForestClassifier(
            n_estimators=400,
            max_depth=None,
            min_samples_leaf=2,
            class_weight="balanced",
            n_jobs=-1,
            random_state=seed,
        )
    elif kind == "xgb":
        from xgboost import XGBClassifier
        clf = XGBClassifier(
            n_estimators=400,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            eval_metric="logloss",
            n_jobs=-1,
            random_state=seed,
        )
    else:
        raise ValueError(f"unknown model kind: {kind!r} (expected 'rf' or 'xgb')")
    return Pipeline([("impute", imputer), ("clf", clf)])


def _inner_oof_proba(X: np.ndarray, y: np.ndarray, cfg: dict, kind: str, n_folds: int = 5) -> np.ndarray:
    """Inner-CV out-of-fold P(true alarm) — realistic (non-resubstitution) probabilities.

    Used to select the operating threshold without leaking: the model never
    scores records it was trained on, so these probabilities reflect
    generalization instead of the overfit training fit.
    """
    seed = int(cfg.get("eval", {}).get("random_seed", 42))
    inner = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=seed)
    oof = np.full(len(y), np.nan, dtype=float)
    for tr, te in inner.split(X, y):
        model = build_model(kind, cfg)
        if kind == "xgb":
            pos = max(1, int(np.sum(y[tr] == 1)))
            neg = int(np.sum(y[tr] == 0))
            model.named_steps["clf"].set_params(scale_pos_weight=neg / pos)
        model.fit(X[tr], y[tr])
        oof[te] = model.predict_proba(X[te])[:, 1]
    return oof


def train_baseline(X: np.ndarray, y: np.ndarray, cfg: dict, kind: str = "rf") -> Pipeline:
    """Fit an RF/XGB pipeline with class weighting on the full data. Returns the model."""
    model = build_model(kind, cfg)
    if kind == "xgb":
        pos = max(1, int(np.sum(y == 1)))
        neg = int(np.sum(y == 0))
        model.named_steps["clf"].set_params(scale_pos_weight=neg / pos)
    model.fit(X, y)
    return model


def select_threshold(y: np.ndarray, proba: np.ndarray, fn_penalty: int = 5) -> float:
    """Pick the KEEP threshold maximizing challenge score; tie-break to higher sensitivity.

    Sweeps candidate thresholds derived from the observed probabilities. Because
    FN (suppressing a true alarm) is penalized ``fn_penalty``x, the optimum tends
    to sit low (keep when in doubt), preserving true-alarm sensitivity.
    """
    y = np.asarray(y).astype(int)
    proba = np.asarray(proba, dtype=float)
    cands = np.unique(np.concatenate([[0.0], proba, [1.0 + 1e-9]]))
    best_thr, best_key = 0.5, (-1.0, -1.0, 1.0)
    for thr in cands:
        keep = (proba >= thr).astype(int)
        score = challenge_score(y, keep, fn_penalty)
        tp = int(np.sum((y == 1) & (keep == 1)))
        fn = int(np.sum((y == 1) & (keep == 0)))
        sens = tp / (tp + fn) if (tp + fn) else 0.0
        key = (score, sens, -thr)  # maximize score, then sensitivity, then lower threshold
        if key > best_key:
            best_key, best_thr = key, float(thr)
    return best_thr


def cross_validate(
    X: np.ndarray,
    y: np.ndarray,
    cfg: dict,
    kind: str = "rf",
    groups: np.ndarray | None = None,
) -> dict:
    """5-fold stratified CV. Returns aggregated OOF metrics + per-arrhythmia breakdown.

    ``groups`` (optional) is the per-record arrhythmia code, used only for the
    per-type breakdown. Returns a dict with overall metrics (at the CV-selected
    operating point), OOF probabilities/decisions, per-fold thresholds, and a
    ``per_arrhythmia`` sub-dict.
    """
    X = np.asarray(X, dtype=float)
    y = np.asarray(y).astype(int)
    n_folds = int(cfg.get("eval", {}).get("cv_folds", 5))
    seed = int(cfg.get("eval", {}).get("random_seed", 42))
    fn_penalty = int(cfg.get("eval", {}).get("fn_penalty", 5))

    skf = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=seed)
    oof_proba = np.full(len(y), np.nan, dtype=float)
    oof_keep = np.zeros(len(y), dtype=int)
    fold_thresholds: list[float] = []

    for train_idx, test_idx in skf.split(X, y):
        model = build_model(kind, cfg)
        if kind == "xgb":
            pos = max(1, int(np.sum(y[train_idx] == 1)))
            neg = int(np.sum(y[train_idx] == 0))
            model.named_steps["clf"].set_params(scale_pos_weight=neg / pos)
        model.fit(X[train_idx], y[train_idx])

        # Select the threshold on INNER-CV OOF probabilities of the training fold
        # (not resubstitution) so it reflects generalization, then apply to the
        # held-out outer fold. Fully leak-free (nested CV).
        inner_proba = _inner_oof_proba(X[train_idx], y[train_idx], cfg, kind, n_folds)
        thr = select_threshold(y[train_idx], inner_proba, fn_penalty)
        fold_thresholds.append(thr)

        proba_test = model.predict_proba(X[test_idx])[:, 1]
        oof_proba[test_idx] = proba_test
        oof_keep[test_idx] = (proba_test >= thr).astype(int)

    # Overall metrics at the CV operating point (mean fold threshold, for reporting).
    mean_thr = float(np.mean(fold_thresholds))
    metrics = full_metrics(y, oof_proba, threshold=mean_thr, fn_penalty=fn_penalty)
    # Recompute the score/sensitivity from the actual per-fold KEEP decisions (honest OOF).
    tp = int(np.sum((y == 1) & (oof_keep == 1)))
    tn = int(np.sum((y == 0) & (oof_keep == 0)))
    fp = int(np.sum((y == 0) & (oof_keep == 1)))
    fn = int(np.sum((y == 1) & (oof_keep == 0)))
    metrics["challenge_score"] = challenge_score(y, oof_keep, fn_penalty)
    metrics["sensitivity"] = tp / (tp + fn) if (tp + fn) else float("nan")
    metrics["specificity"] = tn / (tn + fp) if (tn + fp) else float("nan")
    metrics["ppv"] = tp / (tp + fp) if (tp + fp) else float("nan")
    metrics.update({"tp": tp, "tn": tn, "fp": fp, "fn": fn})

    out = {
        "model": kind,
        "metrics": metrics,
        "oof_proba": oof_proba,
        "oof_keep": oof_keep,
        "fold_thresholds": fold_thresholds,
        "mean_threshold": mean_thr,
    }

    # --- per-arrhythmia breakdown using the OOF KEEP decisions ---
    if groups is not None:
        groups = np.asarray(groups)
        per: dict[str, dict] = {}
        for code in np.unique(groups):
            m = groups == code
            yk, kk, pk = y[m], oof_keep[m], oof_proba[m]
            tpt = int(np.sum((yk == 1) & (kk == 1)))
            fnt = int(np.sum((yk == 1) & (kk == 0)))
            auc = float("nan")
            if len(np.unique(yk)) == 2:
                try:
                    from sklearn.metrics import roc_auc_score
                    auc = float(roc_auc_score(yk, pk))
                except Exception:
                    auc = float("nan")
            per[str(code)] = {
                "n": int(m.sum()),
                "n_true": int(np.sum(yk == 1)),
                "n_false": int(np.sum(yk == 0)),
                "challenge_score": challenge_score(yk, kk, fn_penalty),
                "sensitivity": tpt / (tpt + fnt) if (tpt + fnt) else float("nan"),
                "auroc": auc,
            }
        out["per_arrhythmia"] = per

    return out
