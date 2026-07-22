"""Per-alarm explanations + calibration for clinician trust. Contribution C3.

- Feature model: SHAP values -> top signed reasons ("low PPG SQI, ECG/pulse HR mismatch").
- Calibration: reliability curve + Expected Calibration Error (ECE) over predicted probs.
- Waveform (attention/Grad-CAM): deferred until the deep model (models/cnn.py) exists.

All feature-model helpers accept the baseline sklearn Pipeline (impute + tree classifier)
and operate on the classifier stage after imputation, so callers pass raw feature rows.
"""
from __future__ import annotations
import numpy as np


def _split_pipeline(model):
    """Return (preprocessor_transform_fn, final_estimator) for a Pipeline or bare estimator."""
    if hasattr(model, "named_steps"):
        steps = list(model.named_steps.values())
        clf = steps[-1]
        pre = steps[:-1]

        def transform(X):
            Xt = np.asarray(X, dtype=float)
            for step in pre:
                Xt = step.transform(Xt)
            return Xt

        return transform, clf
    return (lambda X: np.asarray(X, dtype=float)), model


def explain_features(model, x_row: np.ndarray, feature_names: list[str], k: int = 3) -> list[tuple[str, float]]:
    """Top-k SHAP reasons for one prediction, as (feature_name, signed_contribution).

    The signed contribution is toward P(TRUE alarm): positive pushes the alarm toward
    TRUE (keep), negative toward FALSE (suppress). Sorted by absolute magnitude.
    Falls back to tree feature_importances * deviation if SHAP is unavailable.
    """
    transform, clf = _split_pipeline(model)
    x = transform(np.asarray(x_row, dtype=float).reshape(1, -1))

    contribs = None
    try:
        import shap
        explainer = shap.TreeExplainer(clf)
        sv = explainer.shap_values(x)
        contribs = _shap_row_toward_true(sv)
    except Exception:
        contribs = None

    if contribs is None:
        # Fallback: importance-weighted deviation from the training feature medians.
        imp = getattr(clf, "feature_importances_", None)
        if imp is None:
            imp = np.ones(x.shape[1])
        contribs = imp * (x[0] - np.median(x))  # rough, sign-bearing

    contribs = np.asarray(contribs, dtype=float).ravel()
    order = np.argsort(-np.abs(contribs))[:k]
    return [(feature_names[i], float(contribs[i])) for i in order]


def _shap_row_toward_true(sv) -> np.ndarray:
    """Normalize the many SHAP return shapes to a 1-D per-feature vector for class 'true'."""
    # Newer shap: ndarray (n, n_features) or (n, n_features, n_classes)
    if isinstance(sv, list):           # older API: [class0_array, class1_array]
        arr = np.asarray(sv[-1])       # last class = positive (true)
    else:
        arr = np.asarray(sv)
    if arr.ndim == 3:                  # (n, features, classes)
        arr = arr[:, :, -1]
    return arr[0]


def calibration_curve_ece(y_true: np.ndarray, p_true: np.ndarray, n_bins: int = 10) -> dict:
    """Reliability curve + Expected Calibration Error over predicted P(true alarm).

    Returns bin centers, per-bin mean confidence, per-bin empirical accuracy, per-bin
    counts, and the ECE (sum over bins of |acc - conf| weighted by bin population).
    """
    y_true = np.asarray(y_true).astype(int)
    p = np.clip(np.asarray(p_true, dtype=float), 0.0, 1.0)
    edges = np.linspace(0.0, 1.0, n_bins + 1)
    centers, accs, confs, counts = [], [], [], []
    ece = 0.0
    n = len(p)
    for i in range(n_bins):
        lo, hi = edges[i], edges[i + 1]
        mask = (p >= lo) & (p < hi) if i < n_bins - 1 else (p >= lo) & (p <= hi)
        centers.append((lo + hi) / 2.0)
        if mask.any():
            conf = float(np.mean(p[mask]))
            acc = float(np.mean(y_true[mask]))
            cnt = int(mask.sum())
            ece += (cnt / n) * abs(acc - conf)
        else:
            conf, acc, cnt = float("nan"), float("nan"), 0
        confs.append(conf); accs.append(acc); counts.append(cnt)
    return {
        "bin_centers": np.array(centers),
        "bin_confidence": np.array(confs),
        "bin_accuracy": np.array(accs),
        "bin_counts": np.array(counts),
        "ece": float(ece),
        "n_bins": n_bins,
    }


def explain_waveform(model, x_waveform: np.ndarray) -> np.ndarray:
    """Per-sample importance (attention/Grad-CAM) aligned to the input waveform.

    Deferred: this requires the deep model (models/cnn.py), which is not built yet.
    """
    raise NotImplementedError(
        "Waveform explanation needs the deep model (models/cnn.py), not built yet. "
        "Use explain_features() for the classical feature model."
    )
