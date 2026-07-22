"""Deep model vs RandomForest — the step-6 comparison.

Runs, on the 750 public CinC-2015 records (single dataset; label 1 = TRUE alarm):
  * RandomForest (handcrafted features) — the reference.
  * 1-D CNN and Attention CNN-LSTM (raw 3-channel waveform window).
For EACH model:
  (a) in-distribution 5-fold CV, and
  (b) Leave-One-Arrhythmia-Out (LOAO) generalization,
then re-fits the SUPPRESS/KEEP/DEFER safety layer on each model's OOF probabilities and
reports the operating point at the >=99% true-alarm sensitivity floor. The question this
answers: does a higher AUROC let us auto-suppress more false alarms and defer fewer while
staying safe?

Headline metric = challenge score (TP+TN)/(TP+TN+FP+5*FN); true-alarm sensitivity always
co-reported. All numbers are 5-fold CV / held-out-arrhythmia on the 750 public records.

Usage: python scripts/04_deep_model.py [--archs cnn attn] [--rebuild]
"""
from __future__ import annotations
import argparse
import warnings
import numpy as np
import pandas as pd

from silentguard.config import load_config, resolve
from silentguard.models import baseline, domain, safety, cnn
from silentguard.explain.explain import calibration_curve_ece

warnings.filterwarnings("ignore")
ORDER = ["ASYSTOLE", "BRADY", "TACHY", "VTACH", "VFIB"]


def _fmt(v, nd=3):
    return " nan" if v is None or (isinstance(v, float) and np.isnan(v)) else f"{v:.{nd}f}"


