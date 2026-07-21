# SilentGuard — ICU False-Alarm Intelligence
### Full project roadmap: research paper + deployable product

**One-line pitch:** An explainable, safety-constrained system that sits between an ICU bedside monitor and the nurse station, learns to silence false arrhythmia alarms without ever silencing a real one, and proves it generalizes across hospitals it was never trained on.

*(Name is a placeholder — swap in whatever you like. "SilentGuard", "AlarmSense", "QuietICU".)*

---

## 1. Why this problem is worth a semester

ICU bedside monitors fire constantly, and false alarm rates run as high as ~90%. Nurses become desensitized ("alarm fatigue"), response times slow, patients suffer from noise-induced delirium, and — the real danger — a genuine emergency can get lost in the noise. It is a documented, ongoing patient-safety problem, not a hypothetical.

It's a good *academic* fit because it is a **signal problem** (ECG / arterial blood pressure / photoplethysmogram waveforms), which is richer and more defensible than another tabular CSV, and it maps cleanly onto the course:
- **Module 3** — full ML pipeline: loading, cleaning, feature extraction, training, evaluation.
- **Module 5** — predictive modelling done properly (response variable, train/test, model building, improvement).
- **Module 7** — this *is* IoT / bedside-monitoring emerging technology.

---

## 2. The research contribution (what makes it a paper, not a clone)

Be clear-eyed: plain "true vs. false alarm" classification is close to solved. The 2015 PhysioNet challenge drew dozens of entries, and a 2025 paper already reports ROC-AUC > 0.96 on VT alarms. **Accuracy alone will not be publishable.** Your novelty is the combination below — each part is under-explored, and each doubles as a product feature.

**Contribution 1 — Cross-dataset / cross-manufacturer generalization (headline).**
Train on the PhysioNet 2015 data, then test on VTaC — a *different* set of hospitals and monitor manufacturers — and quantify the drop. Most papers train and test on one dataset and never check whether the model survives a new hospital. Showing (and then narrowing) that generalization gap is a genuine, honest contribution.

**Contribution 2 — Safety-constrained selective prediction.**
Reframe the task from binary (suppress / keep) to **three-way: suppress / keep / defer-to-nurse.** Tune the operating point so true-alarm sensitivity stays at ~100% (missing a real arrhythmia is catastrophic — the challenge scoring itself penalizes a suppressed true alarm 5× harder than a false alarm let through). The model only silences alarms it is confident about and *abstains* into a "defer" zone otherwise. Framing alarm reduction as selective prediction with a hard safety floor is fresh.

**Contribution 3 — Explainability for clinician trust.**
A nurse will not trust a black box that silences alarms. Produce a per-alarm explanation: which signal segment and which signal-quality features drove the "false" verdict (attention weights / Grad-CAM on the CNN, SHAP on the engineered features). Report whether the explanations are clinically plausible.

**The paper's thesis in one sentence:** *"A false-alarm suppressor is only useful in practice if it (a) generalizes to hospitals it never saw, (b) never suppresses a true emergency, and (c) can explain itself — and here is a system that does all three."*

---

## 3. The data (open, no hospital access, no credentialing wall for the core)

### Dataset A — PhysioNet/CinC Challenge 2015 (primary training data)
- **1,250 recordings** total: **750 public (train)** + **500 hidden (test)**. The test set was never released, so everyone reports **k-fold cross-validation on the 750**. Plan for 5-fold CV from day one.
- **Five life-threatening alarm types:** Asystole (ASY), Extreme Bradycardia (EBR), Extreme Tachycardia (ETC), Ventricular Tachycardia (VTA), Ventricular Flutter/Fibrillation (VFB).
- Each recording: **two ECG leads + one or more pulsatile waveforms** (arterial blood pressure ABP and/or PPG/PLETH).
- **250 Hz, 12-bit**, band-pass filtered 0.05–40 Hz. **5 minutes before** the alarm (real-time track) + **30 s after** (retrospective track).
- Each alarm labelled true/false by ≥2 expert annotators.
- **VTA is by far the hardest** class (highest false-alarm rate, lowest accuracy in every paper) — which is exactly why VTaC exists and why you should give VT special focus.

