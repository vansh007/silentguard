"""Signal Quality Indices (SQIs) — the highest-leverage classical trick here.

Most false alarms come from NOISE/ARTIFACT, so quantifying signal quality separates
"garbage signal" from "real arrhythmia". Build-order step 3.

All functions are defensive: they return a finite float (or np.nan) rather than
raising, because per-record channel quality varies wildly.
"""
from __future__ import annotations
import warnings
import numpy as np
from scipy import signal as sp_signal
from scipy import stats as sp_stats


def _detect_peaks(ecg: np.ndarray, fs: int, method: str) -> np.ndarray:
    """Run one neurokit2 QRS detector; return R-peak sample indices (empty on failure)."""
    try:
        import neurokit2 as nk
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            _, info = nk.ecg_peaks(np.asarray(ecg, dtype=float), sampling_rate=fs, method=method)
        peaks = np.asarray(info.get("ECG_R_Peaks", []), dtype=int)
        return peaks[np.isfinite(peaks)] if peaks.size else peaks
    except Exception:
        return np.array([], dtype=int)


def _match_beats(a: np.ndarray, b: np.ndarray, tol: int) -> int:
    """Count beats in ``a`` that have a partner in ``b`` within ``tol`` samples (greedy)."""
    if a.size == 0 or b.size == 0:
        return 0
    b_sorted = np.sort(b)
    matched = 0
    for t in a:
        j = np.searchsorted(b_sorted, t)
        best = np.inf
        for k in (j - 1, j):
            if 0 <= k < b_sorted.size:
                best = min(best, abs(int(b_sorted[k]) - int(t)))
        if best <= tol:
            matched += 1
    return matched


def bsqi(ecg: np.ndarray, fs: int, tol_ms: float = 150.0) -> float:
    """Agreement between two independent QRS detectors (0..1). Low => noisy ECG.

    Runs neurokit2's default detector and Pan-Tompkins, matches beats within a
    ``tol_ms`` window, and returns the Jaccard-style agreement
    ``N_matched / (N_a + N_b - N_matched)``. Returns 0.0 if both detectors fire
    but never agree, and NaN only if neither detector finds any beats.
    """
    a = _detect_peaks(ecg, fs, "neurokit")
    b = _detect_peaks(ecg, fs, "pantompkins1985")
    if a.size == 0 and b.size == 0:
        return np.nan
    if a.size == 0 or b.size == 0:
        return 0.0
    tol = int(round(tol_ms / 1000.0 * fs))
    matched = _match_beats(a, b, tol)
    denom = a.size + b.size - matched
    return float(matched / denom) if denom > 0 else 0.0


def kurtosis_sqi(sig: np.ndarray) -> float:
    """Kurtosis-based quality (clean ECG is peaky => high kurtosis). Fisher kurtosis."""
    sig = np.asarray(sig, dtype=float)
    sig = sig[np.isfinite(sig)]
    if sig.size < 4 or np.std(sig) < 1e-8:
        return np.nan
    return float(sp_stats.kurtosis(sig, fisher=True, bias=False))


def power_spectrum_sqi(sig: np.ndarray, fs: int) -> float:
    """QRS-band power ratio: power in 5-15 Hz over power in 5-40 Hz (0..1).

    A well-formed QRS complex concentrates energy around 5-15 Hz; artifact and
    high-frequency noise spread energy across the band, lowering this ratio.
    """
    sig = np.asarray(sig, dtype=float)
    sig = sig[np.isfinite(sig)]
    if sig.size < fs:  # need at least ~1 s
        return np.nan
    nperseg = min(len(sig), 1024)
    f, pxx = sp_signal.welch(sig, fs=fs, nperseg=nperseg)
    qrs = np.trapezoid(pxx[(f >= 5) & (f <= 15)], f[(f >= 5) & (f <= 15)]) if np.any((f >= 5) & (f <= 15)) else 0.0
    band = np.trapezoid(pxx[(f >= 5) & (f <= 40)], f[(f >= 5) & (f <= 40)]) if np.any((f >= 5) & (f <= 40)) else 0.0
    if band <= 1e-12:
        return np.nan
    return float(qrs / band)


def baseline_power_ratio(sig: np.ndarray, fs: int) -> float:
    """Fraction of power below 1 Hz (baseline wander). High => drifty/low-quality."""
    sig = np.asarray(sig, dtype=float)
    sig = sig[np.isfinite(sig)]
    if sig.size < fs:
        return np.nan
    nperseg = min(len(sig), 1024)
    f, pxx = sp_signal.welch(sig, fs=fs, nperseg=nperseg)
    total = np.trapezoid(pxx, f)
    if total <= 1e-12:
        return np.nan
    low = np.trapezoid(pxx[f < 1.0], f[f < 1.0]) if np.any(f < 1.0) else 0.0
    return float(low / total)
