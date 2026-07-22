"""Smoke tests for the service/ real-engine layer.

Skipped unless torch, the frozen ensemble, and the CinC-2015 records are all present — the
service serves only REAL data, so there is nothing meaningful to test without them.
"""
import importlib.util
import pytest

from silentguard.config import load_config, resolve

cfg = load_config()
_HAVE = (
    importlib.util.find_spec("torch") is not None
    and (resolve(cfg["paths"]["artifacts"]) / "ensemble" / "ensemble_meta.json").exists()
    and (resolve(cfg["paths"]["challenge_2015"]) / "training").exists()
)
pytestmark = pytest.mark.skipif(not _HAVE, reason="need torch + frozen model + dataset")

DEMO = "a163l"  # known FALSE asystole alarm (beats present)


def test_engine_returns_real_verdict():
    from service import engine
    out = engine.analyze(DEMO)
    assert out["decision"] in ("suppress", "keep", "defer")
    assert 0.0 <= out["p_false"] <= 1.0
    assert abs(out["p_true"] + out["p_false"] - 1.0) < 1e-6
    assert 0.5 <= out["confidence"] <= 1.0
    assert out["true_label"] in (0, 1)
    assert isinstance(out["reasons"], list) and len(out["reasons"]) >= 1
    # a163l is a false alarm with beats present -> the engine should not KEEP it.
    assert out["decision"] != "keep"


def test_engine_waveform_has_real_samples_and_beats():
    from service import engine
    dw = engine.display_window(DEMO, seconds=8.0)
    assert dw["fs"] == cfg["signal"]["fs"]
    assert len(dw["samples"]) == int(8.0 * dw["fs"])
    assert isinstance(dw["beats"], list)          # real QRS detections
    assert dw["channel"] in ("II", "V", "III", "MCL", "I")


def test_demo_records_all_resolve():
    from service import engine
    for r in engine.DEMO_RECORDS:
        meta = engine.record_meta(r["id"])
        assert meta["arrhythmia"] in ("ASYSTOLE", "BRADY", "TACHY", "VTACH", "VFIB")
        assert meta["true_label"] in (0, 1)
