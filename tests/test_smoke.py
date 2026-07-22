"""Smoke tests — grow these as modules get implemented."""
import numpy as np


def test_config_loads():
    from silentguard.config import load_config
    cfg = load_config()
    assert cfg["signal"]["fs"] == 250
    assert cfg["eval"]["fn_penalty"] == 5


def test_challenge_score_hand_checked():
    """Hand-worked example for (TP+TN)/(TP+TN+FP+5*FN).

    y_true = [1,1,1,0,0,0], keep = [1,0,1,0,1,0]
      idx0: true, kept   -> TP
      idx1: true, suppr. -> FN   (the costly one)
      idx2: true, kept   -> TP
      idx3: false, suppr.-> TN
      idx4: false, kept  -> FP
      idx5: false, suppr.-> TN
    TP=2, TN=2, FP=1, FN=1 -> (2+2)/(2+2+1+5*1) = 4/10 = 0.4
    """
    from silentguard.evaluation.metrics import challenge_score, confusion_counts
    y_true = np.array([1, 1, 1, 0, 0, 0])
    keep = np.array([1, 0, 1, 0, 1, 0])
    assert confusion_counts(y_true, keep) == (2, 2, 1, 1)
    assert abs(challenge_score(y_true, keep) - 0.4) < 1e-12


def test_challenge_score_extremes():
    from silentguard.evaluation.metrics import challenge_score
    y = np.array([1, 1, 0, 0])
    assert challenge_score(y, y) == 1.0                       # perfect
    # Suppress everything: TP=0,TN=2,FP=0,FN=2 -> 2/(2+10)=1/6
    assert abs(challenge_score(y, np.zeros_like(y)) - (2 / 12)) < 1e-12


def test_fn_penalized_more_than_fp():
    """One FN must hurt the score more than one FP (the asymmetry)."""
    from silentguard.evaluation.metrics import challenge_score
    y = np.array([1, 0])
    score_one_fn = challenge_score(y, np.array([0, 0]))   # suppress the true alarm
    score_one_fp = challenge_score(y, np.array([1, 1]))   # keep the false alarm
    assert score_one_fn < score_one_fp


def test_full_metrics_keys_and_sensitivity():
    from silentguard.evaluation.metrics import full_metrics
    y = np.array([1, 1, 0, 0])
    score = np.array([0.9, 0.4, 0.2, 0.8])   # thr 0.5 -> keep [1,0,0,1]
    m = full_metrics(y, score, threshold=0.5)
    for k in ("challenge_score", "auroc", "sensitivity", "specificity", "ppv"):
        assert k in m
    assert abs(m["sensitivity"] - 0.5) < 1e-9   # 1 of 2 true alarms kept


def test_filters_handle_nan_and_short():
    from silentguard.preprocessing.filters import bandpass, remove_baseline_wander, normalize
    fs = 250
    x = np.concatenate([np.sin(np.linspace(0, 20, fs * 4)), [np.nan] * 5])
    for fn in (lambda s: bandpass(s, fs), lambda s: remove_baseline_wander(s, fs), normalize):
        out = fn(x)
        assert np.all(np.isfinite(out))
        assert len(out) == len(x)
    assert np.all(np.isfinite(normalize(np.zeros(100))))   # flat signal -> no div-by-zero


def test_hr_features_empty_beats():
    from silentguard.features.waveform_features import hr_features
    m = hr_features(np.array([]), 250)
    assert m["n_beats"] == 0.0
    assert np.isnan(m["hr_mean"])


def test_cross_signal_agreement_bounds():
    from silentguard.features.waveform_features import cross_signal_agreement
    same = cross_signal_agreement(80.0, 80.0)
    assert abs(same["hr_pulse_agreement"] - 1.0) < 1e-9
    far = cross_signal_agreement(40.0, 160.0)
    assert far["hr_pulse_agreement"] < same["hr_pulse_agreement"]


def test_select_threshold_prefers_low_under_asymmetry():
    """With a 5x FN penalty and separable scores, the keep threshold should be low
    enough to keep every true alarm (Bayes-optimal keep threshold ~1/6)."""
    from silentguard.models.baseline import select_threshold
    from silentguard.evaluation.metrics import challenge_score
    rng = np.random.default_rng(0)
    y = np.array([1] * 30 + [0] * 70)
    proba = np.concatenate([rng.uniform(0.4, 1.0, 30), rng.uniform(0.0, 0.6, 70)])
    thr = select_threshold(y, proba, fn_penalty=5)
    keep = (proba >= thr).astype(int)
    # score at chosen threshold beats naive 0.5
    assert challenge_score(y, keep) >= challenge_score(y, (proba >= 0.5).astype(int))
    assert 0.0 <= thr <= 0.6


