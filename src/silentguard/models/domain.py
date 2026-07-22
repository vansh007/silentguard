"""Single-dataset generalization under distribution shift (contribution C1).

Repurposed (2026-07-22) from the old cross-dataset/few-shot module after VTaC was
dropped. We now measure generalization *within* CinC-2015:

- leave_one_arrhythmia_out (LOAO, C1, headline): train on four of the five arrhythmia
  types, test zero-shot on the held-out fifth; repeat for all five. This quantifies
  whether the model generalizes to an alarm morphology it never trained on, and the
  gap vs the in-distribution 5-fold baseline. It operationalizes the 2015 paper's
  "there was no best general algorithm" finding with no second dataset.

- leave_one_source_out (LOSO, C1b): a true cross-hospital test would hold out a monitor
  source. CinC-2015 headers carry NO hospital/manufacturer tags (verified across all 750
  records), so this is NOT feasible and the function says so rather than faking it.

Honesty note: in LOAO the held-out arrhythmia is a genuine test set, so the operating
threshold is selected only on the TRAINING arrhythmias (via inner-CV OOF probabilities),
never on the held-out type — no leakage.
"""
from __future__ import annotations
import numpy as np

from .baseline import build_model, _inner_oof_proba, select_threshold
from ..evaluation.metrics import challenge_score, full_metrics


def _fit_predict(X_tr, y_tr, X_te, cfg, kind):
    """Fit a fresh model on the training split and return P(true alarm) on the test split."""
    model = build_model(kind, cfg)
    if kind == "xgb":
        pos = max(1, int(np.sum(y_tr == 1)))
        neg = int(np.sum(y_tr == 0))
        model.named_steps["clf"].set_params(scale_pos_weight=neg / pos)
    model.fit(X_tr, y_tr)
    return model, model.predict_proba(X_te)[:, 1]


def leave_one_arrhythmia_out(
    X: np.ndarray,
    y: np.ndarray,
    groups: np.ndarray,
    cfg: dict,
    kind: str = "rf",
) -> dict:
    """LOAO generalization study (C1).

    For each arrhythmia code g: train on all records whose type != g, pick the KEEP
    threshold on the training types' inner-CV OOF probabilities, then evaluate zero-shot
    on the held-out records (type == g).

    Returns
    -------
    dict with:
      per_group : {code: metrics}  — challenge score, true-alarm sensitivity, AUROC,
                  specificity, confusion counts, chosen threshold, n/true/false.
      pooled    : metrics over ALL held-out predictions (each record tested exactly once
                  as an unseen type) — the honest overall LOAO number.
      order     : the arrhythmia codes evaluated.
    """
    X = np.asarray(X, dtype=float)
    y = np.asarray(y).astype(int)
    groups = np.asarray(groups)
    fn_penalty = int(cfg.get("eval", {}).get("fn_penalty", 5))
    n_folds = int(cfg.get("eval", {}).get("cv_folds", 5))

    codes = [c for c in ("ASYSTOLE", "BRADY", "TACHY", "VTACH", "VFIB") if c in set(groups)]
    codes += [c for c in np.unique(groups) if c not in codes]

    per_group: dict[str, dict] = {}
    pooled_keep = np.zeros(len(y), dtype=int)
    pooled_proba = np.full(len(y), np.nan, dtype=float)

    for g in codes:
        test_mask = groups == g
        train_mask = ~test_mask
        if test_mask.sum() == 0 or train_mask.sum() == 0:
            continue
        X_tr, y_tr = X[train_mask], y[train_mask]
        X_te, y_te = X[test_mask], y[test_mask]

        # Threshold chosen on TRAINING arrhythmias only (inner-CV OOF) -> no leakage.
        inner_proba = _inner_oof_proba(X_tr, y_tr, cfg, kind, n_folds)
        thr = select_threshold(y_tr, inner_proba, fn_penalty)

        _, proba_te = _fit_predict(X_tr, y_tr, X_te, cfg, kind)
        keep = (proba_te >= thr).astype(int)

        pooled_keep[test_mask] = keep
        pooled_proba[test_mask] = proba_te

        m = full_metrics(y_te, proba_te, threshold=thr, fn_penalty=fn_penalty)
        # recompute score/sens from the actual KEEP decisions at the fixed threshold
        m["challenge_score"] = challenge_score(y_te, keep, fn_penalty)
        m["n_true"] = int(np.sum(y_te == 1))
        m["n_false"] = int(np.sum(y_te == 0))
        m["threshold"] = float(thr)
        per_group[str(g)] = m

    # Pooled: each record was held out exactly once as an unseen type.
    pooled = full_metrics(y, pooled_proba, threshold=0.5, fn_penalty=fn_penalty)
    tp = int(np.sum((y == 1) & (pooled_keep == 1)))
    tn = int(np.sum((y == 0) & (pooled_keep == 0)))
    fp = int(np.sum((y == 0) & (pooled_keep == 1)))
    fn = int(np.sum((y == 1) & (pooled_keep == 0)))
    pooled["challenge_score"] = challenge_score(y, pooled_keep, fn_penalty)
    pooled["sensitivity"] = tp / (tp + fn) if (tp + fn) else float("nan")
    pooled["specificity"] = tn / (tn + fp) if (tn + fp) else float("nan")
    pooled["ppv"] = tp / (tp + fp) if (tp + fp) else float("nan")
    pooled.update({"tp": tp, "tn": tn, "fp": fp, "fn": fn})

    return {"per_group": per_group, "pooled": pooled, "order": codes,
            "pooled_keep": pooled_keep, "pooled_proba": pooled_proba}


def source_tags_available(records) -> bool:
    """Whether CinC-2015 records carry a hospital/monitor-source tag. They do not.

    Checked across all 750 headers: each comment block is exactly [arrhythmia, true/false]
    with no source field (the challenge filtered out manufacturer-identifying spectra).
    """
    return False


def leave_one_source_out(*args, **kwargs) -> dict:
    """LOSO (C1b) — NOT feasible on CinC-2015: no source tags in the headers.

    Returns a structured 'not feasible' result instead of fabricating sources.
    """
    return {
        "feasible": False,
        "reason": (
            "CinC-2015 record headers carry no hospital/manufacturer/monitor tag "
            "(verified across all 750 records); the challenge deliberately removed "
            "manufacturer-identifying spectral characteristics. A true leave-one-source-out "
            "test therefore cannot be run on this dataset. Future work pending a "
            "second, source-tagged dataset."
        ),
    }


# Back-compat shims for the old cross-dataset API (VTaC dropped 2026-07-22).
def generalize(*args, **kwargs):
    raise NotImplementedError(
        "Cross-dataset generalization was dropped with VTaC. Use "
        "leave_one_arrhythmia_out() for the single-dataset generalization study (C1)."
    )


def few_shot_calibrate(*args, **kwargs):
    raise NotImplementedError(
        "Few-shot local calibration (E6) required VTaC as a stand-in 'new hospital' and "
        "was dropped. It is future work pending a second, source-tagged dataset."
    )
