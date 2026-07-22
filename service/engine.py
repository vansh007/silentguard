"""Real-engine helpers for the SilentGuard API.

Everything here is REAL: waveforms come from the CinC-2015 records, beat markers from our
QRS detector, and every verdict from the frozen RF+CNN ensemble via FrozenEnsemble.predict_one.
Nothing is hardcoded or invented. If a datum is unavailable the API returns an explicit error /
empty state rather than fabricating one.
"""
from __future__ import annotations
from functools import lru_cache
import numpy as np

from silentguard.config import load_config, resolve
from silentguard.models.ensemble import FrozenEnsemble
from silentguard.data.io import load_challenge2015_record, list_challenge2015_records
from silentguard.preprocessing.filters import remove_baseline_wander, bandpass, normalize
from silentguard.features.waveform_features import detect_beats

CFG = load_config()
_MODEL: FrozenEnsemble | None = None

# Curated demo records — each id, its true arrhythmia + label, and the REAL engine verdict
# (verified by running FrozenEnsemble.predict_one). The `note` is descriptive only; the app
# always recomputes the verdict live from the engine, it is never read from here.
DEMO_RECORDS = [
    {"id": "v338s", "note": "'VTACH!' alarm — but the rhythm is too regular to be real VT"},
    {"id": "a163l", "note": "Asystole alarm with beats clearly present"},
    {"id": "b215l", "note": "Bradycardia alarm, rate actually normal"},
    {"id": "t384s", "note": "Tachycardia alarm from artifact"},
    {"id": "v334s", "note": "Real ventricular tachycardia — must reach the nurse"},
    {"id": "t156s", "note": "Real extreme tachycardia, high confidence"},
    {"id": "a604s", "note": "Real asystole — a genuine emergency"},
    {"id": "b537l", "note": "Real bradycardia"},
    {"id": "a705l", "note": "Ambiguous asystole — engine defers to a human"},
    {"id": "f346s", "note": "Ambiguous ventricular flutter/fib — deferred"},
    {"id": "v652s", "note": "Borderline VT — deferred for review"},
]
DEMO_IDS = {r["id"] for r in DEMO_RECORDS}


def model() -> FrozenEnsemble:
    """Lazily load the frozen ensemble once (RF + CNN + safety thresholds)."""
    global _MODEL
    if _MODEL is None:
        path = resolve(CFG["paths"]["artifacts"]) / "ensemble"
        if not (path / "ensemble_meta.json").exists():
            raise FileNotFoundError(
                f"Frozen ensemble not found at {path}. Run scripts/05_freeze_ensemble.py first."
            )
        _MODEL = FrozenEnsemble.load(path, CFG)
    return _MODEL


def _record_path(rid: str) -> str:
    return str(resolve(CFG["paths"]["challenge_2015"]) / "training" / rid)


@lru_cache(maxsize=64)
def load_record(rid: str):
    """Load a CinC-2015 AlarmRecord by id (cached)."""
    from pathlib import Path
    if not Path(_record_path(rid) + ".hea").exists():
        raise FileNotFoundError(f"record {rid} not found")
    return load_challenge2015_record(_record_path(rid))


def list_available_ids() -> list[str]:
    """All record ids present on disk (for the 'browse all' case)."""
    training_dir = resolve(CFG["paths"]["challenge_2015"]) / "training"
    return [__import__("os").path.basename(s) for s in list_challenge2015_records(training_dir)]


def record_meta(rid: str) -> dict:
    rec = load_record(rid)
    fs = rec.fs
    n = len(next(iter(rec.signals.values()))) if rec.signals else 0
    return {
        "id": rid,
        "arrhythmia": rec.arrhythmia,
        "true_label": rec.label,                 # 1=TRUE, 0=FALSE (ground truth, for honesty)
        "fs": fs,
        "duration_s": round(n / fs, 1) if fs else None,
        "channels": list(rec.signals.keys()),
        "ecg_leads": rec.ecg_leads(),
        "pulse_channel": (rec.pulse_channel() or [None])[0],
        "alarm_time_s": round((rec.alarm_sample or 0) / fs, 1) if fs else None,
    }


def display_window(rid: str, channel: str | None = None, seconds: float = 24.0) -> dict:
    """The last `seconds` of a channel ending at the alarm, cleaned for display, with REAL beats.

    Returns cleaned+normalized samples (for a monitor-style trace), the QRS beat indices from
    our detector, the sampling rate, and where the engine's analysis window sits.
    """
    rec = load_record(rid)
    fs = rec.fs
    if channel and channel in rec.signals:
        sig = rec.signals[channel]
    else:
        leads = rec.ecg_leads()
        channel = leads[0] if leads else (list(rec.signals) or [None])[0]
        sig = rec.signals.get(channel) if channel else None
    if sig is None:
        return {"channel": None, "fs": fs, "samples": [], "beats": []}
    win = rec.window(seconds, sig)
    clean = normalize(bandpass(remove_baseline_wander(win, fs), fs))
    beats = detect_beats(clean, fs)
    return {
        "channel": channel,
        "fs": fs,
        "seconds": seconds,
        "samples": [round(float(x), 4) for x in clean],
        "beats": [int(b) for b in beats],           # sample indices into `samples`
        "analysis_window_s": CFG["signal"]["window_seconds"],
        "arrhythmia": rec.arrhythmia,
    }


def analyze(rid: str) -> dict:
    """Run the REAL frozen ensemble on a record and return its full decision bundle."""
    rec = load_record(rid)
    out = model().predict_one(rec)
    out["true_label"] = rec.label   # include ground truth so the UI can show honesty
    return out