def test_cross_validate_runs_small():
    """cross_validate returns the documented keys on a tiny synthetic dataset."""
    from silentguard.config import load_config
    from silentguard.models.baseline import cross_validate
    cfg = load_config()
    rng = np.random.default_rng(1)
    n = 60
    y = np.array([1, 0] * (n // 2))
    X = rng.normal(size=(n, 5)) + y[:, None]  # class-dependent signal
    groups = np.array(["VTACH", "BRADY"] * (n // 2))
    res = cross_validate(X, y, cfg, kind="rf", groups=groups)
    assert set(res).issuperset({"metrics", "oof_proba", "per_arrhythmia"})
    m = res["metrics"]
    assert 0.0 <= m["challenge_score"] <= 1.0
    assert 0.0 <= m["sensitivity"] <= 1.0


def test_loao_runs_and_holds_out_each_group():
    """LOAO evaluates every arrhythmia as an unseen held-out type."""
    from silentguard.config import load_config
    from silentguard.models.domain import leave_one_arrhythmia_out
    cfg = load_config()
    rng = np.random.default_rng(2)
    codes = ["ASYSTOLE", "BRADY", "TACHY", "VTACH", "VFIB"]
    groups = np.repeat(codes, 24)
    y = rng.integers(0, 2, size=len(groups))
    X = rng.normal(size=(len(groups), 6)) + y[:, None] * 0.5
    res = leave_one_arrhythmia_out(X, y, groups, cfg, kind="rf")
    assert set(res["per_group"]) == set(codes)     # each type held out exactly once
    for m in res["per_group"].values():
        assert 0.0 <= m["challenge_score"] <= 1.0
    assert 0.0 <= res["pooled"]["challenge_score"] <= 1.0


def test_loso_not_feasible():
    from silentguard.models.domain import leave_one_source_out, source_tags_available
    assert source_tags_available(None) is False
    r = leave_one_source_out()
    assert r["feasible"] is False and "no" in r["reason"].lower()


def test_safety_decide_zones_and_floor():
    """SUPPRESS/KEEP/DEFER map correctly, and calibration meets the sensitivity floor."""
    from silentguard.models.safety import decide, Decision, calibrate_thresholds, safety_report
    assert decide(0.95, 0.9, 0.1) == Decision.SUPPRESS
    assert decide(0.05, 0.9, 0.1) == Decision.KEEP
    assert decide(0.50, 0.9, 0.1) == Decision.DEFER
    rng = np.random.default_rng(3)
    y = np.array([1] * 100 + [0] * 100)
    # true alarms tend low p_false, false alarms tend high — with overlap
    p_false = np.concatenate([rng.uniform(0.0, 0.7, 100), rng.uniform(0.3, 1.0, 100)])
    cfg = {"safety": {"min_true_sensitivity": 0.99}}
    th = calibrate_thresholds(p_false, y, cfg)
    assert th["t_low"] <= th["t_high"]
    rep = safety_report(p_false, y, th["t_high"], th["t_low"])
    assert rep["true_alarm_sensitivity"] >= 0.99 - 1e-9   # floor enforced on validation


def test_choose_latency_stops_when_confident():
    from silentguard.models.safety import choose_latency
    # p_false crosses t_high at t=8s -> should stop there, not wait 30
    seq = [(0, 0.5), (4, 0.6), (8, 0.95), (12, 0.97)]
    assert choose_latency(seq, t_high=0.9, t_low=0.1, max_wait_s=30) == 8
    # never confident -> waits to max
    seq2 = [(0, 0.5), (10, 0.5), (30, 0.5)]
    assert choose_latency(seq2, t_high=0.9, t_low=0.1, max_wait_s=30) == 30


def test_calibration_ece_bounds():
    from silentguard.explain.explain import calibration_curve_ece
    y = np.array([1, 1, 0, 0, 1, 0])
    p = np.array([0.9, 0.8, 0.1, 0.2, 0.6, 0.4])
    out = calibration_curve_ece(y, p, n_bins=5)
    assert 0.0 <= out["ece"] <= 1.0
    assert len(out["bin_centers"]) == 5


def test_deep_model_trains_and_predicts():
    """CNN + attention models build, train a few epochs, and expose attention weights."""
    torch = __import__("importlib").util.find_spec("torch")
    if torch is None:
        import pytest
        pytest.skip("torch not installed")
    import numpy as np
    from silentguard.config import load_config
    from silentguard.models.cnn import train_deep, predict_proba_deep, attention_weights
    cfg = load_config()
    rng = np.random.default_rng(0)
    n, C, T = 48, 3, 500
    y = np.array([1, 0] * (n // 2))
    # class-dependent bump so the tiny net has something to learn
    X = rng.normal(size=(n, C, T)).astype("float32")
    X[y == 1, 0, 100:150] += 3.0
    for arch in ("cnn", "attn"):
        model, val_p = train_deep(X[:32], y[:32], X[32:], y[32:], cfg, arch=arch, max_epochs=3, patience=3)
        p = predict_proba_deep(model, X)
        assert p.shape == (n,) and np.all((p >= 0) & (p <= 1))
    aw = attention_weights(model, X[0])       # attn model from the loop
    assert aw is not None and abs(float(aw.sum()) - 1.0) < 1e-4


def test_frozen_ensemble_entry_point():
    """FrozenEnsemble.predict_one returns the product decision bundle; save/load round-trips."""
    import importlib
    if importlib.util.find_spec("torch") is None:
        import pytest
        pytest.skip("torch not installed")
    import tempfile
    import numpy as np
    from silentguard.config import load_config
    from silentguard.data.io import AlarmRecord
    from silentguard.features.waveform_features import extract_feature_vector
    from silentguard.models.baseline import build_model
    from silentguard.models.cnn import make_model
    from silentguard.models.ensemble import FrozenEnsemble
    cfg = load_config()
    fs = cfg["signal"]["fs"]
    rng = np.random.default_rng(0)
    sig = rng.standard_normal(fs * 330).astype(float)
    rec = AlarmRecord(record_id="synthetic", fs=fs,
                      signals={"II": sig, "V": sig * 0.5, "PLETH": rng.standard_normal(fs * 330)},
                      arrhythmia="ASYSTOLE", label=None, dataset="challenge-2015",
                      alarm_sample=fs * 300)
    names = list(extract_feature_vector(rec, cfg).keys())
    rf = build_model("rf", cfg).fit(rng.normal(size=(40, len(names))), np.array([0, 1] * 20))
    cnn_state = {k: v.clone() for k, v in make_model("cnn", 3).state_dict().items()}
    frozen = FrozenEnsemble(rf, cnn_state, 3, names, t_high=0.9, t_low=0.1, cfg=cfg)

    out = frozen.predict_one(rec)
    assert set(out) >= {"p_false", "p_true", "decision", "confidence", "reasons", "latency_used_s"}
    assert 0.0 <= out["p_false"] <= 1.0 and abs(out["p_true"] + out["p_false"] - 1.0) < 1e-6
    assert out["decision"] in ("suppress", "keep", "defer")
    assert 0.5 <= out["confidence"] <= 1.0
    assert out["latency_used_s"] >= 0.0
    assert len(out["reasons"]) >= 1 and "feature" in out["reasons"][0]

    with tempfile.TemporaryDirectory() as d:
        frozen.save(d)
        reloaded = FrozenEnsemble.load(d, cfg)
        out2 = reloaded.predict_one(rec)
        assert abs(out2["p_false"] - out["p_false"]) < 1e-6   # deterministic round-trip


def test_waveform_tensor_shape_if_data_present():
    """If the dataset is present, the waveform tensor has the right shape and is bounded."""
    from pathlib import Path
    from silentguard.config import load_config, resolve
    cfg = load_config()
    if not (resolve(cfg["paths"]["challenge_2015"]) / "training").exists():
        import pytest
        pytest.skip("dataset not present")
    from silentguard.models.cnn import build_waveform_tensor
    X, y, g, ids = build_waveform_tensor(cfg)
    T = int(cfg["signal"]["window_seconds"] * cfg["signal"]["fs"])
    assert X.shape[1] == 3 and X.shape[2] == T
    assert abs(X).max() <= 8.0 + 1e-5     # clipped to a sane z-range
    assert len(y) == X.shape[0]


def test_explain_features_returns_topk():
    """explain_features returns k signed (name, value) reasons (fallback path is fine)."""
    from silentguard.config import load_config
    from silentguard.models.baseline import build_model
    from silentguard.explain.explain import explain_features
    cfg = load_config()
    rng = np.random.default_rng(4)
    names = [f"f{i}" for i in range(5)]
    y = rng.integers(0, 2, size=80)
    X = rng.normal(size=(80, 5)) + y[:, None]
    model = build_model("rf", cfg).fit(X, y)
    reasons = explain_features(model, X[0], names, k=3)
    assert len(reasons) == 3
    assert all(isinstance(n, str) for n, _ in reasons)
