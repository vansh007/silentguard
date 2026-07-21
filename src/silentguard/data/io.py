"""WFDB record loading for both datasets. Channels vary per record — degrade gracefully.

Implements build-order step 1. See DATASETS.md for on-disk layout.

CinC-2015 header format (confirmed by printing rec.comments):
    comments = ['<ArrhythmiaType>', '<True alarm|False alarm>']
    e.g. ['Asystole', 'False alarm']
Signals are stored as .mat (WFDB) at 250 Hz. The alarm event is at t = 300 s
(sample index 300 * fs). '...l' records include 30 s AFTER the alarm; '...s'
records end at the alarm. We only ever use data up to the alarm (real-time).
"""
from __future__ import annotations
from pathlib import Path
from dataclasses import dataclass, field
import glob
import numpy as np

from .labels import parse_challenge2015_comments

# Channel roles. ECG leads are any of these standard names; pulsatile channels
# are ABP (arterial line) and PLETH (PPG). RESP is respiration (unused for now).
_ECG_LEADS = {"I", "II", "III", "V", "MCL", "AVR", "AVL", "AVF"}
_PULSE_ABP = {"ABP"}
_PULSE_PPG = {"PLETH", "PPG"}

ALARM_TIME_S = 300  # the alarm fires 5 minutes into every record


@dataclass
class AlarmRecord:
    record_id: str
    fs: int
    signals: dict[str, np.ndarray]   # channel name -> 1D array (e.g. {"II": ..., "ABP": ...})
    arrhythmia: str | None           # ASYSTOLE / BRADY / TACHY / VTACH / VFIB
    label: int | None                # 1 = true alarm, 0 = false alarm (None if unknown/test)
    dataset: str                     # "challenge-2015" or "vtac"
    alarm_sample: int | None = None  # sample index of the alarm onset (end of real-time window)
    meta: dict = field(default_factory=dict)

    # --- convenience accessors that degrade gracefully when channels are missing ---
    def ecg_leads(self) -> list[str]:
        """Names of available ECG channels, lead II first if present."""
        leads = [c for c in self.signals if c.upper() in _ECG_LEADS]
        leads.sort(key=lambda c: (c.upper() != "II", c))  # II first, then alphabetical
        return leads

    def primary_ecg(self) -> np.ndarray | None:
        """Best available ECG channel (prefers lead II), or None."""
        leads = self.ecg_leads()
        return self.signals[leads[0]] if leads else None

    def pulse_channel(self) -> tuple[str, np.ndarray] | None:
        """Best pulsatile channel as (name, array). Prefers ABP over PLETH; None if neither."""
        for c in self.signals:
            if c.upper() in _PULSE_ABP:
                return c, self.signals[c]
        for c in self.signals:
            if c.upper() in _PULSE_PPG:
                return c, self.signals[c]
        return None

    def window(self, seconds: float, sig: np.ndarray) -> np.ndarray:
        """Return the last ``seconds`` of ``sig`` ending at the alarm (real-time window)."""
        end = self.alarm_sample if self.alarm_sample is not None else len(sig)
        end = min(end, len(sig))
        start = max(0, end - int(round(seconds * self.fs)))
        return sig[start:end]


def load_challenge2015_record(record_path: str | Path) -> AlarmRecord:
    """Load one CinC-2015 record into an AlarmRecord.

    ``record_path`` is the record stem (no extension), e.g.
    ``data/raw/challenge-2015/training/a103l``.
    """
    import wfdb

    record_path = str(record_path)
    if record_path.endswith((".hea", ".mat", ".dat")):
        record_path = record_path.rsplit(".", 1)[0]

    rec = wfdb.rdrecord(record_path)
    fs = int(rec.fs)
    sig = np.asarray(rec.p_signal, dtype=float)  # shape (n_samples, n_channels)

    signals: dict[str, np.ndarray] = {}
    for i, name in enumerate(rec.sig_name):
        signals[name] = sig[:, i]

    arrhythmia, label = parse_challenge2015_comments(rec.comments)

    return AlarmRecord(
        record_id=Path(record_path).name,
        fs=fs,
        signals=signals,
        arrhythmia=arrhythmia,
        label=label,
        dataset="challenge-2015",
        alarm_sample=min(int(ALARM_TIME_S * fs), sig.shape[0]),
        meta={"sig_name": list(rec.sig_name), "units": list(rec.units)},
    )


def list_challenge2015_records(training_dir: str | Path) -> list[str]:
    """Return sorted record stems (paths without extension) under ``training_dir``."""
    stems = sorted(p[:-4] for p in glob.glob(str(Path(training_dir) / "*.hea")))
    return stems


def load_vtac_record(record_path: str | Path, label: int | None = None) -> AlarmRecord:
    """Load one VTaC record. Labels come from event_labels.csv, not the header.

    (Stubbed for a later session — VTaC is out of scope this session.)
    """
    import wfdb

    record_path = str(record_path)
    if record_path.endswith((".hea", ".mat", ".dat")):
        record_path = record_path.rsplit(".", 1)[0]
    rec = wfdb.rdrecord(record_path)
    fs = int(rec.fs)
    sig = np.asarray(rec.p_signal, dtype=float)
    signals = {name: sig[:, i] for i, name in enumerate(rec.sig_name)}
    # VTaC: 6-min segment, alarm at 5 min (300 s).
    return AlarmRecord(
        record_id=Path(record_path).name,
        fs=fs,
        signals=signals,
        arrhythmia="VTACH",
        label=label,
        dataset="vtac",
        alarm_sample=min(int(ALARM_TIME_S * fs), sig.shape[0]),
        meta={"sig_name": list(rec.sig_name)},
    )
