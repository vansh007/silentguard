"""Sanity check: load ONE record, print its header/channels/label, summarize signals.

Run after downloading data (see DATASETS.md). This is build-order step 1 and it also
shows exactly where the true/false label lives in the CinC-2015 header:
    rec.comments == ['<ArrhythmiaType>', '<True alarm|False alarm>']

Usage: python scripts/01_explore_record.py [record_id]   (default: a103l)
"""
from __future__ import annotations
import sys
import numpy as np

from silentguard.config import load_config, resolve
from silentguard.data.io import load_challenge2015_record


def main():
    try:
        import wfdb  # noqa: F401
    except ImportError:
        sys.exit("pip install -r requirements.txt first")

    rid = sys.argv[1] if len(sys.argv) > 1 else "a103l"
    cfg = load_config()
    training_dir = resolve(cfg["paths"]["challenge_2015"]) / "training"
    stem = str(training_dir / rid)

    import wfdb
    raw = wfdb.rdrecord(stem)
    print(f"=== raw header for {rid} ===")
    print(" channels :", raw.sig_name)
    print(" fs       :", raw.fs, "Hz")
    print(" shape    :", raw.p_signal.shape)
    print(" comments :", raw.comments, "  <- label lives here")

    rec = load_challenge2015_record(stem)
    print(f"\n=== parsed AlarmRecord ===")
    print(" record_id   :", rec.record_id)
    print(" arrhythmia  :", rec.arrhythmia)
    print(" label       :", rec.label, "(1=TRUE alarm, 0=FALSE alarm)")
    print(" ecg leads   :", rec.ecg_leads())
    pulse = rec.pulse_channel()
    print(" pulse chan  :", pulse[0] if pulse else None)
    print(" alarm sample:", rec.alarm_sample, f"(t={rec.alarm_sample/rec.fs:.0f}s)")
    ecg = rec.primary_ecg()
    if ecg is not None:
        w = rec.window(cfg["signal"]["window_seconds"], ecg)
        print(f" 16s ECG win : len={len(w)} range=[{np.nanmin(w):.2f}, {np.nanmax(w):.2f}]")


if __name__ == "__main__":
    main()
