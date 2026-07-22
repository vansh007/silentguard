# PROJECT_LOG.md — research & engineering diary

> Honest, chronological record of what we actually did, what broke, and how we fixed it —
> the source of truth for the paper's Methods and (especially) its lessons/limitations.
> Every number states its evaluation protocol. All work is on the **PhysioNet/CinC 2015**
> dataset only (750 public records; the 500-record test set is unreleased, so we use 5-fold
> cross-validation, and for generalization we hold out whole arrhythmia types).
>
> Label convention: **1 = TRUE alarm, 0 = FALSE alarm**. Headline metric = challenge score
> `(TP+TN)/(TP+TN+FP+5·FN)` (a suppressed TRUE alarm is penalised 5×). True-alarm sensitivity
> is always co-reported and held at a ≥99% floor.

---

## Session 1 — Baseline engine (2026-07-21) · build steps 1–5 · contribution E1
Commits `8f92ba0 → 38f53a9`.

**Goal.** Get an end-to-end classical pipeline running and report a real challenge score
(the E1 "we reproduce the benchmark" claim), keeping a working baseline before anything fancy.

**Built.** WFDB record I/O + header label parser (`data/io.py`, `data/labels.py`; the CinC-2015
label lives in the `.hea` comment as `['<ArrhythmiaType>', '<True/False alarm>']`), ECG
preprocessing (median-cascade baseline removal → 0.5–40 Hz zero-phase band-pass → robust MAD
normalize), 33 handcrafted features (4 SQIs: bSQI/kurtosis/spectral/baseline-power; HR/RR stats +
pause features; ECG-vs-pulse cross-signal agreement; channel-availability flags; alarm-type
one-hot), and RandomForest + XGBoost with class weighting evaluated by 5-fold CV.

**Problem faced — the operating threshold overfit, silently gutting sensitivity.**
The first full run selected the KEEP/SUPPRESS threshold on the model's *resubstitution* (training)
probabilities. Trees fit training almost perfectly, so those probabilities are over-confident and
the optimizer picked a threshold far too high, which over-suppressed true alarms on held-out data:
- **Before (resubstitution threshold):** RF challenge 0.565, **true-sens 0.697**; XGB 0.495, sens 0.595.

**Fix.** Select the threshold on **inner-CV out-of-fold probabilities** of each training fold only
(nested CV), then apply to the held-out fold — leak-free, and the operating point lands near the
Bayes-optimal `1/6` for the 5×FN cost (suppress only when P(false) is high).
- **After (nested-CV threshold):** RF **0.635 / sens 0.895 / AUROC 0.897**; XGB **0.662 / sens 0.929 / AUROC 0.897**.
  *(Protocol: 5-fold CV on 750 records. Source: `data/processed/baseline_cv_results.csv`.)*

**Learned.** For an asymmetric-cost metric, the threshold is as important as the model, and it must
never be tuned on the data it is scored on. This nested-threshold rule became the project's
standard and is what keeps the ≥99% sensitivity floor honest later.

---

## Session 2 — Single-dataset re-scope + generalization, safety, trust (2026-07-22) · steps 7,8,11 · C1/C2/C3
Commits `99a9ae3 → cf69b48`.

**Goal & why.** The original plan tested cross-*dataset* transfer (train CinC-2015 → test VTaC) as
the headline generalization result. We could not obtain VTaC and re-scoped the project to a single
dataset, replacing the headline with a within-dataset generalization test.

**Problem faced — VTaC would not download.** The 2.7 GB VTaC download stalled at ~12 KB/s in our
environment (a control test to a fast CDN returned ~0 B/s: outbound bandwidth is throttled). At
that rate the download was ~65 h. **Decision:** drop VTaC entirely as non-essential and re-scope to
CinC-2015 only (documented permanently in CLAUDE.md/NOVELTY.md/DATASETS.md). Cross-dataset transfer
(old E2/E3) and few-shot local calibration (old E6) became future work.

**New headline — Leave-One-Arrhythmia-Out (LOAO, C1).** Train on four of the five arrhythmia types,
test zero-shot on the held-out fifth, repeat ×5. This operationalises the 2015 paper's own finding
("there was no best general algorithm") as a real distribution-shift stress test needing no second
dataset. Built in `models/domain.py`, with the threshold chosen on the **training types only**
(never the held-out type).

