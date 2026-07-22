"""Safety-constrained decision layer: SUPPRESS / KEEP / DEFER.

Build-order step 7 — REVIEW 2 target. A core research contribution (C2).

Convention: the model emits ``p_false`` = P(alarm is FALSE) = 1 - P(true). Three zones
on p_false, using two thresholds t_low <= t_high:
    p_false >= t_high         -> SUPPRESS   (confident false -> silence it)
    p_false <= t_low          -> KEEP       (confident true  -> sound it for the nurse)
    t_low < p_false < t_high  -> DEFER      (uncertain -> soft flag for a human)

Safety guarantee: a TRUE alarm is only ever *missed* if it is SUPPRESSED (KEEP and DEFER
both let it reach a human). t_high is therefore calibrated on validation so that the
true-alarm sensitivity (fraction of true alarms NOT suppressed) stays >= the configured
floor (default 0.99). Subject to that, we suppress as many false alarms as possible.
"""
from __future__ import annotations
import numpy as np
from enum import Enum


class Decision(str, Enum):
    SUPPRESS = "suppress"   # confident false alarm -> silence it
    KEEP = "keep"           # likely true -> reaches the nurse
    DEFER = "defer"         # uncertain -> flag for a human


def calibrate_thresholds(p_false_val: np.ndarray, y_val: np.ndarray, cfg: dict) -> dict:
    """Pick (t_high, t_low) on validation so true-alarm sensitivity >= floor.

    ``p_false_val`` is P(false) on a validation set; ``y_val`` is 1=TRUE alarm, 0=FALSE.

    t_high (SUPPRESS cutoff) is the smallest cutoff that suppresses at most
    ``floor(1 - min_true_sensitivity)`` of the true alarms — i.e. it *guarantees* the
    sensitivity floor on validation while maximizing false-alarm suppression.

    t_low (KEEP cutoff) is set symmetrically on the false-alarm side so that at most the
    same fraction of FALSE alarms are auto-KEPT; the uncertain middle becomes DEFER.
    Thresholds are clamped so t_low <= t_high.
    """
    p_false_val = np.asarray(p_false_val, dtype=float)
    y_val = np.asarray(y_val).astype(int)
    floor = float(cfg.get("safety", {}).get("min_true_sensitivity", 0.99))
    eps = 1e-9

    true_pf = np.sort(p_false_val[y_val == 1])   # ascending
    false_pf = np.sort(p_false_val[y_val == 0])

    # --- t_high: suppress at most k_true of the true alarms ---
    if true_pf.size == 0:
        t_high = float(cfg.get("safety", {}).get("t_high", 0.90))
    else:
        k_true = int(np.floor((1.0 - floor) * true_pf.size))  # allowed missed true alarms
        # suppress p_false >= t_high; take the (k_true)-th largest true p_false as the boundary
        # so at most k_true true alarms are >= t_high.
        if k_true <= 0:
            t_high = float(true_pf[-1] + eps)   # suppress no true alarm -> 100% sensitivity
        else:
            t_high = float(true_pf[-k_true])    # the k_true-th largest boundary

    # --- t_low: auto-KEEP at most k_false of the false alarms ---
    if false_pf.size == 0:
        t_low = float(cfg.get("safety", {}).get("t_low", 0.10))
    else:
        k_false = int(np.floor((1.0 - floor) * false_pf.size))
        if k_false <= 0:
            t_low = float(false_pf[0] - eps)    # keep essentially no false alarm auto
        else:
            t_low = float(false_pf[k_false - 1])

    t_low = min(t_low, t_high)   # keep the ordering sane (DEFER zone may be empty)
    return {"t_high": t_high, "t_low": t_low}


def decide(p_false: float, t_high: float, t_low: float) -> Decision:
    """Map a single false-alarm probability to a three-way decision."""
    if p_false >= t_high:
        return Decision.SUPPRESS
    if p_false <= t_low:
        return Decision.KEEP
    return Decision.DEFER


def decide_batch(p_false: np.ndarray, t_high: float, t_low: float) -> list[Decision]:
    """Vectorized :func:`decide` over an array of p_false values."""
    return [decide(float(p), t_high, t_low) for p in np.asarray(p_false, dtype=float)]


def safety_report(p_false: np.ndarray, y: np.ndarray, t_high: float, t_low: float) -> dict:
    """Summarize a safety operating point.

    Returns true-alarm sensitivity (fraction of true alarms NOT suppressed),
    false-alarm suppression rate (fraction of false alarms SUPPRESSED), the defer rate,
    keep/suppress/defer counts, and the KEEP-zone true-alarm precision.
    """
    p_false = np.asarray(p_false, dtype=float)
    y = np.asarray(y).astype(int)
    dec = np.array([d.value for d in decide_batch(p_false, t_high, t_low)])

    n_true = int(np.sum(y == 1))
    n_false = int(np.sum(y == 0))
    suppressed_true = int(np.sum((y == 1) & (dec == "suppress")))
    suppressed_false = int(np.sum((y == 0) & (dec == "suppress")))
    kept = dec == "keep"

    true_sens = 1.0 - (suppressed_true / n_true) if n_true else float("nan")
    fa_suppression = suppressed_false / n_false if n_false else float("nan")
    defer_rate = float(np.mean(dec == "defer"))
    keep_ppv = float(np.mean(y[kept] == 1)) if kept.any() else float("nan")

    return {
        "t_high": float(t_high), "t_low": float(t_low),
        "true_alarm_sensitivity": true_sens,       # must stay >= floor
        "false_alarm_suppression": fa_suppression,  # of all false alarms, fraction silenced
        "defer_rate": defer_rate,
        "keep_ppv": keep_ppv,
        "n_keep": int(np.sum(dec == "keep")),
        "n_suppress": int(np.sum(dec == "suppress")),
        "n_defer": int(np.sum(dec == "defer")),
        "suppressed_true": suppressed_true,
        "suppressed_false": suppressed_false,
        "n": int(len(y)),
    }


def choose_latency(p_false_over_time, t_high: float, t_low: float, max_wait_s: float = 30.0) -> float:
    """Adaptive latency (C2): how many seconds to wait before committing a decision.

    ``p_false_over_time`` is an iterable of (t_seconds, p_false) samples in increasing
    time order (e.g. the model re-scored on a growing window as more waveform arrives).
    We decide as soon as the running p(false) is confident (>= t_high or <= t_low), and
    otherwise keep waiting up to ``max_wait_s``. Returns the chosen wait time in seconds.

    This turns the 2015 binary real-time/retrospective split into a per-alarm continuum
    and produces the latency-vs-sensitivity curve.
    """
    last_t = 0.0
    for t_seconds, p_false in p_false_over_time:
        last_t = float(t_seconds)
        if last_t >= max_wait_s:
            return min(last_t, max_wait_s)
        if p_false >= t_high or p_false <= t_low:
            return last_t   # confident -> stop waiting
    return min(last_t, max_wait_s)   # never got confident -> waited as long as allowed
