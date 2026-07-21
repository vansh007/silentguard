"""Safety-constrained decision layer: SUPPRESS / KEEP / DEFER.

Build-order step 7 — REVIEW 2 target. This is a core research contribution.
Calibrate thresholds on validation so true-alarm sensitivity >= cfg['safety']['min_true_sensitivity'].
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

    Returns {"t_high":..., "t_low":...}. TODO: sweep thresholds, enforce the sensitivity
    floor, then maximize false-alarm suppression subject to it.
    """
    raise NotImplementedError


def decide(p_false: float, t_high: float, t_low: float) -> Decision:
    """Map a false-alarm probability to a three-way decision. TODO."""
    raise NotImplementedError


def choose_latency(p_false_over_time, t_high: float, t_low: float, max_wait_s: float = 30.0) -> float:
    """Adaptive latency (C2): return how many seconds to wait before deciding.

    Decide immediately when the running p(false) is already confident (>= t_high or <= t_low);
    otherwise keep ingesting waveform up to max_wait_s. Produces the latency-vs-sensitivity curve.
    TODO: implement the streaming decision loop.
    """
    raise NotImplementedError
