"""Parse labels / splits for both datasets.

CinC-2015: label is embedded in each record's .hea comment. Confirmed format:
    comments = ['<ArrhythmiaType>', '<True alarm|False alarm>']
    e.g. ['Asystole', 'False alarm']  -> ('ASYSTOLE', 0)

VTaC: labels in event_labels.csv; official split in benchmark_data_split.csv (USE IT).
"""
from __future__ import annotations
from pathlib import Path
import pandas as pd

# Header spelling (from rec.comments) -> normalized config code (config.yaml: arrhythmias).
ARRHYTHMIA_MAP = {
    "asystole": "ASYSTOLE",
    "bradycardia": "BRADY",
    "tachycardia": "TACHY",
    "ventricular_tachycardia": "VTACH",
    "ventricular_flutter_fib": "VFIB",
}


def parse_challenge2015_comments(comments: list[str]) -> tuple[str | None, int | None]:
    """Parse (arrhythmia_code, label) from a CinC-2015 header's comment lines.

    Returns
    -------
    (arrhythmia, label) where arrhythmia is one of ASYSTOLE/BRADY/TACHY/VTACH/VFIB
    (or None if unrecognized) and label is 1 for a TRUE alarm, 0 for FALSE
    (or None if the truth line is absent, e.g. hidden test records).
    """
    arrhythmia: str | None = None
    label: int | None = None
    for raw in comments or []:
        line = raw.strip().lstrip("#").strip()
        low = line.lower()
        if low in ARRHYTHMIA_MAP:
            arrhythmia = ARRHYTHMIA_MAP[low]
        elif low.startswith("true"):
            label = 1
        elif low.startswith("false"):
            label = 0
    return arrhythmia, label


def load_vtac_labels(vtac_dir: str | Path) -> pd.DataFrame:
    """Return DataFrame with columns [record, event, decision]. Reads event_labels.csv."""
    path = Path(vtac_dir) / "event_labels.csv"
    return pd.read_csv(path)


def load_vtac_split(vtac_dir: str | Path) -> pd.DataFrame:
    """Return the official train/val/test split from benchmark_data_split.csv."""
    path = Path(vtac_dir) / "benchmark_data_split.csv"
    return pd.read_csv(path)
