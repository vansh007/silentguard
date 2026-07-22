# NOVELTY.md — research gaps, our contributions, and the India angle

> This file locks in *why this is a paper and not a re-run of the 2015 challenge*.
> It is written against the benchmark paper: Clifford et al., "The PhysioNet/Computing in
> Cardiology Challenge 2015: Reducing False Arrhythmia Alarms in the ICU," CinC 2015; 42:273-276.

> **Scope decision (2026-07-22): this project uses ONLY the PhysioNet/CinC 2015 dataset.**
> VTaC was dropped entirely (it would not download in our environment and is non-essential to
> the contributions). Everything below is achievable within the 750 public CinC-2015 records.

## 0. Framing (read this first)
Clifford 2015 is **not a method to beat** — it is the *benchmark description*. "Improving on it"
does **not** mean scoring higher than the top entry (Plesinger, real-time score 81.39). It means
attacking the open problems the challenge exposed but did not solve.

Our headline is **generalization under distribution shift**, and — because we are single-dataset —
our proving ground is the shift the 2015 challenge itself documented but never measured: **an
arrhythmia pattern the model never trained on.** The 2015 paper's central negative result was that
"there was no best general algorithm" — a *different* team won each arrhythmia type. We turn that
into a measurable generalization stress test that needs no second dataset.

