"""Freeze the FINAL engine (RF+CNN ensemble) and report corrected, same-protocol numbers.

Steps:
  1. Leak-free, SAME-PROTOCOL evaluation of RF, CNN, and the ensemble: in-distribution
     5-fold CV and Leave-One-Arrhythmia-Out. Every model's KEEP threshold is chosen on a
     validation split held out from training, never on the fold being scored.
  2. Safety operating point for each model at the >=99% true-alarm sensitivity floor
     (thresholds calibrated on the leak-free out-of-fold ensemble probabilities).
  3. Freeze: train RF + CNN on all 750 records, attach the calibrated safety thresholds,
     serialize to data/processed/models/, and verify the product entry point on one record.

Headline metric = challenge score (TP+TN)/(TP+TN+FP+5*FN); true-alarm sensitivity co-reported.
All numbers are 5-fold CV / held-out-arrhythmia on the 750 public CinC-2015 records.

Usage: python scripts/05_freeze_ensemble.py [--rebuild]
"""
from __future__ import annotations
import argparse
import warnings
import numpy as np
import pandas as pd

from silentguard.config import load_config, resolve
from silentguard.models import ensemble, safety
from silentguard.models.cnn import build_waveform_tensor
from silentguard.data.io import load_challenge2015_record
from silentguard.explain.explain import calibration_curve_ece

warnings.filterwarnings("ignore")
ORDER = ["ASYSTOLE", "BRADY", "TACHY", "VTACH", "VFIB"]
LABELS = {"rf": "RandomForest", "cnn": "1D-CNN", "ens": "RF+CNN ensemble"}


