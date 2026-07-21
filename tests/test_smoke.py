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
