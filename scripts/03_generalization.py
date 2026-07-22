"""Generalization + safety + trust demonstration (Reviews 2-3).

Runs, on the 750 public CinC-2015 records (single dataset; label 1 = TRUE alarm):

  1. In-distribution 5-fold CV baseline (E1) — the reference point.
  2. Leave-One-Arrhythmia-Out (LOAO, C1, headline) — train on four arrhythmia types,
     test zero-shot on the held-out fifth; per-type score/sensitivity/AUROC and the
     generalization GAP vs the in-distribution baseline.
  3. Leave-One-Source-Out (LOSO, C1b) — reports NOT feasible (no source tags).
  4. Safety layer operating point (C2) — SUPPRESS/KEEP/DEFER at the true-alarm
     sensitivity floor, with leak-free per-fold threshold calibration.
  5. One example explanation (C3) — a suppressed alarm with its top SHAP reasons.

Headline metric = challenge score (TP+TN)/(TP+TN+FP+5*FN); true-alarm sensitivity is
always co-reported. All numbers are 5-fold CV / held-out-arrhythmia on the 750 public
records (the 500-record test set is hidden).

Methodology note: LOAO uses PHYSIOLOGICAL features only. The alarm-type one-hot
(alarm_ASYSTOLE ...) is excluded there because, for a held-out type, its column is
constant in training and out-of-distribution at test — it carries no learnable signal
for an unseen arrhythmia and only injects noise. The in-distribution baseline (which the
monitor's known alarm type legitimately informs) keeps all features.

Usage: python scripts/03_generalization.py [--model rf|xgb] [--rebuild]
"""
from __future__ import annotations
import argparse
import warnings
import numpy as np
import pandas as pd

from silentguard.config import load_config, resolve
from silentguard.models.baseline import build_model, cross_validate
from silentguard.models import domain, safety
from silentguard.explain.explain import explain_features, calibration_curve_ece

warnings.filterwarnings("ignore")


def _fmt(v, nd=3):
    return "  nan" if v is None or (isinstance(v, float) and np.isnan(v)) else f"{v:.{nd}f}"


def load_features(cfg, rebuild=False) -> pd.DataFrame:
    cache = resolve(cfg["paths"]["interim"]) / "challenge2015_features.csv"
    if not cache.exists() or rebuild:
        raise SystemExit("Feature cache missing. Run scripts/02_train_baseline.py first "
                         "to build data/interim/challenge2015_features.csv.")
    df = pd.read_csv(cache)
    return df[df["label"].notna()].reset_index(drop=True)