def _fmt(v, nd=3):
    return " nan" if v is None or (isinstance(v, float) and np.isnan(v)) else f"{v:.{nd}f}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rebuild", action="store_true")
    args = ap.parse_args()
    cfg = load_config()

    # ---- data (features for RF, waveform for CNN; identical record order) ----
    fcache = resolve(cfg["paths"]["interim"]) / "challenge2015_features.csv"
    if not fcache.exists():
        raise SystemExit("Run scripts/02_train_baseline.py first (feature cache missing).")
    df = pd.read_csv(fcache); df = df[df["label"].notna()].reset_index(drop=True)
    feat_cols = [c for c in df.columns if c not in ("record_id", "arrhythmia", "label")]
    onehot = [c for c in feat_cols if c.startswith("alarm_")]
    phys_cols = [c for c in feat_cols if c not in onehot]
    Xf = df[feat_cols].to_numpy(float)         # all features: in-distribution + deployed model
    Xf_phys = df[phys_cols].to_numpy(float)    # physiological only: LOAO (one-hot is degenerate
                                               # for an unseen arrhythmia type)
    y = df["label"].to_numpy(int); groups = df["arrhythmia"].to_numpy()
    Xw, yw, gw, ids = build_waveform_tensor(cfg, rebuild=args.rebuild)
    assert np.array_equal(y, yw), "feature/waveform record order mismatch"
    print(f"{len(df)} records ({int((y==1).sum())} true / {int((y==0).sum())} false) | "
          f"features {Xf.shape[1]} (LOAO uses {Xf_phys.shape[1]} physiological) | waveform {Xw.shape}")

    # ---- 1. leak-free, same-protocol evaluation ----
    print("\nRunning leak-free joint 5-fold CV (RF/CNN/ensemble) ...")
    cv = ensemble.joint_cross_validate(Xf, Xw, y, cfg, groups=groups)
    print("Running leak-free joint LOAO (physiological features) ...")
    lo = ensemble.joint_loao(Xf_phys, Xw, y, groups, cfg)

    print("\n" + "=" * 74)
    print("A) IN-DISTRIBUTION 5-fold CV  (ALL ROWS SAME PROTOCOL: threshold on a")
    print("   validation split of the training fold, applied to the untouched test fold)")
    print("=" * 74)
    print(f"   {'model':16s} {'score':>7s} {'true-sens':>10s} {'spec':>7s} {'AUROC':>7s}")
    for k in ("rf", "cnn", "ens"):
        m = cv[k]["metrics"]
        print(f"   {LABELS[k]:16s} {_fmt(m['challenge_score']):>7s} {_fmt(m['sensitivity']):>10s} "
              f"{_fmt(m['specificity']):>7s} {_fmt(m['auroc']):>7s}")

    print("\n" + "=" * 74)
    print("B) LEAVE-ONE-ARRHYTHMIA-OUT  (same protocol; threshold from TRAINING types only)")
    print("=" * 74)
    print(f"   {'model':16s} {'POOLED':>7s} {'sens':>6s} | " + " ".join(f"{c[:4]:>6s}" for c in ORDER))
    for k in ("rf", "cnn", "ens"):
        p = lo[k]["pooled"]; pg = lo[k]["per_group"]
        cells = [_fmt(pg[c]["challenge_score"], 2) if c in pg else "   -" for c in ORDER]
        print(f"   {LABELS[k]:16s} {_fmt(p['challenge_score']):>7s} {_fmt(p['sensitivity'],2):>6s} | "
              + " ".join(f"{c:>6s}" for c in cells))

    # ---- 2. safety operating point (thresholds calibrated on leak-free ensemble OOF) ----
    floor = cfg["safety"]["min_true_sensitivity"]
    print("\n" + "=" * 74)
    print(f"C) SAFETY LAYER @ true-sens >= {floor}  (thresholds on each model's leak-free OOF)")
    print("=" * 74)
    print(f"   {'model':16s} {'true-sens':>10s} {'FA-suppress':>12s} {'defer-rate':>11s} {'K/S/D':>14s}")
    ens_report = None
    for k in ("rf", "cnn", "ens"):
        pf = 1.0 - cv[k]["oof_proba"]
        th = safety.calibrate_thresholds(pf, y, cfg)
        rep = safety.safety_report(pf, y, th["t_high"], th["t_low"])
        if k == "ens":
            ens_report, ens_thr = rep, th
        print(f"   {LABELS[k]:16s} {_fmt(rep['true_alarm_sensitivity']):>10s} "
              f"{_fmt(rep['false_alarm_suppression']):>12s} {_fmt(rep['defer_rate']):>11s} "
              f"{str(rep['n_keep'])+'/'+str(rep['n_suppress'])+'/'+str(rep['n_defer']):>14s}")
    ece = calibration_curve_ece(y, cv["ens"]["oof_proba"], 10)["ece"]
    print(f"   ensemble calibration ECE: {_fmt(ece)}")

    # ---- 3. freeze the final ensemble with the ensemble safety thresholds ----
    print("\nFreezing final RF+CNN ensemble (trained on all 750) ...")
    frozen = ensemble.fit_final_ensemble(Xf, Xw, y, cfg, feat_cols,
                                         ens_thr["t_high"], ens_thr["t_low"])
    model_dir = resolve(cfg["paths"]["artifacts"]) / "ensemble"
    frozen.save(model_dir)
    print(f"Saved frozen ensemble -> {model_dir}")

    # ---- verify the product entry point on one record ----
    loaded = ensemble.FrozenEnsemble.load(model_dir, cfg)
    stem = str(resolve(cfg["paths"]["challenge_2015"]) / "training" / df["record_id"][0])
    rec = load_challenge2015_record(stem)
    out = loaded.predict_one(rec)
    print("\n" + "=" * 74)
    print("D) FROZEN INFERENCE ENTRY POINT — verified on one record")
    print("=" * 74)
    print(f"   record {out['record_id']} | alarm={out['arrhythmia']}")
    print(f"   p_false={_fmt(out['p_false'],3)}  decision={out['decision'].upper()}  "
          f"confidence={_fmt(out['confidence'],3)}  latency_used_s={out['latency_used_s']}")
    print("   top reasons (SHAP toward TRUE; negative => toward suppress):")
    for r in out["reasons"]:
        print(f"      {r['feature']:22s} {r['contribution_to_true']:+.4f}")

    # ---- save corrected results ----
    rows = []
    for k in ("rf", "cnn", "ens"):
        m = cv[k]["metrics"]; p = lo[k]["pooled"]
        pf = 1.0 - cv[k]["oof_proba"]; th = safety.calibrate_thresholds(pf, y, cfg)
        rep = safety.safety_report(pf, y, th["t_high"], th["t_low"])
        rows.append({"model": LABELS[k], "protocol": "leak-free val-split threshold",
                     "indist_score": m["challenge_score"], "indist_sens": m["sensitivity"],
                     "indist_auroc": m["auroc"], "loao_pooled_score": p["challenge_score"],
                     "loao_pooled_sens": p["sensitivity"],
                     "safety_true_sens": rep["true_alarm_sensitivity"],
                     "safety_fa_suppression": rep["false_alarm_suppression"],
                     "safety_defer_rate": rep["defer_rate"]})
    out_csv = resolve(cfg["paths"]["processed"]) / "final_ensemble_results.csv"
    pd.DataFrame(rows).to_csv(out_csv, index=False)
    print(f"\nSaved corrected results -> {out_csv}")
    print("All rows use the identical leak-free protocol. 5-fold CV / held-out-arrhythmia on "
          "the 750 PUBLIC CinC-2015 records.")


if __name__ == "__main__":
    main()
