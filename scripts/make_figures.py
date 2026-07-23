"""Generate the paper figures (docs/figures/) from the REAL leak-free results.

Reproducible: re-runs the same leak-free, same-protocol evaluation used to freeze the
engine (seed 42, CPU) so the figures match data/processed/final_ensemble_results.csv, then
writes per-type detail CSVs (data/processed/loao_pertype.csv, safety_detail.csv) that
docs/RESULTS.md cites.

Figures:
  1. fig1_roc.png            — in-distribution ROC, RF vs CNN vs ensemble.
  2. fig2_loao.png           — LOAO challenge score per held-out arrhythmia vs the
                               in-distribution reference (the headline generalization figure).
  3. fig3_safety.png         — false-alarm suppression vs true-alarm sensitivity, RF vs
                               ensemble, with the >=99% floor marked.
  4. fig4_calibration.png    — reliability diagram for the ensemble (with ECE).
  5. fig5_explanation.png    — a suppressed false alarm: its ECG + top SHAP reasons.

Usage: python scripts/make_figures.py
"""
from __future__ import annotations
import warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.metrics import roc_curve, auc

from silentguard.config import load_config, resolve
from silentguard.models import ensemble, safety
from silentguard.models.cnn import build_waveform_tensor
from silentguard.data.io import load_challenge2015_record
from silentguard.features.waveform_features import extract_feature_vector
from silentguard.explain.explain import explain_features, calibration_curve_ece

warnings.filterwarnings("ignore")

# Colorblind-safe (Okabe-Ito) palette; readable fonts; minimal chartjunk.
plt.rcParams.update({
    "figure.dpi": 150, "savefig.dpi": 200, "savefig.bbox": "tight",
    "font.size": 11, "axes.titlesize": 12, "axes.labelsize": 11,
    "legend.fontsize": 10, "axes.spines.top": False, "axes.spines.right": False,
    "axes.grid": True, "grid.alpha": 0.25, "grid.linewidth": 0.6,
})
C = {"rf": "#0072B2", "cnn": "#E69F00", "ens": "#009E73", "ref": "#555555", "hi": "#D55E00"}
NAME = {"rf": "RandomForest", "cnn": "1D-CNN", "ens": "RF+CNN ensemble"}
ORDER = ["ASYSTOLE", "BRADY", "TACHY", "VTACH", "VFIB"]


def _safety_curve(p_false, y):
    """Sweep the SUPPRESS threshold; return (true_sens[], fa_suppression[]) arrays."""
    y = np.asarray(y).astype(int)
    n_true, n_false = int((y == 1).sum()), int((y == 0).sum())
    ts, fa = [], []
    for t in np.unique(np.concatenate([[0.0], p_false, [1.0001]])):
        suppressed = p_false >= t
        ts.append(1.0 - np.sum((y == 1) & suppressed) / n_true)
        fa.append(np.sum((y == 0) & suppressed) / n_false)
    order = np.argsort(ts)
    return np.array(ts)[order], np.array(fa)[order]


