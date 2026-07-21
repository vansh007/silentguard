# NOVELTY.md — research gaps, our contributions, and the India angle

> This file locks in *why this is a paper and not a re-run of the 2015 challenge*.
> It is written against the benchmark paper: Clifford et al., "The PhysioNet/Computing in
> Cardiology Challenge 2015: Reducing False Arrhythmia Alarms in the ICU," CinC 2015; 42:273-276.

## 0. Framing (read this first)
Clifford 2015 is **not a method to beat** — it is the *benchmark description*. "Improving on it"
does **not** mean scoring higher than the top entry (Plesinger, real-time score 81.39). It means
attacking the open problems the challenge exposed but did not solve. Ten years on, and with the
VTaC dataset now available, several of those are attackable in ways they were not in 2015.

Our headline is deployability, and our proving ground is the setting the benchmark ignored:
**hospitals the model never trained on — the exact situation of every Indian ICU.**

---

## 1. The gaps (each tied to a fact in the 2015 paper)

| # | Gap | Evidence in Clifford 2015 | Why it is still open |
|---|-----|---------------------------|----------------------|
| G1 | **No cross-site generalization test** | Train and test are drawn from the *same* pool of 4 hospitals / 3 manufacturers, and signals were deliberately filtered to "remove spectral characteristics that might identify the manufacturer." | The challenge only measures *in-distribution* performance. Whether a model survives a new hospital/monitor is untested — and is the only question that matters for real deployment. |
| G2 | **No single model works across arrhythmias** | "A different contestant ranked highest in each separate alarm category… there was no best general algorithm." VTA (47% of all alarms) was hardest for everyone. Imbalance flips by type: ETC 131 true / 8 false, ASY 100 false / 20 true. | 2015 winners were per-type specialists; nobody unified them, and nobody explained *why* VTA fails. |
| G3 | **Latency is treated as binary** | Two fixed events only: real-time (0 s after alarm) vs. retrospective (+30 s). The retrospective winner "suppress[ed] 1% of the true alarms, while 80% of the false alarms were suppressed," prompting them to float "re-consideration of the AAMI guidelines for maximum alarm latency." | They never let the *model* choose how long to wait. Latency-as-a-continuum, decided per alarm, is unexplored. |
| G4 | **No abstention; ambiguous alarms discarded** | Gold standard required a two-thirds majority; "Reject" (unreadable) and "Uncertain" alarms were thrown out. | Real ICUs can't discard ambiguous alarms — those are where fatigue bites. A binary true/false with no "I don't know" is the wrong output shape. |
| G5 | **Black-box verdicts, no explanation** | Every entry was rule-based or classical ML; no explanation surface is reported or evaluated. | Alarm fatigue is partly a *trust* problem. A silent verdict a nurse can't interrogate won't be trusted. |
| G6 | **The paper admits its own evaluation leaks** | The best ensemble's cutoff "was selected on the test data, so these results should not be considered truly out of sample." Hidden test set → leaderboard non-reproducible. | Rigorous, leak-free external validation is itself a contribution the field now openly asks for. |

---

## 2. Our contributions (one coherent story, not four bolt-ons)

**C1 — Cross-dataset generalization (headline, attacks G1).**
Train on CinC-2015 VT alarms, test **zero-shot on VTaC** (different hospitals, different
manufacturers). Report the honest performance drop, then narrow it with domain-generalization
techniques (per-record feature normalization, domain-adversarial training, robust SQI features).
*This is the India-readiness result.*

