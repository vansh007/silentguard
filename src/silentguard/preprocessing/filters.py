"""Signal preprocessing: band-pass, baseline-wander removal, normalization.

Build-order step 2. Keep functions pure (array in -> array out). All functions
tolerate NaNs and flat/short signals without crashing.
"""
from __future__ import annotations
import numpy as np
from scipy import signal as sp_signal


def _clean_nans(sig: np.ndarray) -> np.ndarray:
    """Replace NaN/Inf with finite values (linear-interp interior, edge-fill ends)."""
    sig = np.asarray(sig, dtype=float).copy()
    bad = ~np.isfinite(sig)
    if bad.all():
        return np.zeros_like(sig)
    if bad.any():
        idx = np.arange(len(sig))
        sig[bad] = np.interp(idx[bad], idx[~bad], sig[~bad])
    return sig


def bandpass(sig: np.ndarray, fs: int, low: float = 0.5, high: float = 40.0, order: int = 3) -> np.ndarray:
    """Zero-phase Butterworth band-pass (filtfilt).

    Clamps the high cutoff below Nyquist and skips filtering for signals too
    short for filtfilt's edge padding, returning the (nan-cleaned) input instead.
    """
    sig = _clean_nans(sig)
    nyq = 0.5 * fs
    high = min(high, nyq * 0.99)
    low = max(low, 0.01)
    if low >= high or len(sig) < 3 * (order + 1):
        return sig
    b, a = sp_signal.butter(order, [low / nyq, high / nyq], btype="band")
    padlen = 3 * max(len(a), len(b))
    if len(sig) <= padlen:
        return sig
    return sp_signal.filtfilt(b, a, sig)


def remove_baseline_wander(sig: np.ndarray, fs: int) -> np.ndarray:
    """Remove low-frequency baseline drift via a median-filter estimate.

    Subtracts a ~200 ms then ~600 ms median-filtered baseline (a standard ECG
    de-trending cascade), which removes wander without distorting QRS shape.
    """
    sig = _clean_nans(sig)
    if len(sig) < 3:
        return sig

    def _odd(n: int) -> int:
        n = max(3, int(n))
        return n if n % 2 == 1 else n + 1

    w1 = _odd(0.2 * fs)
    w2 = _odd(0.6 * fs)
    if len(sig) <= w2:
        return sig - np.median(sig)
    baseline = sp_signal.medfilt(sig, kernel_size=w1)
    baseline = sp_signal.medfilt(baseline, kernel_size=w2)
    return sig - baseline


def normalize(sig: np.ndarray) -> np.ndarray:
    """Z-normalize a single channel, robust to NaNs/flatlines.

    Uses median/MAD (robust to outliers/spikes). Returns zeros for flat signals.
    """
    sig = _clean_nans(sig)
    med = np.median(sig)
    mad = np.median(np.abs(sig - med))
    scale = 1.4826 * mad  # MAD -> std-equivalent for Gaussian
    if scale < 1e-8:
        std = np.std(sig)
        if std < 1e-8:
            return np.zeros_like(sig)
        return (sig - np.mean(sig)) / std
    return (sig - med) / scale


def preprocess_ecg(sig: np.ndarray, fs: int, low: float = 0.5, high: float = 40.0) -> np.ndarray:
    """Standard ECG cleaning cascade: baseline removal -> band-pass -> normalize."""
    return normalize(bandpass(remove_baseline_wander(sig, fs), fs, low, high))
