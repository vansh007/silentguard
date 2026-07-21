# Paper outline

**Working title:** Trustworthy False-Alarm Reduction for ICU Bedside Monitors:
A Cross-Dataset, Safety-Constrained, and Explainable Approach for Resource-Constrained ICUs.

> Full gap analysis + experiment table live in **../NOVELTY.md**. This outline threads those
> contributions into the paper structure. Positioning is against Clifford et al., CinC 2015.

## Positioning sentence (put this in the intro, verbatim)
> The 2015 challenge asked whether false alarms can be suppressed *in-distribution*; we ask whether
> they can be suppressed on hospitals the model never saw, without ever silencing a true emergency,
> while choosing how long to wait per alarm — and we show what it costs.

## Contributions (state as a bulleted list in the intro)
- **C1 — Cross-dataset generalization:** zero-shot transfer CinC-2015 → VTaC (unseen hospitals /
  manufacturers), then domain-generalization to narrow the gap. *This is the deployability result.*
- **C2 — Adaptive-latency selective prediction:** SUPPRESS / KEEP / DEFER with a true-alarm
  sensitivity floor and a per-alarm latency choice (generalizes the 2015 binary real-time/retrospective split).
- **C3 — Trust layer:** per-alarm explanations (attention/Grad-CAM + SHAP over SQIs) + calibration.
- **C4 — Rigor:** nested CV, no test-set tuning, calibration curves, honest external validation.

## Sections
1. **Introduction** — alarm fatigue; false-alarm rates up to ~90%; the *deployment* gap
   (generalization + safety + trust) vs. raw accuracy. Motivate the resource-constrained /
   Indian-ICU setting: heterogeneous monitor fleets, no local labelled data, higher nurse
   ratios. State the positioning sentence + the four contributions.
2. **Related work** — CinC-2015 entries (signal-processing + rule-based; RF + SQI; note "no best
   general algorithm", VTA hardest); representation/contrastive-learning approaches; VTaC benchmark.
   Note recent work already hits >0.96 AUC on VT → accuracy alone is not a contribution.
3. **Data** — CinC-2015 (five arrhythmias; 750 public / 500 hidden; same-pool train/test →
   in-distribution only) and VTaC (5,037 VT alarms; 3 hospitals / 3 manufacturers → our external
   test). Hidden test set → **5-fold CV on the 750**. Note: no open Indian dataset exists (limitation).
4. **Methods** — preprocessing; **SQIs** (artifact rejection — key under noisy/budget monitors);
   handcrafted + deep tracks; fusion; **safety layer** (SUPPRESS/KEEP/DEFER + sensitivity floor);
   **adaptive latency**; domain generalization; explainability + calibration.
5. **Experiments** — E1 in-dataset CV; **E2/E3 cross-dataset (headline)**; E4 latency curve;
   E5 defer/coverage; **E6 few-shot local calibration (India deployability)**; E7 explanations;
   E8 rigor/calibration. (Full table in NOVELTY.md §4.)
6. **Discussion** — the generalization gap, honestly; what few-shot calibration implies for Indian
   deployment; limitations (VTaC is VT-only; no matched clinical data; no measured Indian performance).
7. **Conclusion** — a deployable, trustworthy path for ICUs *without* local training data.

## Money figures/tables (see NOVELTY.md §4)
- T1: per-arrhythmia benchmark on CinC-2015 (handles the hard VTA).
- **T2: cross-dataset generalization (train-2015 / test-VTaC)** — the result that matters.
- F1: latency- / coverage-vs-true-sensitivity curves — the novel method figure.
- **F2: few-shot local-calibration learning curve — the India deployability figure.**

## Target venues
IEEE/Springer conference or healthcare-informatics workshop; mid-tier journal if strong. Write to
submission quality regardless, for the final review.

## Anchor references (fill BibTeX)
- Clifford et al., PhysioNet/CinC Challenge 2015 (CinC 2015) — the benchmark.
- npj Digital Medicine 2019 — SQI + Random Forest, top real-time score.
- Zhou et al., contrastive learning for ICU false alarm reduction (Sci. Rep. 2022).
- Lehman et al., VTaC (NeurIPS 2023 Datasets & Benchmarks) — external-validation dataset.
- Reducing False VT Alarms (arXiv:2503.14621, 2025) — >0.96 AUC on VTaC.
- + citations for Indian ICU nurse-ratios & monitor heterogeneity (find when writing).