def main():
    cfg = load_config()
    figdir = resolve("docs/figures"); figdir.mkdir(parents=True, exist_ok=True)
    procdir = resolve(cfg["paths"]["processed"])

    # ---- data ----
    df = pd.read_csv(procdir.parent / "interim" / "challenge2015_features.csv")
    df = df[df["label"].notna()].reset_index(drop=True)
    feat_cols = [c for c in df.columns if c not in ("record_id", "arrhythmia", "label")]
    phys_cols = [c for c in feat_cols if not c.startswith("alarm_")]
    Xf = df[feat_cols].to_numpy(float); Xf_phys = df[phys_cols].to_numpy(float)
    y = df["label"].to_numpy(int); groups = df["arrhythmia"].to_numpy()
    Xw, yw, gw, ids = build_waveform_tensor(cfg)
    assert np.array_equal(y, yw)

    print("Running leak-free joint CV + LOAO (reproduces the frozen-engine numbers) ...")
    cv = ensemble.joint_cross_validate(Xf, Xw, y, cfg, groups=groups)
    lo = ensemble.joint_loao(Xf_phys, Xw, y, groups, cfg)

    # ================= Figure 1: ROC =================
    fig, ax = plt.subplots(figsize=(5.2, 5.0))
    for k in ("rf", "cnn", "ens"):
        fpr, tpr, _ = roc_curve(y, cv[k]["oof_proba"])
        ax.plot(fpr, tpr, color=C[k], lw=2, label=f"{NAME[k]} (AUC={auc(fpr, tpr):.3f})")
    ax.plot([0, 1], [0, 1], "--", color=C["ref"], lw=1, label="chance")
    ax.set_xlabel("False-positive rate"); ax.set_ylabel("True-positive rate")
    ax.set_title("In-distribution ROC (5-fold CV, leak-free)")
    ax.legend(loc="lower right", frameon=False); ax.set_xlim(0, 1); ax.set_ylim(0, 1.02)
    fig.savefig(figdir / "fig1_roc.png"); plt.close(fig)

    # ================= Figure 2: LOAO generalization =================
    ens_pg = lo["ens"]["per_group"]
    scores = [ens_pg[c]["challenge_score"] for c in ORDER]
    indist = cv["ens"]["metrics"]["challenge_score"]
    pooled = lo["ens"]["pooled"]["challenge_score"]
    fig, ax = plt.subplots(figsize=(6.6, 4.2))
    bars = ax.bar(ORDER, scores, color=C["ens"], width=0.62, label="held-out arrhythmia (LOAO)")
    worst = int(np.argmin(scores))
    bars[worst].set_color(C["hi"])
    ax.axhline(indist, ls="--", color=C["ref"], lw=1.5,
               label=f"in-distribution reference ({indist:.3f})")
    ax.axhline(pooled, ls=":", color=C["ens"], lw=1.5, label=f"LOAO pooled ({pooled:.3f})")
    for b, s in zip(bars, scores):
        ax.text(b.get_x() + b.get_width() / 2, s + 0.012, f"{s:.2f}", ha="center", fontsize=9)
    ax.annotate("worst: trained without\ntachycardia examples", xy=(worst, scores[worst]),
                xytext=(worst - 0.1, indist - 0.12), fontsize=8.5, color=C["hi"],
                ha="center", arrowprops=dict(arrowstyle="->", color=C["hi"], lw=1))
    ax.set_ylabel("Challenge score"); ax.set_ylim(0, max(indist, max(scores)) + 0.12)
    ax.set_title("Leave-One-Arrhythmia-Out generalization (RF+CNN ensemble)")
    ax.legend(loc="upper right", frameon=False, fontsize=9)
    fig.savefig(figdir / "fig2_loao.png"); plt.close(fig)

    # ================= Figure 3: safety trade-off =================
    fig, ax = plt.subplots(figsize=(6.2, 4.6))
    op = {}
    for k in ("rf", "ens"):
        pf = 1.0 - cv[k]["oof_proba"]
        ts, fa = _safety_curve(pf, y)
        ax.plot(ts, fa, color=C[k], lw=2, label=NAME[k])
        th = safety.calibrate_thresholds(pf, y, cfg)
        rep = safety.safety_report(pf, y, th["t_high"], th["t_low"])
        op[k] = rep
        ax.scatter([rep["true_alarm_sensitivity"]], [rep["false_alarm_suppression"]],
                   color=C[k], s=55, zorder=5, edgecolor="white")
    ax.axvline(0.99, ls="--", color=C["hi"], lw=1.3, label="99% true-sens floor")
    ax.set_xlabel("True-alarm sensitivity"); ax.set_ylabel("False-alarm suppression")
    ax.set_title("Safety trade-off: FA suppression vs true-alarm sensitivity")
    ax.set_xlim(0.6, 1.005); ax.set_ylim(0, 1.0)
    ax.legend(loc="upper right", frameon=False)
    ax.invert_xaxis()  # move toward the 100%-sensitivity (safe) side on the right
    fig.savefig(figdir / "fig3_safety.png"); plt.close(fig)

    # ================= Figure 4: calibration =================
    cal = calibration_curve_ece(y, cv["ens"]["oof_proba"], n_bins=10)
    fig, ax = plt.subplots(figsize=(5.0, 5.0))
    m = np.isfinite(cal["bin_accuracy"])
    ax.plot([0, 1], [0, 1], "--", color=C["ref"], lw=1, label="perfect calibration")
    ax.plot(cal["bin_confidence"][m], cal["bin_accuracy"][m], "o-", color=C["ens"], lw=2,
            label=f"ensemble (ECE={cal['ece']:.3f})")
    ax.set_xlabel("Predicted P(true alarm)"); ax.set_ylabel("Empirical fraction true")
    ax.set_title("Reliability diagram (RF+CNN ensemble)")
    ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.legend(loc="upper left", frameon=False)
    fig.savefig(figdir / "fig4_calibration.png"); plt.close(fig)

    # ================= Figure 5: example explanation =================
    frozen = ensemble.FrozenEnsemble.load(procdir / "models" / "ensemble", cfg)
    pf_ens = 1.0 - cv["ens"]["oof_proba"]
    th = safety.calibrate_thresholds(pf_ens, y, cfg)
    cand = np.where((pf_ens >= th["t_high"]) & (y == 0))[0]  # correctly-suppressed false alarms
    i = cand[int(np.argmax(pf_ens[cand]))]
    rid = df["record_id"][i]
    rec = load_challenge2015_record(str(resolve(cfg["paths"]["challenge_2015"]) / "training" / rid))
    fs = rec.fs; win_s = cfg["signal"]["window_seconds"]
    ecg = rec.window(win_s, rec.primary_ecg())
    tsec = np.arange(len(ecg)) / fs
    x_feat = np.array([extract_feature_vector(rec, cfg).get(n, np.nan) for n in feat_cols])
    reasons = explain_features(frozen.rf, x_feat, feat_cols, k=5)

    fig, (a1, a2) = plt.subplots(2, 1, figsize=(7.0, 5.6),
                                 gridspec_kw={"height_ratios": [1.1, 1]})
    a1.plot(tsec, ecg, color=C["rf"], lw=0.7)
    a1.set_title(f"Suppressed FALSE {rec.arrhythmia} alarm  ({rid}, p(false)={pf_ens[i]:.2f})")
    a1.set_xlabel(f"time (s), last {win_s:.0f}s before alarm"); a1.set_ylabel("ECG (norm.)")
    a1.grid(alpha=0.2)
    names = [n for n, _ in reasons][::-1]; vals = [v for _, v in reasons][::-1]
    cols = [C["ens"] if v > 0 else C["hi"] for v in vals]
    a2.barh(names, vals, color=cols)
    a2.axvline(0, color="k", lw=0.8)
    a2.set_xlabel("SHAP contribution toward TRUE  (negative → pushes to SUPPRESS)")
    a2.set_title("Top reasons (feature model)")
    a2.grid(alpha=0.2, axis="x")
    fig.tight_layout()
    fig.savefig(figdir / "fig5_explanation.png"); plt.close(fig)

    # ================= detail CSVs for RESULTS.md =================
    rows = []
    for k in ("rf", "cnn", "ens"):
        for c in ORDER:
            g = lo[k]["per_group"][c]
            rows.append({"model": NAME[k], "held_out": c, "n_true": g["n_true"],
                         "n_false": g["n_false"], "challenge_score": g["challenge_score"],
                         "true_sensitivity": g["sensitivity"], "auroc": g["auroc"]})
        pl = lo[k]["pooled"]
        rows.append({"model": NAME[k], "held_out": "POOLED", "n_true": "", "n_false": "",
                     "challenge_score": pl["challenge_score"],
                     "true_sensitivity": pl["sensitivity"], "auroc": pl["auroc"]})
    pd.DataFrame(rows).to_csv(procdir / "loao_pertype.csv", index=False)

    sdet = []
    for k in ("rf", "cnn", "ens"):
        pf = 1.0 - cv[k]["oof_proba"]
        thk = safety.calibrate_thresholds(pf, y, cfg)
        r = safety.safety_report(pf, y, thk["t_high"], thk["t_low"])
        r["ece"] = calibration_curve_ece(y, cv[k]["oof_proba"], 10)["ece"]
        r["model"] = NAME[k]
        sdet.append(r)
    pd.DataFrame(sdet).to_csv(procdir / "safety_detail.csv", index=False)

    # ---- per-record leak-free predictions -------------------------------------------
    # These are the raw material behind every curve above. Persisting them lets the
    # product recompute the safety operating point (and the LOAO collapse) live at any
    # threshold the user picks, on real per-record predictions rather than a redrawn
    # picture of one frozen operating point.
    oof = pd.DataFrame({
        "record_id": df["record_id"], "arrhythmia": df["arrhythmia"], "label": y,
    })
    for k in ("rf", "cnn", "ens"):
        oof[f"p_true_indist_{k}"] = cv[k]["oof_proba"]
        oof[f"p_true_loao_{k}"] = lo[k]["pooled_proba"]
    oof.to_csv(procdir / "oof_predictions.csv", index=False)

    print("Wrote figures ->", figdir)
    print("Wrote data/processed/loao_pertype.csv, safety_detail.csv, oof_predictions.csv")
    print(f"(explanation figure uses record {rid})")


if __name__ == "__main__":
    main()
