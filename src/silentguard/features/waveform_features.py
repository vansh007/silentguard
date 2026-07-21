"""Handcrafted features: beat detection, heart-rate/RR stats, cross-signal agreement.

Cross-signal agreement is key: if ECG-derived HR disagrees with the ABP/PPG pulse rate,
the alarm is likely artifact. Build-order step 4.

``extract_feature_vector`` assembles a fixed-length, named feature dict per record so
missing channels degrade gracefully (absent features become NaN, which the trees handle).
"""
from __future__ import annotations
import warnings
import numpy as np
from scipy.signal import find_peaks

from ..preprocessing.filters import preprocess_ecg, remove_baseline_wander, normalize
from . import sqi

# Config arrhythmia vocabulary (kept in sync with config.yaml labels.arrhythmias).
ARRHYTHMIA_CODES = ("ASYSTOLE", "BRADY", "TACHY", "VTACH", "VFIB")


def detect_beats(ecg: np.ndarray, fs: int) -> np.ndarray:
    """Return QRS sample indices via neurokit2 (default detector). Empty on failure."""
    try:
        import neurokit2 as nk
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            _, info = nk.ecg_peaks(np.asarray(ecg, dtype=float), sampling_rate=fs, method="neurokit")
        peaks = np.asarray(info.get("ECG_R_Peaks", []), dtype=int)
        return peaks
    except Exception:
        return np.array([], dtype=int)


def _rr_intervals(beats: np.ndarray, fs: int) -> np.ndarray:
    """RR intervals in seconds from beat sample indices."""
    if beats is None or len(beats) < 2:
        return np.array([], dtype=float)
    return np.diff(np.sort(beats)) / float(fs)


def hr_features(beats: np.ndarray, fs: int, window_s: float | None = None) -> dict[str, float]:
    """Heart rate + RR-interval statistics from beat indices.

    Returns HR summary stats (bpm), RR variability, the longest pause (seconds),
    and pause-fraction features that matter for the alarm logic (asystole = long
    pause, bradycardia = low HR, tachycardia = high HR).
    """
    rr = _rr_intervals(beats, fs)
    nan = float("nan")
    n_beats = int(len(beats)) if beats is not None else 0
    if rr.size == 0:
        return {
            "n_beats": float(n_beats),
            "hr_mean": nan, "hr_std": nan, "hr_min": nan, "hr_max": nan, "hr_median": nan,
            "rr_mean": nan, "rr_std": nan, "rr_cv": nan, "rr_min": nan, "rr_max": nan,
            "rmssd": nan, "max_pause_s": nan, "frac_pause_gt2s": nan,
        }
    hr = 60.0 / rr
    hr = hr[np.isfinite(hr)]
    rmssd = float(np.sqrt(np.mean(np.diff(rr) ** 2))) if rr.size > 1 else nan
    return {
        "n_beats": float(n_beats),
        "hr_mean": float(np.mean(hr)) if hr.size else nan,
        "hr_std": float(np.std(hr)) if hr.size else nan,
        "hr_min": float(np.min(hr)) if hr.size else nan,
        "hr_max": float(np.max(hr)) if hr.size else nan,
        "hr_median": float(np.median(hr)) if hr.size else nan,
        "rr_mean": float(np.mean(rr)),
        "rr_std": float(np.std(rr)),
        "rr_cv": float(np.std(rr) / np.mean(rr)) if np.mean(rr) > 1e-6 else nan,
        "rr_min": float(np.min(rr)),
        "rr_max": float(np.max(rr)),        # longest single RR gap (seconds)
        "rmssd": rmssd,
        "max_pause_s": float(np.max(rr)),
        "frac_pause_gt2s": float(np.mean(rr > 2.0)),
    }


def pulse_rate(pulse_sig: np.ndarray, fs: int) -> tuple[float, int]:
    """Estimate pulse rate (bpm) and pulse count from an ABP/PPG waveform.

    Uses prominence-based peak detection with a physiologic refractory period
    (>= 0.3 s between beats => <= 200 bpm). Returns (nan, 0) if unusable.
    """
    sig = np.asarray(pulse_sig, dtype=float)
    sig = sig[np.isfinite(sig)] if sig.size else sig
    if sig.size < fs:
        return float("nan"), 0
    x = normalize(remove_baseline_wander(sig, fs))
    if np.std(x) < 1e-6:
        return float("nan"), 0
    min_dist = int(0.3 * fs)
    peaks, _ = find_peaks(x, distance=min_dist, prominence=0.3)
    if peaks.size < 2:
        return float("nan"), int(peaks.size)
    rr = np.diff(peaks) / float(fs)
    rate = float(np.median(60.0 / rr))
    return rate, int(peaks.size)


