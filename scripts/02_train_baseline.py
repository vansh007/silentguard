"""End-to-end baseline runner (Review-1 target): load -> features -> RF/XGB -> 5-fold CV.

Runs the whole classical pipeline on all 750 public CinC-2015 records and prints a
results table (overall + per-arrhythmia) for RandomForest and XGBoost. Headline metric
is the asymmetric challenge score; true-alarm sensitivity is reported alongside.

The feature matrix is cached to data/interim/ so re-runs skip re-extraction. Pass
--rebuild to force recomputation.

Usage:
    python scripts/02_train_baseline.py [--rebuild] [--limit N]
"""
from __future__ import annotations
import argparse
import sys
import time
import numpy as np
import pandas as pd

from silentguard.config import load_config, resolve
from silentguard.data.io import load_challenge2015_record, list_challenge2015_records
from silentguard.features.waveform_features import extract_feature_vector
from silentguard.models.baseline import cross_validate


def build_feature_table(cfg: dict, limit: int | None = None, rebuild: bool = False) -> pd.DataFrame:
    """Extract features for all training records into a DataFrame (cached to interim/)."""
    cache = resolve(cfg["paths"]["interim"]) / "challenge2015_features.csv"
    if cache.exists() and not rebuild and limit is None:
        print(f"Loading cached features: {cache}")
        return pd.read_csv(cache)

    training_dir = resolve(cfg["paths"]["challenge_2015"]) / "training"
    stems = list_challenge2015_records(training_dir)
    if limit:
        stems = stems[:limit]
    print(f"Extracting features from {len(stems)} records ...")

    rows = []
    t0 = time.time()
    for i, stem in enumerate(stems, 1):
        try:
            rec = load_challenge2015_record(stem)
            feats = extract_feature_vector(rec, cfg)
            feats["record_id"] = rec.record_id
            feats["arrhythmia"] = rec.arrhythmia
            feats["label"] = rec.label
            rows.append(feats)
        except Exception as e:  # never let one bad record kill the run
            print(f"  [warn] {stem}: {e}")
        if i % 50 == 0 or i == len(stems):
            print(f"  {i}/{len(stems)}  ({time.time() - t0:.0f}s)")

    df = pd.DataFrame(rows)
    if limit is None:
        cache.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(cache, index=False)
        print(f"Cached features -> {cache}")
    return df


def _feature_columns(df: pd.DataFrame) -> list[str]:
    return [c for c in df.columns if c not in ("record_id", "arrhythmia", "label")]


def _fmt(v: float, nd: int = 3) -> str:
    return "  nan" if v is None or (isinstance(v, float) and np.isnan(v)) else f"{v:.{nd}f}"


def print_results(name: str, res: dict) -> None:
    m = res["metrics"]
    print(f"\n===== {name} — 5-fold CV on 750 records (label 1=TRUE alarm) =====")
    print(f"  Challenge score (headline) : {_fmt(m['challenge_score'])}")
    print(f"  True-alarm sensitivity     : {_fmt(m['sensitivity'])}   <- keep near 1.0")
    print(f"  Specificity (FA suppressed): {_fmt(m['specificity'])}")
    print(f"  PPV                        : {_fmt(m['ppv'])}")
    print(f"  ROC-AUC                    : {_fmt(m['auroc'])}")
    print(f"  Confusion (TP,TN,FP,FN)    : {m['tp']}, {m['tn']}, {m['fp']}, {m['fn']}")
    print(f"  Mean operating threshold   : {_fmt(res['mean_threshold'])}")

    if "per_arrhythmia" in res:
        print(f"\n  Per-arrhythmia breakdown:")
        print(f"    {'type':10s} {'n':>4s} {'true':>5s} {'false':>6s} "
              f"{'score':>7s} {'sens':>6s} {'auroc':>7s}")
        order = ["ASYSTOLE", "BRADY", "TACHY", "VTACH", "VFIB"]
        per = res["per_arrhythmia"]
        for code in [c for c in order if c in per] + [c for c in per if c not in order]:
            r = per[code]
            print(f"    {code:10s} {r['n']:>4d} {r['n_true']:>5d} {r['n_false']:>6d} "
                  f"{_fmt(r['challenge_score']):>7s} {_fmt(r['sensitivity'],2):>6s} "
                  f"{_fmt(r['auroc']):>7s}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rebuild", action="store_true", help="force feature re-extraction")
    ap.add_argument("--limit", type=int, default=None, help="use only the first N records (debug)")
    args = ap.parse_args()

    cfg = load_config()
    print("Loaded config. fs =", cfg["signal"]["fs"], "| window_s =", cfg["signal"]["window_seconds"])

    df = build_feature_table(cfg, limit=args.limit, rebuild=args.rebuild)
    df = df[df["label"].notna()].reset_index(drop=True)
    feat_cols = _feature_columns(df)
    X = df[feat_cols].to_numpy(dtype=float)
    y = df["label"].to_numpy(dtype=int)
    groups = df["arrhythmia"].to_numpy()

    print(f"\nFeature matrix: X={X.shape}, {int((y==1).sum())} true / {int((y==0).sum())} false alarms")
    print(f"Features ({len(feat_cols)}): {', '.join(feat_cols)}")

    results = {}
    for kind, name in [("rf", "RandomForest"), ("xgb", "XGBoost")]:
        try:
            results[kind] = cross_validate(X, y, cfg, kind=kind, groups=groups)
            print_results(name, results[kind])
        except Exception as e:
            print(f"\n[error] {name} failed: {e}")

    # Save a compact summary CSV for the record (Definition of Done).
    out = resolve(cfg["paths"]["processed"]) / "baseline_cv_results.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    for kind, res in results.items():
        m = res["metrics"]
        rows.append({"model": kind, "challenge_score": m["challenge_score"],
                     "sensitivity": m["sensitivity"], "specificity": m["specificity"],
                     "ppv": m["ppv"], "auroc": m["auroc"],
                     "tp": m["tp"], "tn": m["tn"], "fp": m["fp"], "fn": m["fn"],
                     "n_records": m["n"], "split": "5-fold CV (750 public records)"})
    if rows:
        pd.DataFrame(rows).to_csv(out, index=False)
        print(f"\nSaved summary -> {out}")

    print("\nNote: the 500-record CinC-2015 test set is hidden; all numbers above are")
    print("5-fold cross-validation on the 750 PUBLIC records (no official leaderboard).")


if __name__ == "__main__":
    main()