def safety_point(oof_ptrue, y, cfg):
    p_false = 1.0 - np.asarray(oof_ptrue, dtype=float)
    th = safety.calibrate_thresholds(p_false, y, cfg)
    return safety.safety_report(p_false, y, th["t_high"], th["t_low"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--archs", nargs="+", default=["cnn", "attn"], choices=["cnn", "attn"])
    ap.add_argument("--rebuild", action="store_true")
    args = ap.parse_args()
    cfg = load_config()

    # ---- data ----
    fcache = resolve(cfg["paths"]["interim"]) / "challenge2015_features.csv"
    if not fcache.exists():
        raise SystemExit("Run scripts/02_train_baseline.py first (feature cache missing).")
    df = pd.read_csv(fcache); df = df[df["label"].notna()].reset_index(drop=True)
    onehot = [c for c in df.columns if c.startswith("alarm_")]
    all_feats = [c for c in df.columns if c not in ("record_id", "arrhythmia", "label")]
    phys_feats = [c for c in all_feats if c not in onehot]
    y_f = df["label"].to_numpy(int); groups_f = df["arrhythmia"].to_numpy()
    X_full = df[all_feats].to_numpy(float); X_phys = df[phys_feats].to_numpy(float)

    Xw, y, groups, ids = cnn.build_waveform_tensor(cfg, rebuild=args.rebuild)
    assert np.array_equal(y, y_f), "feature/waveform label order mismatch"
    print(f"{len(df)} records ({int((y==1).sum())} true / {int((y==0).sum())} false) | "
          f"features {X_full.shape[1]} | waveform {Xw.shape}")

    results = {}   # name -> dict(base, loao)

    # ---- RandomForest reference ----
    print("\n[1/3] RandomForest (features) ...")
    rf_base = baseline.cross_validate(X_full, y, cfg, kind="rf", groups=groups)
    rf_loao = domain.leave_one_arrhythmia_out(X_phys, y, groups, cfg, kind="rf")
    results["RandomForest"] = {"base": rf_base, "loao": rf_loao, "oof": rf_base["oof_proba"]}

    # ---- deep models ----
    for i, arch in enumerate(args.archs, start=2):
        name = {"cnn": "1D-CNN", "attn": "Attn-CNN-LSTM"}[arch]
        print(f"\n[{i}/{len(args.archs)+1}] {name} (raw waveform) — 5-fold CV + LOAO ...")
        base = cnn.cross_validate_deep(Xw, y, cfg, arch=arch, groups=groups)
        loao = cnn.leave_one_arrhythmia_out_deep(Xw, y, groups, cfg, arch=arch)
        results[name] = {"base": base, "loao": loao, "oof": base["oof_proba"]}

    # ---- RF + CNN ensemble (complementary representations; equal weight, no tuning) ----
    if "RandomForest" in results and "1D-CNN" in results:
        fn = int(cfg["eval"]["fn_penalty"])
        rf, cn = results["RandomForest"], results["1D-CNN"]
        oof_ens = 0.5 * (rf["oof"] + cn["oof"])
        thr = baseline.select_threshold(y, oof_ens, fn)
        keep = (oof_ens >= thr).astype(int)
        base_ens = {"metrics": cnn._agg_metrics(y, oof_ens, keep, thr, fn),
                    "oof_proba": oof_ens,
                    "per_arrhythmia": cnn._per_group(groups, y, keep, oof_ens, fn)}
        lp = 0.5 * (rf["loao"]["pooled_proba"] + cn["loao"]["pooled_proba"])
        thr2 = baseline.select_threshold(y, lp, fn)
        keepl = (lp >= thr2).astype(int)
        loao_ens = {"pooled": cnn._agg_metrics(y, lp, keepl, 0.5, fn),
                    "per_group": cnn._per_group(groups, y, keepl, lp, fn)}
        results["RF+CNN ensemble"] = {"base": base_ens, "loao": loao_ens, "oof": oof_ens}

    # ---- in-distribution comparison ----
    print("\n" + "=" * 74)
    print("A) IN-DISTRIBUTION 5-fold CV  (challenge score / true-sens / AUROC)")
    print("=" * 74)
    print(f"   {'model':16s} {'score':>7s} {'true-sens':>10s} {'spec':>7s} {'AUROC':>7s}")
    for name, r in results.items():
        m = r["base"]["metrics"]
        print(f"   {name:16s} {_fmt(m['challenge_score']):>7s} {_fmt(m['sensitivity']):>10s} "
              f"{_fmt(m['specificity']):>7s} {_fmt(m['auroc']):>7s}")

    # ---- LOAO comparison ----
    print("\n" + "=" * 74)
    print("B) LEAVE-ONE-ARRHYTHMIA-OUT generalization  (pooled + per held-out type)")
    print("=" * 74)
    print(f"   {'model':16s} {'POOLED':>7s} {'sens':>6s} | " +
          " ".join(f"{c[:4]:>6s}" for c in ORDER))
    for name, r in results.items():
        lo = r["loao"]; p = lo["pooled"]
        cells = []
        for c in ORDER:
            cells.append(_fmt(lo["per_group"][c]["challenge_score"], 2) if c in lo["per_group"] else "   -")
        print(f"   {name:16s} {_fmt(p['challenge_score']):>7s} {_fmt(p['sensitivity'],2):>6s} | " +
              " ".join(f"{c:>6s}" for c in cells))

    # ---- safety operating point at the >=99% floor ----
    floor = cfg["safety"]["min_true_sensitivity"]
    print("\n" + "=" * 74)
    print(f"C) SAFETY LAYER @ true-sens >= {floor}  (does better AUROC -> suppress more, defer less?)")
    print("=" * 74)
    print(f"   {'model':16s} {'true-sens':>10s} {'FA-suppress':>12s} {'defer-rate':>11s} "
          f"{'KEEP/SUPP/DEFER':>16s}")
    for name, r in results.items():
        sp = safety_point(r["oof"], y, cfg)
        print(f"   {name:16s} {_fmt(sp['true_alarm_sensitivity']):>10s} "
              f"{_fmt(sp['false_alarm_suppression']):>12s} {_fmt(sp['defer_rate']):>11s} "
              f"{str(sp['n_keep'])+'/'+str(sp['n_suppress'])+'/'+str(sp['n_defer']):>16s}")
        cal = calibration_curve_ece(y, r["oof"], 10)
        r["ece"] = cal["ece"]
    print("\n   (ECE calibration: " +
          ", ".join(f"{n} {_fmt(r['ece'])}" for n, r in results.items()) + ")")

    # ---- save ----
    rows = []
    for name, r in results.items():
        bm = r["base"]["metrics"]; p = r["loao"]["pooled"]; sp = safety_point(r["oof"], y, cfg)
        rows.append({"model": name, "indist_score": bm["challenge_score"],
                     "indist_sens": bm["sensitivity"], "indist_auroc": bm["auroc"],
                     "loao_pooled_score": p["challenge_score"], "loao_pooled_sens": p["sensitivity"],
                     "safety_true_sens": sp["true_alarm_sensitivity"],
                     "safety_fa_suppression": sp["false_alarm_suppression"],
                     "safety_defer_rate": sp["defer_rate"]})
    out = resolve(cfg["paths"]["processed"]) / "deep_vs_rf_results.csv"
    pd.DataFrame(rows).to_csv(out, index=False)
    print(f"\nSaved -> {out}")
    print("All numbers: 5-fold CV / held-out-arrhythmia on the 750 PUBLIC CinC-2015 records.")


if __name__ == "__main__":
    main()