**Positioning sentence (use verbatim in the paper's intro and abstract):**
> We build a false-alarm filter that never silences a real emergency and decides how long to
> wait per alarm, and — rather than assuming deployment inputs match training — we measure how
> it generalizes to an arrhythmia (and, where possible, a monitor source) it never saw.

---

## 1. The gaps (each tied to a fact in the 2015 paper)

| # | Gap | Evidence in Clifford 2015 | Why it is still open |
|---|-----|---------------------------|----------------------|
| G1 | **No generalization test under distribution shift** | Train and test are drawn from the *same* pool of 4 hospitals / 3 manufacturers, and signals were deliberately filtered to "remove spectral characteristics that might identify the manufacturer." | The challenge only measures *in-distribution* performance. Whether a model survives a shift it never trained on is untested — and is the only question that matters for real deployment. We make this measurable *within 2015* via leave-one-arrhythmia-out (see C1). |
| G2 | **No single model works across arrhythmias** | "A different contestant ranked highest in each separate alarm category… there was no best general algorithm." VTA (47% of all alarms) was hardest for everyone. Imbalance flips by type: ETC 131 true / 8 false, ASY 100 false / 20 true. | 2015 winners were per-type specialists; nobody unified them, nobody measured how badly a model transfers to a *held-out* arrhythmia, and nobody explained *why* VTA fails. This gap is the lever for our headline result. |
| G3 | **Latency is treated as binary** | Two fixed events only: real-time (0 s after alarm) vs. retrospective (+30 s). The retrospective winner "suppress[ed] 1% of the true alarms, while 80% of the false alarms were suppressed," prompting them to float "re-consideration of the AAMI guidelines for maximum alarm latency." | They never let the *model* choose how long to wait. Latency-as-a-continuum, decided per alarm, is unexplored. |
| G4 | **No abstention; ambiguous alarms discarded** | Gold standard required a two-thirds majority; "Reject" (unreadable) and "Uncertain" alarms were thrown out. | Real ICUs can't discard ambiguous alarms — those are where fatigue bites. A binary true/false with no "I don't know" is the wrong output shape. |
| G5 | **Black-box verdicts, no explanation** | Every entry was rule-based or classical ML; no explanation surface is reported or evaluated. | Alarm fatigue is partly a *trust* problem. A silent verdict a nurse can't interrogate won't be trusted. |
| G6 | **The paper admits its own evaluation leaks** | The best ensemble's cutoff "was selected on the test data, so these results should not be considered truly out of sample." Hidden test set → leaderboard non-reproducible. | Rigorous, leak-free evaluation is itself a contribution the field now openly asks for. |

---

## 2. Our contributions (one coherent story, not four bolt-ons)

**C1 — Single-dataset generalization: Leave-One-Arrhythmia-Out (LOAO) (headline, attacks G1 + G2).**
Train on four of the five arrhythmia types and test **zero-shot on the held-out fifth**; repeat for
all five. This measures whether the model generalizes to an arrhythmia pattern it never saw, and
quantifies the **generalization gap** vs. the in-distribution 5-fold baseline. It is a real
distribution-shift stress test achievable entirely within CinC-2015, and it directly operationalizes
the challenge's own "no best general algorithm" finding. *This is our deployability proxy: a monitor
in a new setting will surface alarm morphologies the training set under-represents.*

**C1b — Leave-One-Source-Out (LOSO): investigated, NOT feasible.**
A true cross-hospital test would train on all monitor sources but one and test on the held-out
source. We inspected all 750 CinC-2015 headers: each contains exactly two comment lines
(arrhythmia type + true/false) and **no hospital, manufacturer, monitor, or model tag** — consistent
with the challenge deliberately filtering out manufacturer-identifying spectral characteristics.
**Source tags are unavailable, so LOSO cannot be run honestly on this dataset.** We state this as a
limitation; measured cross-hospital validation is future work pending a second, source-tagged dataset.

**C2 — Adaptive-latency selective prediction (attacks G3 + G4).**
Reframe from "decide now vs. wait 30 s" to **decide-when-confident, wait-when-not**, with a
three-way output **SUPPRESS / KEEP / DEFER**. Enforce a true-alarm sensitivity floor (motivated
directly by the challenge's 5×FN penalty). Deliver a *latency–sensitivity curve* the 2015 binary
framing could not produce.

**C3 — Trust layer: explanations + calibration (attacks G5 + part of G6).**
Per-alarm reasons (SHAP over SQI + waveform features; attention/Grad-CAM once the deep model lands)
plus calibrated probabilities (reliability curve + ECE), so a stretched nurse can see *why* an alarm
was flagged and how sure the model is.

**C4 — Rigor as a contribution (attacks G6).**
Nested cross-validation with **no test-set tuning** (operating threshold chosen on inner-CV
out-of-fold probabilities of the training fold only), calibration curves (ECE), and honest reporting.
Explicitly state everywhere: 5-fold CV on the 750 public records (the 500-record test set is unreleased).

---

## 3. The India-specific angle (design-and-argument based)

The India relevance is not cosmetic — it changes which technical problems matter. **Because we are
single-dataset, this angle is explicitly a design-and-argument contribution, not a measured one.**

**Why generalization matters for India.** Indian ICUs run a heterogeneous, cost-driven mix of
monitors (domestic brands such as BPL and Skanray, refurbished units, and international brands) —
*none* of which appear in CinC-2015, and for which *no labelled false-alarm data exists*. A model
that only works in-distribution is useless there. Our LOAO result (C1) is a proxy for "does this
survive inputs it did not train on"; it argues for, but does not measure, cross-hospital transfer.

**Why the resource setting shapes the design.**
- **Higher nurse-to-patient ratios.** Indian ICUs frequently exceed the ideal nursing ratio due to
  workforce shortages, so alarm fatigue is *more* dangerous and the DEFER output (C2) — routing only
  genuinely ambiguous alarms to an already-stretched nurse — matters more.
- **Older / budget monitors → noisier signals and worse built-in alarm logic → more false alarms.**
  This raises the payoff of SQI-driven artifact rejection and robustness.
- **Retrofit, not rip-and-replace.** Hospitals can't replace fleets, so the product must be a
  *software layer on top of existing monitors*, ideally edge-deployable and low-compute
  (Indian ICUs face power/connectivity constraints). Design the model to run on a cheap device.
- **Multilingual nurse-facing UI** (Hindi / Tamil / regional) in the product.

**Honest limitation (state it plainly in the paper).** There is no widely-available open Indian ICU
alarm waveform dataset, and we use only CinC-2015. We therefore *design for* and *argue* Indian
deployability via within-dataset generalization (LOAO), safety, and edge/retrofit design; we do
**not** *claim measured* cross-hospital or Indian performance. Measured cross-hospital/Indian
validation — and the LOSO and few-shot-local-calibration experiments — are **future work pending a
second, source-tagged dataset.** A small prospective pilot at a local hospital is future work.

*(When you write the paper, back the nurse-ratio and monitor-heterogeneity claims with citations —
they are directional here and should be sourced.)*

---

## 4. Experiment table (what proves each claim)

Label 1 = TRUE alarm, 0 = FALSE. Headline metric = challenge score `(TP+TN)/(TP+TN+5·FN + FP)`
(i.e. `(TP+TN)/(TP+TN+FP+5·FN)`); always co-report **true-alarm sensitivity** (must stay ~100%)
and AUROC. All experiments are on the 750 public CinC-2015 records.

| ID | Claim it proves | Setup | Train → Test | Primary metric | "Success" |
|----|-----------------|-------|--------------|----------------|-----------|
| **E1** | We reproduce the benchmark | 5-fold CV on the 750 public records | CinC-2015 → CV folds | Challenge score, AUROC, per-arrhythmia | In the range of published entries (~75–84) |
| **E2** | **Generalization to unseen arrhythmias (headline)** | Leave-One-Arrhythmia-Out: train on 4 types, test on the held-out 5th; repeat ×5 | CinC-2015 (4 types) → held-out type | Score + true-sens + AUROC per held-out type, **Δ vs E1** | A real, quantified gap per type; identify which arrhythmia generalizes worst |
| ~~E-old~~ | ~~Cross-dataset transfer / few-shot local calibration~~ | **Dropped** — required VTaC (second dataset), which is out of scope. | — | — | LOSO + few-shot are future work (see C1b, §3). |
| **E4** | Adaptive latency beats fixed | Per-alarm wait vs fixed 0 s / 30 s | CinC-2015 (CV) | FA-suppression @ fixed true-sens, **mean latency** | More suppression at lower mean latency than fixed-30 s |
| **E5** | Deferral is safe | Selective prediction: coverage vs risk | CinC-2015 (CV) | True-alarm sens ≥ 99% at operating point; defer-rate | High FA suppression at ~100% true-sens |
| **E7** | Explanations are plausible | SHAP on n worked examples | (any trained model) | qualitative + SQI-importance | Reasons align with signal-quality / HR-mismatch |
| **E8** | Rigor / calibration | Nested CV, calibration, ECE | CinC-2015 | ECE, reliability curve | No test-set tuning; calibrated probabilities |

**The figures/tables that carry the paper:**
1. T-E1: per-arrhythmia benchmark table (shows you handle all five, incl. the hard VTA).
2. **T-E2: the LOAO generalization table — the money result** (held-out arrhythmia × score/sens/AUROC,
   with the gap vs the in-distribution baseline).
3. F-E4/E5: the latency-/coverage-vs-true-sensitivity curves — the novel methodological figure.
4. F-E8: the reliability/calibration curve.