def safety_operating_point(oof_ptrue, y, cfg):
    """SUPPRESS/KEEP/DEFER operating point on cross-validated (held-out) OOF probabilities.

    The two thresholds are chosen on the 5-fold OOF predictions — the standard way to
    pick a selective-prediction operating point — so the true-alarm sensitivity floor is
    met on the reported (out-of-fold) set. Returns the aggregated safety report plus the
    chosen thresholds.
    """
    p_false = 1.0 - np.asarray(oof_ptrue, dtype=float)
    y = np.asarray(y).astype(int)
    th = safety.calibrate_thresholds(p_false, y, cfg)
    rep = safety.safety_report(p_false, y, th["t_high"], th["t_low"])
    return rep


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", choices=["rf", "xgb"], default="rf")
    ap.add_argument("--rebuild", action="store_true")
    args = ap.parse_args()
    kind = args.model

    cfg = load_config()
    df = load_features(cfg, rebuild=args.rebuild)
    onehot = [c for c in df.columns if c.startswith("alarm_")]
    all_feats = [c for c in df.columns if c not in ("record_id", "arrhythmia", "label")]
    phys_feats = [c for c in all_feats if c not in onehot]
    y = df["label"].to_numpy(int)
    groups = df["arrhythmia"].to_numpy()
    X_full = df[all_feats].to_numpy(float)
    X_phys = df[phys_feats].to_numpy(float)

    print(f"Model: {kind.upper()} | {len(df)} records "
          f"({int((y==1).sum())} true / {int((y==0).sum())} false) | "
          f"features: {len(all_feats)} full, {len(phys_feats)} physiological")

    # ---- 1. In-distribution baseline (E1) ----
    base = cross_validate(X_full, y, cfg, kind=kind, groups=groups)
    bm = base["metrics"]
    print("\n" + "=" * 66)
    print("1) IN-DISTRIBUTION 5-fold CV baseline (E1) — reference")
    print("=" * 66)
    print(f"  challenge score {_fmt(bm['challenge_score'])} | true-sens {_fmt(bm['sensitivity'])} "
          f"| spec {_fmt(bm['specificity'])} | AUROC {_fmt(bm['auroc'])}")

    # ---- 2. LOAO (C1, headline) ----
    loao = domain.leave_one_arrhythmia_out(X_phys, y, groups, cfg, kind=kind)
    print("\n" + "=" * 66)
    print("2) LEAVE-ONE-ARRHYTHMIA-OUT generalization (C1, headline)")
    print("   train on 4 types -> test on the held-out 5th (physiological features)")
    print("=" * 66)
    print(f"   {'held-out':10s} {'n(t/f)':>9s} {'score':>7s} {'true-sens':>9s} {'AUROC':>7s} "
          f"{'Δscore vs in-dist':>18s}")
    perb = base.get("per_arrhythmia", {})
    for code in loao["order"]:
        m = loao["per_group"][code]
        indist = perb.get(code, {}).get("challenge_score", float("nan"))
        gap = m["challenge_score"] - indist if not np.isnan(indist) else float("nan")
        print(f"   {code:10s} {str(m['n_true'])+'/'+str(m['n_false']):>9s} "
              f"{_fmt(m['challenge_score']):>7s} {_fmt(m['sensitivity'],2):>9s} "
              f"{_fmt(m['auroc']):>7s} {_fmt(gap):>18s}")
    p = loao["pooled"]
    print(f"   {'POOLED':10s} {'':>9s} {_fmt(p['challenge_score']):>7s} "
          f"{_fmt(p['sensitivity'],2):>9s} {_fmt(p['auroc']):>7s}")
    print(f"\n   Generalization gap (pooled LOAO vs in-distribution): "
          f"score {_fmt(bm['challenge_score'])} -> {_fmt(p['challenge_score'])}  "
          f"(Δ {_fmt(p['challenge_score']-bm['challenge_score'])}); "
          f"true-sens {_fmt(bm['sensitivity'])} -> {_fmt(p['sensitivity'])}")

    # ---- 3. LOSO (C1b) ----
    loso = domain.leave_one_source_out()
    print("\n" + "=" * 66)
    print("3) LEAVE-ONE-SOURCE-OUT (C1b): NOT FEASIBLE")
    print("=" * 66)
    print("   " + loso["reason"])

    # ---- 4. Safety operating point (C2) ----
    floor = cfg["safety"]["min_true_sensitivity"]
    sp = safety_operating_point(base["oof_proba"], y, cfg)
    print("\n" + "=" * 66)
    print(f"4) SAFETY LAYER operating point (C2) — floor: true-sens >= {floor}")
    print("=" * 66)
    print(f"   true-alarm sensitivity : {_fmt(sp['true_alarm_sensitivity'])}  "
          f"(only {sp['suppressed_true']} of {int((y==1).sum())} true alarms suppressed)")
    print(f"   false-alarm suppression: {_fmt(sp['false_alarm_suppression'])}  "
          f"({sp['suppressed_false']} of {int((y==0).sum())} false alarms silenced)")
    print(f"   defer rate             : {_fmt(sp['defer_rate'])}  "
          f"(KEEP {sp['n_keep']} / SUPPRESS {sp['n_suppress']} / DEFER {sp['n_defer']})")
    print(f"   KEEP-zone true precision: {_fmt(sp['keep_ppv'])}")
    cal = calibration_curve_ece(y, base["oof_proba"], n_bins=10)
    print(f"   calibration ECE (in-dist OOF probs): {_fmt(cal['ece'])}")

    # ---- 5. Example explanation (C3) ----
    model = build_model(kind, cfg).fit(X_full, y)
    pf = 1.0 - base["oof_proba"]
    supp = np.where((base["oof_keep"] == 0) & (y == 0))[0]  # a correctly-suppressed false alarm
    print("\n" + "=" * 66)
    print("5) EXAMPLE EXPLANATION (C3) — a suppressed false alarm")
    print("=" * 66)
    if len(supp):
        i = supp[int(np.argmax(pf[supp]))]  # the most-confidently-false one
        print(f"   record {df['record_id'][i]} | alarm={df['arrhythmia'][i]} | "
              f"true label={'TRUE' if y[i]==1 else 'FALSE'} | p(false)={_fmt(pf[i],2)} -> SUPPRESS")
        print("   top reasons (SHAP, signed toward TRUE; negative => pushed to suppress):")
        for name, val in explain_features(model, X_full[i], all_feats, k=5):
            print(f"      {name:22s} {val:+.4f}")

    # ---- save ----
    out = resolve(cfg["paths"]["processed"]) / "generalization_results.csv"
    rows = [{"experiment": "in_distribution", "held_out": "-",
             "challenge_score": bm["challenge_score"], "true_sensitivity": bm["sensitivity"],
             "auroc": bm["auroc"], "model": kind}]
    for code in loao["order"]:
        m = loao["per_group"][code]
        rows.append({"experiment": "LOAO", "held_out": code,
                     "challenge_score": m["challenge_score"], "true_sensitivity": m["sensitivity"],
                     "auroc": m["auroc"], "model": kind})
    rows.append({"experiment": "LOAO", "held_out": "POOLED",
                 "challenge_score": p["challenge_score"], "true_sensitivity": p["sensitivity"],
                 "auroc": p["auroc"], "model": kind})
    pd.DataFrame(rows).to_csv(out, index=False)
    print(f"\nSaved -> {out}")
    print("\nAll numbers: 5-fold CV / held-out-arrhythmia on the 750 PUBLIC CinC-2015 records.")


if __name__ == "__main__":
    main()