**Investigated — Leave-One-Source-Out (LOSO, C1b): NOT feasible.** We scanned all 750 `.hea`
headers for hospital/manufacturer/monitor/model tags: every header has exactly two comment lines
(arrhythmia + true/false) and **no source field** — consistent with the challenge deliberately
filtering out manufacturer-identifying spectra. We recorded this as a limitation rather than
fabricating sources.

**Design decision — LOAO uses physiological features only.** The alarm-type one-hot
(`alarm_TACHY`, …) is degenerate under LOAO: for a held-out type its column is constant (0) in
training and out-of-distribution (1) at test, so it carries no learnable signal for an *unseen*
type and only injects noise. We verified this empirically (per-type AUROCs barely moved; pooled
sensitivity was *better* without it) and excluded it from LOAO; the in-distribution model and the
deployed model keep it, because a monitor always knows the alarm type in production.

**Also built.** Safety layer (`models/safety.py`, C2): SUPPRESS/KEEP/DEFER with `t_high` calibrated
so true-alarm sensitivity ≥ 99%, plus `choose_latency()`. Trust layer (`explain/explain.py`, C3):
SHAP top-reasons over the feature model + reliability curve/ECE.

**Key numbers (RF; 5-fold CV / held-out-arrhythmia on 750; `data/processed/generalization_results.csv`).**
- In-distribution reference: challenge **0.635**, true-sens 0.895, AUROC 0.897.
- LOAO pooled: challenge **0.290**, true-sens 0.45 → **generalization gap ≈ −0.35**.
- Per held-out type: ASYSTOLE 0.60 (best, AUROC 0.805) · VFIB 0.52 · VTACH 0.37 · BRADY 0.23 ·
  **TACHY 0.11 — worst, AUROC 0.375 (below 0.5 → inverted ranking).**
- Safety @ ≥99% floor: true-sens 0.993, false-alarm suppression **7.9%**, **defer rate 0.77**.

**Learned.** (1) Models generalise badly to arrhythmias they never trained on; **TACHY is worst**
because the four training types are false-dominated, so a model that never saw tachycardia learns a
"probably artifact" prior and *inverts* on tachy alarms (which are ~93% true). (2) At a strict 99%
safety floor, a 0.90-AUROC model can only *safely* auto-suppress ~8% of false alarms and must defer
the rest — the honest cost of safety, and the motivation to try a stronger model next.

---

## Session 3 — Deep model + ensemble (2026-07-22) · build step 6
Commits `47f8d57 → c607f3f`.

**Goal & why.** The 77% defer rate at the 99% floor was driven by the baseline's ~0.90 AUROC. Build
a deep model on the raw waveform to lift AUROC and therefore defer less while staying safe.

**Built.** `models/cnn.py`: a 1-D CNN and an attention CNN-LSTM over a fixed 3-channel waveform
tensor `[primary ECG, secondary ECG, pulse]` (missing channels zero-filled; ~16 s @ 250 Hz),
balanced-class-weighted cross-entropy, early stopping on a held-out validation split, and the same
val-split threshold rule. Attention weights are exposed for later explanations.

**Problem faced — the MAD normalizer blew up and silently killed CNN training.**
First CNN runs would not learn: validation loss was pinned at **0.6932 = ln 2** (a constant-0.5
predictor) and test AUROC sat at ~0.5. Diagnosis of the input tensor revealed pathological values:
**min/max ≈ ±1.2 million, per-channel std ≈ 5231.** Root cause: the robust MAD normalizer divides
by the median absolute deviation, which is near-zero on flat/low-variance ECG segments, so a few
samples explode to ~10⁶. Trees never noticed (scale-invariant, and they consume bounded SQI/HR
features), but such inputs destroy CNN/BatchNorm training.

**Fix.** Clip each preprocessed channel to **±8 z-units** in the waveform-tensor builder (standard
for ECG). Immediately after, a single fold trained to **AUROC 0.894** (from ~0.5). This is logged
as a limitation to watch: robust normalization needs a bound when feeding a neural net.

**Finding — deep loses alone but helps in an ensemble.** With only 750 records the deep models did
**not** beat the RandomForest, and *alone* they deferred *more*:
- (5-fold CV) RF AUROC 0.897 · **1-D CNN 0.846** · Attn-CNN-LSTM 0.775.
- Deferral alone: CNN 0.91, attn 0.92 vs RF 0.77.

But the handcrafted-feature RF and the raw-waveform CNN are **complementary** — the features encode
strong physiological priors (HR, pauses, SQIs) the CNN would have to learn from scratch, while the
CNN sees morphology the features summarise away. An **equal-weight (0.5/0.5, no tuning) RF+CNN
ensemble** beat both. *(Numbers here were later found to include a threshold leak — see Session 4;
`data/processed/deep_vs_rf_results.csv` holds these interim values.)*

