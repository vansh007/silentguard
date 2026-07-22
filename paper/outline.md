# Paper outline

**Working title:** Trustworthy False-Alarm Reduction for ICU Bedside Monitors:
A Generalization-Tested, Safety-Constrained, and Explainable Approach for Resource-Constrained ICUs.

> Full gap analysis + experiment table live in **../NOVELTY.md**. This outline threads those
> contributions into the paper structure. Positioning is against Clifford et al., CinC 2015.
> **Scope (2026-07-22): single dataset — CinC-2015 only.** VTaC dropped; generalization is measured
> within-dataset via Leave-One-Arrhythmia-Out (LOAO).

## Positioning sentence (put this in the intro/abstract, verbatim)
> We build a false-alarm filter that never silences a real emergency and decides how long to
> wait per alarm, and — rather than assuming deployment inputs match training — we measure how
> it generalizes to an arrhythmia (and, where possible, a monitor source) it never saw.

## Contributions (state as a bulleted list in the intro)
- **C1 — Leave-One-Arrhythmia-Out (LOAO) generalization (headline):** train on four arrhythmia
  types, test zero-shot on the held-out fifth (×5); quantify the gap vs the in-distribution
  baseline. Operationalizes the 2015 "no best general algorithm" finding within CinC-2015.
  *(C1b Leave-One-Source-Out is NOT feasible — headers carry no hospital/manufacturer tags.)*
- **C2 — Adaptive-latency selective prediction:** SUPPRESS / KEEP / DEFER with a true-alarm
  sensitivity floor and a per-alarm latency choice (generalizes the 2015 binary real-time/retrospective split).
- **C3 — Trust layer:** per-alarm explanations (SHAP over features; attention/Grad-CAM once the deep
  model lands) + calibration (reliability curve + ECE).
- **C4 — Rigor:** nested CV, no test-set tuning, calibration curves, honest reporting.

## Sections
1. **Introduction** — alarm fatigue; false-alarm rates up to ~90%; the *deployment* gap
   (generalization + safety + trust) vs. raw accuracy. Motivate the resource-constrained /
   Indian-ICU setting: heterogeneous monitor fleets, no local labelled data, higher nurse
   ratios. State the positioning sentence + the four contributions.
2. **Related work** — CinC-2015 entries (signal-processing + rule-based; RF + SQI; note "no best
   general algorithm", VTA hardest); representation/contrastive-learning approaches. Note recent
   work already hits >0.96 AUC on VT → accuracy alone is not a contribution.
3. **Data** — CinC-2015 (five arrhythmias; 750 public / 500 hidden; same-pool train/test →
   in-distribution only). Hidden test set → **5-fold CV on the 750**. Headers carry no
   hospital/manufacturer tags (checked) → cross-source tests infeasible here. Note: no open Indian
   dataset exists, and we use only CinC-2015 (limitation).
4. **Methods** — preprocessing; **SQIs** (artifact rejection — key under noisy/budget monitors);
   handcrafted (+ optional deep) track; **LOAO generalization protocol**; **safety layer**
   (SUPPRESS/KEEP/DEFER + sensitivity floor); **adaptive latency**; explainability + calibration.
5. **Experiments** — E1 in-dataset CV; **E2 Leave-One-Arrhythmia-Out (headline)**; E4 latency curve;
   E5 defer/coverage; E7 explanations; E8 rigor/calibration. (Full table in NOVELTY.md §4.)
   *(Cross-dataset E2/E3 and few-shot E6 dropped with VTaC → future work.)*
6. **Discussion** — the LOAO generalization gap, honestly (which arrhythmia transfers worst and why);
   what it implies for deployment on unseen monitors; limitations (single dataset; no source tags →
   no measured cross-hospital/Indian performance; deep model and prospective pilot are future work).
7. **Conclusion** — a generalization-tested, safe, trustworthy path for ICUs, with an honest account
   of what single-dataset evidence can and cannot claim.

## Money figures/tables (see NOVELTY.md §4)
- T1: per-arrhythmia benchmark on CinC-2015 (handles the hard VTA).
- **T2: LOAO generalization (held-out arrhythmia × score/sens/AUROC vs in-distribution)** — the result that matters.
- F1: latency- / coverage-vs-true-sensitivity curves — the novel method figure.
- F2: reliability / calibration curve (ECE).

## Target venues
IEEE/Springer conference or healthcare-informatics workshop; mid-tier journal if strong. Write to
submission quality regardless, for the final review.

## Anchor references (fill BibTeX)
- Clifford et al., PhysioNet/CinC Challenge 2015 (CinC 2015) — the benchmark.
- npj Digital Medicine 2019 — SQI + Random Forest, top real-time score.
- Zhou et al., contrastive learning for ICU false alarm reduction (Sci. Rep. 2022).
- Lehman et al., VTaC (NeurIPS 2023) — cite as related benchmark (NOT used here; future work).
- + citations for Indian ICU nurse-ratios & monitor heterogeneity (find when writing).