### Dataset B — VTaC (external validation + a second experiment)
- **5,037 labelled VT alarms: 1,441 true / 3,596 false**, from **three US hospitals and three monitor manufacturers** — the diversity is the whole point.
- 6-minute segments (5 min before + 1 min after), 250 Hz, ≥2 ECG leads + pulsatile waveforms, each labelled by ≥2 experts.
- Openly available on PhysioNet (NeurIPS 2023 Datasets & Benchmarks). *Note: VTaC download does require a free PhysioNet account and clicking the data-use agreement — start this in Week 1 so it's ready when you need it.*

### The scoring metric you must report
The official challenge score is asymmetric and you should adopt it so your numbers are comparable to the literature:

```
Score = (TP + TN) / (TP + TN + FP + 5·FN)
```

The `5·FN` term is the safety floor: suppressing a true alarm (a false negative) is punished 5× harder than letting a false alarm through. Report this **and** standard metrics (ROC-AUC, sensitivity/specificity, PPV) **and** true-alarm sensitivity separately (this is the one that must stay near 100%).

---

## 4. The technical pipeline (how the ML actually works)

```
Raw waveforms (ECG × 2, ABP, PPG)
        │
   [1] Preprocessing & denoising      ← band-pass filter, baseline wander removal, normalization
        │
   [2] Signal Quality Indices (SQIs)  ← detect noise/artifact segments (this is where most FA come from)
        │
   ├─────────────────────────────┐
[3a] Handcrafted feature track   [3b] Raw-waveform deep track
   (beat detection, HR, RR        (1D-CNN / CNN-LSTM on the
    intervals, morphology,         final N seconds before alarm)
    cross-signal agreement)
   │                               │
   └──────────────┬────────────────┘
        [4] Fusion + classifier (RF baseline → CNN → attention CNN-LSTM)
        │
        [5] Safety-constrained decision layer  → SUPPRESS / KEEP / DEFER
        │
        [6] Explainability layer  → attention map + top SQI/feature reasons
```

**[1] Preprocessing.** Load with the `wfdb` Python package. Band-pass filter, remove baseline wander, z-normalize per channel. Window the last 10–16 s before the alarm (the informative part).

**[2] Signal Quality Indices (SQIs).** This is the single highest-leverage classical technique and the npj Digital Medicine paper's key trick: most false alarms are caused by *noise/artifact*, so compute per-channel quality scores (e.g., bSQI comparing two beat detectors, kurtosis/skewness, power-spectrum ratios) to distinguish "the signal is garbage" from "the signal shows a real arrhythmia." Implement these yourself — it's real signal-processing engineering and a big chunk of your novelty story.

**[3a] Handcrafted features.** Run QRS/beat detection (Pan-Tompkins, or `gqrs`/`wqrs` from wfdb, or `neurokit2`). Derive heart rate, RR-interval statistics, beat morphology, and — crucially — **cross-signal agreement** (does the ECG-derived heart rate match the ABP/PPG pulse rate? Disagreement often means artifact). Concatenate with the SQIs.

**[3b] Deep track.** A **1D-CNN** on the raw multi-channel waveform learns features you didn't hand-design. Upgrade to a **CNN + LSTM with attention** (the attention weights give you free explainability). Contrastive-learning pretraining is an optional stretch goal (a 2022 paper showed it helps).

**[4] Models, in order of ambition** (build them in this sequence — always have a working baseline):
1. **Random Forest / XGBoost** on handcrafted features + SQIs → your baseline (this is also what the best classical challenge entries used).
2. **1D-CNN** on raw waveforms.
3. **Attention CNN-LSTM**, optionally fusing the handcrafted features → your best model.

**[5] Safety-constrained decision layer.** Instead of thresholding at 0.5, pick two thresholds: above `t_high` → SUPPRESS (confident false), below `t_low` → KEEP (confident true or uncertain-toward-true), in-between → DEFER to nurse. Choose `t_low` on the validation set so that **true-alarm sensitivity ≥ 99%**. Report the trade-off curve: how many false alarms you kill as a function of how much you're willing to defer.

**[6] Explainability.** For the deep model, attention weights or Grad-CAM highlight the waveform region. For the feature model, SHAP ranks the top reasons ("PPG signal quality low + ECG/ABP heart-rate mismatch → likely artifact"). This is what turns a verdict into something a clinician can act on.