**Learned.** On small clinical datasets, deep models are best used as a *complementary view*
fused with strong handcrafted features, not as a standalone replacement.

---

## Session 4 — Rigor fix + freeze the final engine (2026-07-22)
Commits `ba915f2 → d3a3c14`.

**Goal.** Before building the product, make the ensemble evaluation fully leak-free and freeze the
engine behind one inference entry point.

**Problem faced — a leaky out-of-fold threshold inflated the ensemble.** Session 3's ensemble
selected its KEEP threshold on the very out-of-fold predictions it then scored (in-distribution and,
worse, in LOAO). Because the threshold saw the test labels, the challenge scores were optimistic —
especially LOAO, where picking the threshold on the held-out arrhythmia's own predictions is a real
leak.

**Fix — one joint, same-protocol evaluation for all models** (`models/ensemble.py::joint_cross_validate`,
`joint_loao`). Within every fold (and every held-out arrhythmia) RF and CNN are trained on a *fit*
split, each model's threshold (RF, CNN, ensemble) is chosen on a **validation split held out from
training**, and only then are they scored on the untouched test fold. Effect of removing the leak
(RF+CNN ensemble):

| metric | leaky (Session 3) | **leak-free (Session 4)** |
|---|---|---|
| in-distribution challenge score | 0.729 | **0.713** |
| **LOAO pooled challenge score** | **0.484** | **0.323** |
| **LOAO pooled true-sensitivity** | **0.89** | **0.38** |

The LOAO number was inflated by ~0.16 and its sensitivity by more than 2×. The corrected figure is
the honest one. *(Protocol: leak-free, same for every row. Source: `data/processed/final_ensemble_results.csv`.)*

**Frozen final engine.** `FrozenEnsemble` serializes RF (`rf.joblib`) + CNN (`cnn.pt`) + the
safety thresholds (calibrated on leak-free OOF) + metadata to `data/processed/models/ensemble/`,
and exposes a single product entry point `predict_one(record)` →
`{p_false, decision (SUPPRESS/KEEP/DEFER), confidence, reasons, latency_used_s}`. Verified on record
`a103l` (→ DEFER, p_false 0.825). Smoke test covers `predict_one` + a save/load round-trip.

**Final leak-free numbers (5-fold CV / held-out-arrhythmia on 750; `final_ensemble_results.csv`).**
| model | in-dist score | true-sens | AUROC | LOAO pooled | safety FA-supp @≥0.99 | defer |
|-------|--------------|-----------|-------|-------------|-----------------------|-------|
| RandomForest | 0.641 | 0.898 | 0.893 | 0.235 | 0.068 | 0.779 |
| 1-D CNN | 0.611 | 0.895 | 0.846 | 0.290 | 0.086 | 0.912 |
| **RF+CNN ensemble (FINAL)** | **0.713** | **0.939** | **0.916** | **0.323** | **0.311** | **0.624** |

**Learned / answer to the driving question.** *Does a better AUROC let us auto-suppress more and
defer less while staying safe?* **Yes — via the ensemble.** AUROC 0.893 → 0.916 raises false-alarm
suppression 6.8% → **31.1%** and cuts the defer rate 0.779 → **0.624** at the same ≥99% true-alarm
sensitivity floor. Generalization to unseen arrhythmias remains hard for every model (ensemble LOAO
0.323, TACHY worst) — the standing limitation and the strongest argument that deployment on a new
monitor/population needs local validation.

---

## Running limitations ledger (for the paper)
- **Single dataset (CinC-2015).** No measured cross-hospital or Indian performance; LOSO and
  few-shot local calibration are future work pending a second, source-tagged dataset.
- **Hidden test set.** All numbers are 5-fold CV / held-out-arrhythmia on the 750 public records;
  no official leaderboard reproduction is possible.
- **Poor unseen-arrhythmia generalization**, TACHY worst (inverted ranking) — a filter is only safe
  on morphologies represented in training.
- **Safety vs. workload.** At the 99% floor even the ensemble defers ~62% of alarms; higher
  auto-decision coverage needs a stronger model or more data.
- **Robust-normalize + neural nets** need an explicit clip (±8) or they blow up on flat signals.
- **Small-data deep learning:** the CNN helps only in ensemble, not standalone.