**C2 — Adaptive-latency selective prediction (freshest, attacks G3 + G4).**
Reframe from "decide now vs. wait 30 s" to **decide-when-confident, wait-when-not**, with a
three-way output **SUPPRESS / KEEP / DEFER**. Enforce a true-alarm sensitivity floor (motivated
directly by the challenge's 5×FN penalty). Deliver a *latency–sensitivity curve* the 2015 binary
framing could not produce.

**C3 — Trust layer: explanations + calibration (attacks G5 + part of G6).**
Per-alarm reasons (attention/Grad-CAM on the waveform, SHAP over SQI features) plus calibrated
probabilities, so a stretched nurse can see *why* an alarm was flagged and how sure the model is.

**C4 — Rigor as a contribution (attacks G6).**
Nested cross-validation with **no test-set tuning**, calibration curves (ECE), confidence
intervals, and honest external validation. Explicitly state: 5-fold CV on the 750 public records
(the 500-record test set is unreleased).

**Positioning sentence (use verbatim in the paper's intro):**
> The 2015 challenge asked whether false alarms can be suppressed *in-distribution*; we ask whether
> they can be suppressed on hospitals the model never saw, without ever silencing a true emergency,
> while choosing how long to wait per alarm — and we show what it costs.

---

## 3. The India-specific angle (what makes this *ours*, and useful)

The India relevance is not cosmetic — it changes which technical problems matter.

**Why generalization = India-readiness.** Indian ICUs run a heterogeneous, cost-driven mix of
monitors (domestic brands such as BPL and Skanray, refurbished units, and international brands) —
*none* of which appear in CinC-2015 or VTaC, and for which *no labelled false-alarm data exists*.
A model that only works in-distribution is useless there. C1 (zero-shot cross-hospital transfer)
is the direct technical response to "deploy where you have no local training data."

**Why the resource setting changes the design.**
- **Higher nurse-to-patient ratios.** Indian ICUs frequently exceed the ideal ICU nursing ratio
  due to workforce shortages, so alarm fatigue is *more* dangerous and the DEFER output (C2) —
  routing only genuinely ambiguous alarms to an already-stretched nurse — matters more.
- **Older / budget monitors → noisier signals and worse built-in alarm logic → more false alarms.**
  This raises the payoff of SQI-driven artifact rejection and robustness (C1).
- **Retrofit, not rip-and-replace.** Hospitals can't replace fleets, so the product must be a
  *software layer on top of existing monitors*, ideally edge-deployable and low-compute
  (Indian ICUs face power/connectivity constraints). Design the model to run on a cheap device.
- **Multilingual nurse-facing UI** (Hindi / Tamil / regional) in the product.

**The India experiment you *can* run with no Indian data (C1'):**
**Few-shot local calibration.** Using VTaC as a stand-in "new hospital," measure how many
locally-labelled alarms (k = 0, 10, 25, 50, 100, …) are needed to fine-tune a 2015-trained model
back to acceptable performance. The deliverable is a learning curve answering a concrete
procurement question: *"To bring this to an Indian ICU, how much local labelling is actually
required?"* That is genuinely useful and needs zero Indian data to produce.

**Honest limitation (state it plainly in the paper).** There is no widely-available open Indian
ICU alarm waveform dataset — which is itself part of the problem. We therefore *design for* and
*argue* Indian deployability via cross-hospital generalization and few-shot calibration; we do not
*claim measured* Indian performance. A small prospective pilot at a local hospital is future work.

*(When you write the paper, back the nurse-ratio and monitor-heterogeneity claims with citations —
they are directional here and should be sourced.)*

---

## 4. Experiment table (what proves each claim)

Label 1 = TRUE alarm, 0 = FALSE. Headline metric = challenge score `(TP+TN)/(TP+TN+FP+5·FN)`;
always co-report **true-alarm sensitivity** (must stay ~100%) and AUROC.

| ID | Claim it proves | Setup | Train → Test | Primary metric | "Success" |
|----|-----------------|-------|--------------|----------------|-----------|
| **E1** | We reproduce the benchmark | 5-fold CV on the 750 public records | CinC-2015 → CV folds | Challenge score, AUROC, per-arrhythmia | In the range of published entries (~75–84) |
| **E2** | Models **don't** transfer across hospitals (the gap) | Zero-shot transfer, VT alarms | CinC-2015 → VTaC | Score + AUROC + **Δ vs E1** | A real, quantified drop (that's the finding) |
| **E3** | We can **narrow** the gap | Add domain generalization (feature norm / DANN / robust SQI) | CinC-2015 → VTaC | Recovered score vs E2 | Gap shrinks meaningfully |
| **E4** | Adaptive latency beats fixed | Per-alarm wait vs fixed 0 s / 30 s | CinC-2015 (CV) + VTaC | FA-suppression @ fixed true-sens, **mean latency** | More suppression at lower mean latency than fixed-30 s |
| **E5** | Deferral is safe | Selective prediction: coverage vs risk | CinC-2015 (CV) + VTaC | True-alarm sens ≥ 99% at operating point; defer-rate | High FA suppression at ~100% true-sens |
| **E6** | **India:** few-shot local calibration | Fine-tune on k local labels (VTaC as "new hospital") | CinC-2015 → VTaC(+k) | Score vs k (learning curve) | Small k recovers most of the gap |
| **E7** | Explanations are plausible | SHAP + attention on n worked examples | (any trained model) | qualitative + SQI-importance | Reasons align with signal-quality / HR-mismatch |
| **E8** | Rigor / calibration | Nested CV, calibration, CIs | CinC-2015 | ECE, CI widths | No test-set tuning; calibrated probabilities |

**The four figures/tables that carry the paper:**
1. T-E1: per-arrhythmia benchmark table (shows you handle all five, incl. the hard VTA).
2. **T-E2/E3: the cross-dataset generalization table** — the money result.
3. F-E4/E5: the latency-/coverage-vs-true-sensitivity curves — the novel methodological figure.
4. **F-E6: the few-shot local-calibration learning curve — the India deployability figure.**