**Class imbalance** (far more false than true alarms) is real — use class weights, focal loss, or careful resampling, and *never* report plain accuracy as your headline (it's misleading on imbalanced data).

---

## 5. The product / micro-SaaS (the "used in hospitals" demo)

Positioning: **an alarm-intelligence layer that sits between the monitor and the nurse station.** Be honest that a student build won't be clinically deployed (that needs regulatory clearance), but the demo can be genuinely convincing and the architecture production-shaped.

### What it does
- **Live monitor simulation:** stream a recording in real time; render the ECG/ABP/PPG traces; when an alarm fires, show the model's verdict (SUPPRESS / KEEP / DEFER), confidence, and the explanation, in real time.
- **Prioritized alarm queue:** a multi-bed "nurse station" view where alarms are ranked, false ones are visually dimmed/collapsed, and DEFER alarms are flagged for a human.
- **Upload analyzer:** drop in a WFDB/CSV recording, get the full analysis + explanation.
- **Analytics dashboard:** false-alarm-rate reduction over time, per-arrhythmia breakdown, "alarms silenced vs. true alarms preserved" — this is your Module 6 descriptive/prescriptive analytics.

### Architecture (fits the stack you already have)
```
Next.js frontend (Vercel)  ──►  FastAPI model service (Python)  ──►  trained model (.pt / .pkl)
        │                                     │
        └──────────────►  Supabase (Postgres) ◄┘
              (alarm log, verdicts, analytics, auth)
```
- **FastAPI** microservice loads the model and exposes `/analyze` (waveform in → verdict + probability + explanation out). Keep the ML in Python; don't try to run models in the browser.
- **Next.js on Vercel** for the dashboard and live-stream UI (waveform plotting with a canvas/WebGL lib or `plotly`/`d3`).
- **Supabase** (you've got it connected) for the alarm log, verdict history, the analytics queries, and simple auth — this is what makes it a *product* and not just a notebook.
- Stream via WebSocket/Server-Sent Events for the "live monitor" feel.

---

## 6. The three-review roadmap

### Review 1 — Foundation, data, descriptive analytics *(Modules 1–3, 6-descriptive)*
- PhysioNet 2015 downloaded and loading via `wfdb`; VTaC access request submitted.
- Preprocessing pipeline working; SQIs implemented.
- Thorough EDA: class balance per arrhythmia type, true/false rates, example waveforms of true vs. false alarms, noise characterization.
- **Baseline model:** Random Forest on handcrafted features + SQIs, evaluated with 5-fold CV using the challenge score.
- **Deliverable:** clean data pipeline + EDA report + a working baseline with honest numbers. Explicitly say "this maps to the ML pipeline from Module 3."

### Review 2 — Predictive modelling & the safety constraint *(Modules 3, 4, 5)*
- 1D-CNN and attention CNN-LSTM trained; comparison table vs. baseline (ROC-AUC, sensitivity/specificity, challenge score).
- Class-imbalance handling implemented and ablated.
- **Safety-constrained decision layer** built; report the suppress/keep/defer trade-off and prove true-alarm sensitivity ≥ 99%.
- Justify your metric choices by connecting to Module 4 (measuring quality — why sensitivity matters more than accuracy here).
- **Deliverable:** best model + the safety layer + error analysis (where does it fail? VT, as expected).

### Review 3 — Generalization, explainability, product *(Modules 6, 7)*
- **Cross-dataset test:** train on 2015, evaluate on VTaC → report the generalization gap and any domain-adaptation fix you try. *This is the research headline.*
- **Explainability** layer complete, with a few worked examples of plausible explanations.
- **The live product/website** deployed and demoable end-to-end.
- **Deliverable:** the "so what" — a working system, a generalization result, and a paper draft.

---

## 7. The paper plan

- **Target:** a student-friendly but real venue — an IEEE/Springer conference (e.g., an ICACCI / TENCON / a healthcare-informatics workshop) or a mid-tier journal. Even if you don't submit, writing it to submission quality is what impresses in the final review.
- **Structure:** Abstract → Introduction (alarm fatigue, the gap: generalization + safety + trust) → Related Work (2015 challenge entries, VTaC, contrastive-learning approach) → Data → Methods (pipeline, SQIs, models, safety layer, explainability) → Experiments (in-dataset results, cross-dataset results, ablations) → Discussion (limitations, honestly) → Conclusion.
- **The tables/figures that carry it:** (1) model comparison on 2015; (2) the **cross-dataset generalization table** (train-2015 / test-VTaC) — this is the money figure; (3) suppress/keep/defer trade-off curve; (4) example explanations.
- **Framing that lands:** don't claim SOTA accuracy. Claim *"a realistic, deployable, trustworthy pipeline, evaluated the way a hospital would actually need."* Honesty about the generalization drop is a strength, not a weakness — reviewers respect it.

---

## 8. Tech stack

| Layer | Tools |
|---|---|
| Signal I/O | `wfdb` (PhysioNet format) |
| Signal processing / features | `scipy`, `numpy`, `neurokit2` (ECG/PPG), custom SQIs |
| Classical ML | `scikit-learn`, `xgboost` |
| Deep learning | `PyTorch` |
| Explainability | `shap`, Grad-CAM / attention hooks |
| Backend | `FastAPI`, `uvicorn` |
| Frontend | Next.js (Vercel), `plotly`/`d3` for waveforms |
| Data / auth / analytics | Supabase (Postgres) |
| Experiment tracking | Weights & Biases or a simple CSV/MLflow log |

---

## 9. Suggested team split (if you're a team of 3–4)
- **Signals & features lead** — preprocessing, SQIs, beat detection, handcrafted features.
- **Modelling lead** — CNN/LSTM, safety layer, cross-dataset experiments, explainability.
- **Product lead** — FastAPI service, Next.js dashboard, Supabase, live-stream demo.
- **Paper & evaluation lead** — experiment design, metrics, tables/figures, writing (this person keeps everyone honest on rigor).

Everyone shares Review-prep duties; the roles are for *ownership*, not silos.

---

## 10. Risks & honest mitigations
- **Small labelled data (750 recordings).** → Heavy cross-validation, strong regularization, class weighting, and lean on the handcrafted+SQI features (they're data-efficient) before going all-in on deep nets. Don't over-claim on tiny test folds.
- **Hidden 2015 test set.** → You literally cannot reproduce the official leaderboard; state clearly you use 5-fold CV on the public 750, which is standard and accepted in the literature.
- **VTaC is VT-only.** → Your cross-dataset test is specifically about VT (fine — VT is the hard, important case; scope the generalization claim to VT honestly).
- **Compute for deep models.** → Waveform 1D-CNNs are light; a single GPU (Colab/Kaggle free tier) is enough. Keep windows short (10–16 s @ 250 Hz).
- **Scope creep on the product.** → Ship the single-recording analyzer + one live-stream demo first; multi-bed dashboard and analytics are enhancements, not blockers.
- **"It's been done."** → It has, for accuracy. It has *not* been done as generalization + safety-abstention + explainability together, evaluated cross-hospital. Keep the framing on that.

---

## 11. Week-1 concrete first steps
1. Make a PhysioNet account and **submit the VTaC data-use request today** (so access is ready by Review 3).
2. Download the **2015 Challenge training set (750 records)**; load one recording with `wfdb`; plot the ECG/ABP/PPG for one true and one false alarm.
3. Stand up a repo with a clean structure (`data/`, `preprocessing/`, `features/`, `models/`, `service/`, `web/`, `paper/`).
4. Implement preprocessing + one SQI + beat detection on a single record end-to-end.
5. Get a Random Forest running on 20 records as a "hello world" of the whole pipeline — prove the loop works before scaling.

---

## 12. Anchor references (real, citable)
- Clifford et al., *The PhysioNet/Computing in Cardiology Challenge 2015: Reducing False Arrhythmia Alarms in the ICU*, CinC 2015. (The dataset + challenge.)
- *Reduction of false alarms in the ICU using an optimized machine learning based approach*, npj Digital Medicine, 2019. (Signal-quality-indices + Random Forest; top real-time score.)
- *A contrastive learning approach for ICU false arrhythmia alarm reduction*, 2022. (CNN + contrastive learning on the 2015 data.)
- Lehman et al., *VTaC: A Benchmark Dataset of Ventricular Tachycardia Alarms from ICU Monitors*, NeurIPS 2023 Datasets & Benchmarks. (Your external-validation dataset.)
- *Reducing False Ventricular Tachycardia Alarms in ICU Settings: A Machine Learning Approach*, arXiv 2503.14621, 2025. (Recent VTaC results — >0.96 AUC; shows why accuracy alone isn't enough.)

---

*Build order in one line: get the pipeline working on one record → baseline RF with CV → deep models → safety layer → cross-dataset test → explainability → wrap it in the product → write the paper around the generalization result.*