def cross_signal_agreement(ecg_hr: float, pulse_hr: float) -> dict[str, float]:
    """Agreement between ECG HR and ABP/PPG pulse rate (disagreement => artifact).

    Returns the absolute bpm difference, the relative difference, and a bounded
    0..1 agreement score (1 = identical rates, decaying with mismatch).
    """
    if not (np.isfinite(ecg_hr) and np.isfinite(pulse_hr)):
        return {"hr_pulse_absdiff": float("nan"),
                "hr_pulse_reldiff": float("nan"),
                "hr_pulse_agreement": float("nan")}
    absdiff = abs(ecg_hr - pulse_hr)
    denom = max(1e-6, (abs(ecg_hr) + abs(pulse_hr)) / 2.0)
    reldiff = absdiff / denom
    agreement = float(np.exp(-absdiff / 10.0))  # ~1 when within a few bpm
    return {"hr_pulse_absdiff": float(absdiff),
            "hr_pulse_reldiff": float(reldiff),
            "hr_pulse_agreement": agreement}


def extract_feature_vector(record, cfg: dict) -> dict[str, float]:
    """Full handcrafted + SQI feature dict for one AlarmRecord.

    Combines, over a real-time window ending at the alarm:
      * ECG SQIs (bSQI, kurtosis, spectral, baseline power) on the primary lead,
      * ECG HR/RR statistics and pause features,
      * pulse rate from ABP/PPG and ECG-vs-pulse cross-signal agreement,
      * channel-availability flags and a one-hot of the (known) alarm type.
    Absent channels yield NaN features rather than errors.
    """
    fs = int(record.fs)
    window_s = float(cfg.get("signal", {}).get("window_seconds", 16))
    band = cfg.get("signal", {}).get("bandpass_hz", [0.5, 40])
    low, high = float(band[0]), float(band[1])

    feats: dict[str, float] = {}

    # --- ECG channel ---
    ecg_raw = record.primary_ecg()
    ecg_hr = float("nan")
    if ecg_raw is not None:
        ecg_win = record.window(window_s, ecg_raw)
        ecg = preprocess_ecg(ecg_win, fs, low, high)
        feats["sqi_bsqi"] = sqi.bsqi(ecg, fs)
        feats["sqi_kurtosis"] = sqi.kurtosis_sqi(ecg)
        feats["sqi_pspec"] = sqi.power_spectrum_sqi(ecg, fs)
        feats["sqi_baseline_power"] = sqi.baseline_power_ratio(ecg, fs)
        beats = detect_beats(ecg, fs)
        feats.update(hr_features(beats, fs, window_s))
        ecg_hr = feats.get("hr_median", float("nan"))
    else:
        for k in ("sqi_bsqi", "sqi_kurtosis", "sqi_pspec", "sqi_baseline_power"):
            feats[k] = float("nan")
        feats.update(hr_features(np.array([]), fs, window_s))

    # --- second ECG lead bSQI (extra robustness signal) ---
    leads = record.ecg_leads()
    if len(leads) >= 2:
        ecg2 = preprocess_ecg(record.window(window_s, record.signals[leads[1]]), fs, low, high)
        feats["sqi_bsqi_lead2"] = sqi.bsqi(ecg2, fs)
    else:
        feats["sqi_bsqi_lead2"] = float("nan")

    # --- pulsatile channel + cross-signal agreement ---
    pulse = record.pulse_channel()
    if pulse is not None:
        pname, psig = pulse
        prate, pn = pulse_rate(record.window(window_s, psig), fs)
        feats["pulse_rate"] = prate
        feats["pulse_n_beats"] = float(pn)
        feats["has_abp"] = 1.0 if pname.upper() == "ABP" else 0.0
        feats["has_ppg"] = 1.0 if pname.upper() in ("PLETH", "PPG") else 0.0
    else:
        feats["pulse_rate"] = float("nan")
        feats["pulse_n_beats"] = float("nan")
        feats["has_abp"] = 0.0
        feats["has_ppg"] = 0.0
    feats.update(cross_signal_agreement(ecg_hr, feats["pulse_rate"]))

    # --- channel-availability metadata ---
    feats["n_ecg_leads"] = float(len(leads))
    feats["has_pulse"] = 1.0 if pulse is not None else 0.0

    # --- one-hot of the (known) alarm type ---
    for code in ARRHYTHMIA_CODES:
        feats[f"alarm_{code}"] = 1.0 if record.arrhythmia == code else 0.0

    return feats
