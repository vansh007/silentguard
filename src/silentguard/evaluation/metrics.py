"""Metrics. The headline is the asymmetric challenge score, NOT accuracy.

    challenge_score = (TP + TN) / (TP + TN + FP + 5*FN)

Always also report true-alarm sensitivity separately (must stay ~100%).
Convention: label 1 = TRUE alarm, 0 = FALSE alarm.

Decision convention (KEEP vs SUPPRESS):
  y_pred_keep = 1  -> KEEP the alarm   (we predict it is a TRUE alarm)
  y_pred_keep = 0  -> SUPPRESS         (we predict it is a FALSE alarm)

Confusion terms under this convention:
  TP = KEEP a true alarm      (y_true=1, keep=1)  -> correct, alarm reaches nurse
  TN = SUPPRESS a false alarm (y_true=0, keep=0)  -> correct, noise silenced
  FP = KEEP a false alarm     (y_true=0, keep=1)  -> nuisance (weight 1)
  FN = SUPPRESS a true alarm  (y_true=1, keep=0)  -> DANGEROUS (weight 5)
"""
from __future__ import annotations
import numpy as np


def confusion_counts(y_true: np.ndarray, y_pred_keep: np.ndarray) -> tuple[int, int, int, int]:
    """Return (TP, TN, FP, FN) under the KEEP/SUPPRESS convention above."""
    y_true = np.asarray(y_true).astype(int)
    keep = np.asarray(y_pred_keep).astype(int)
    tp = int(np.sum((y_true == 1) & (keep == 1)))
    tn = int(np.sum((y_true == 0) & (keep == 0)))
    fp = int(np.sum((y_true == 0) & (keep == 1)))
    fn = int(np.sum((y_true == 1) & (keep == 0)))
    return tp, tn, fp, fn


def challenge_score(y_true: np.ndarray, y_pred_keep: np.ndarray, fn_penalty: int = 5) -> float:
    """PhysioNet/CinC 2015 score: (TP + TN) / (TP + TN + FP + fn_penalty*FN).

    A suppressed TRUE alarm (FN) is penalized ``fn_penalty`` (=5) times a kept
    false alarm (FP). Range 0..1, higher is better.
    """
    tp, tn, fp, fn = confusion_counts(y_true, y_pred_keep)
    denom = tp + tn + fp + fn_penalty * fn
    if denom == 0:
        return 0.0
    return (tp + tn) / denom


def full_metrics(
    y_true: np.ndarray,
    y_score: np.ndarray,
    threshold: float = 0.5,
    fn_penalty: int = 5,
) -> dict:
    """Full metric bundle for a set of predictions.

    Parameters
    ----------
    y_true : array of {0,1}, 1 = TRUE alarm.
    y_score : predicted probability that the alarm is TRUE (KEEP score).
    threshold : keep the alarm iff y_score >= threshold.

    Returns a dict with the challenge score plus ROC-AUC, true-alarm
    sensitivity, specificity (= false-alarm suppression rate), PPV, accuracy,
    the raw confusion counts, and the operating threshold.
    """
    y_true = np.asarray(y_true).astype(int)
    y_score = np.asarray(y_score, dtype=float)
    keep = (y_score >= threshold).astype(int)
    tp, tn, fp, fn = confusion_counts(y_true, keep)

    sensitivity = tp / (tp + fn) if (tp + fn) else float("nan")  # true-alarm recall
    specificity = tn / (tn + fp) if (tn + fp) else float("nan")  # false-alarm suppression
    ppv = tp / (tp + fp) if (tp + fp) else float("nan")
    accuracy = (tp + tn) / (tp + tn + fp + fn) if (tp + tn + fp + fn) else float("nan")

    # ROC-AUC needs both classes present and a scikit-learn dependency.
    auroc = float("nan")
    if len(np.unique(y_true)) == 2:
        try:
            from sklearn.metrics import roc_auc_score
            auroc = float(roc_auc_score(y_true, y_score))
        except Exception:
            auroc = float("nan")

    return {
        "challenge_score": challenge_score(y_true, keep, fn_penalty),
        "auroc": auroc,
        "sensitivity": sensitivity,          # TRUE-alarm sensitivity (keep near 1.0)
        "specificity": specificity,          # fraction of false alarms suppressed
        "ppv": ppv,
        "accuracy": accuracy,
        "tp": tp, "tn": tn, "fp": fp, "fn": fn,
        "n": int(len(y_true)),
        "threshold": float(threshold),
    }
