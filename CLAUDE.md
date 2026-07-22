# CLAUDE.md — project context for Claude Code

> Read this first. It tells you what this project is, the hard rules you must never break,
> where everything lives, and what to build next. Keep it updated as the project evolves.

## What this project is
**Team Sentinel** is building an ICU false-alarm reduction system: given the physiological
waveforms leading up to a bedside-monitor arrhythmia alarm, decide whether the alarm is
**true** (real, must reach the nurse) or **false** (an artifact/noise that should be suppressed).

The deliverable is **two things at once**:
1. A **research study** (paper) whose contribution is NOT raw accuracy but three things
   that matter for real deployment.
2. A **working web product** (FastAPI + Next.js + Supabase) that demos live alarm triage.

## SCOPE (permanent, 2026-07-22): SINGLE DATASET — PhysioNet/CinC 2015 ONLY.
VTaC is dropped entirely (it would not download in our environment and is non-essential).
Do NOT reintroduce a second dataset. All experiments run on the 750 public CinC-2015 records.

## The research contribution (the "why" behind design choices)
Full gap analysis + experiment table: **NOVELTY.md** (read it before designing experiments).
Positioning is against the benchmark paper (Clifford et al., CinC 2015) — we do NOT try to beat
its top score; we attack the open problems it exposed. Four locked contributions:
1. **C1 Leave-One-Arrhythmia-Out (LOAO) generalization (headline)** — train on four of the five
   arrhythmia types, test zero-shot on the held-out fifth; repeat ×5. Measures generalization to an
   arrhythmia pattern never seen in training, and the gap vs the in-distribution baseline. This
   operationalizes the 2015 paper's "no best general algorithm" finding *within* CinC-2015, with no
   second dataset. **C1b Leave-One-Source-Out (LOSO) was investigated and is NOT feasible** — the
   headers carry no hospital/manufacturer tags (see NOVELTY.md §2). *LOAO is our deployability proxy.*
2. **C2 Adaptive-latency selective prediction** — SUPPRESS / KEEP / DEFER with a true-alarm
   sensitivity floor AND a per-alarm choice of how long to wait (generalizes the 2015 binary
   real-time/retrospective split).
3. **C3 Trust layer** — per-alarm explanations (SHAP over features; attention/Grad-CAM once the deep
   model lands) + calibration (reliability curve + ECE).
4. **C4 Rigor** — nested CV, no test-set tuning, calibration curves, honest reporting.

## India framing (the deployment target — DESIGN & ARGUMENT ONLY, not measured)
No false-alarm model has been trained on Indian ICU data and no open Indian ICU alarm dataset
exists — so an in-distribution model is useless there. Our LOAO generalization result (C1) is a
*proxy* argument for "deploy where you have no local training data" (a new setting surfaces alarm
morphologies the training set under-represents). Resource-setting implications baked into the
design: robustness to noisy/budget monitors (SQIs matter more), DEFER routing under high
nurse-to-patient ratios (C2), edge/low-compute + retrofit-on-existing-monitors for the product,
multilingual nurse UI. Honest limitation: **because we are single-dataset, we design/argue Indian
and cross-hospital deployability; we do NOT claim measured cross-hospital/Indian performance.**
Measured cross-hospital validation, LOSO, and few-shot local calibration are future work pending a
second, source-tagged dataset.

## HARD RULES — do not violate
- **Scoring metric is asymmetric.** Official challenge score:
  `Score = (TP + TN) / (TP + TN + FP + 5*FN)`. A false negative (suppressing a TRUE alarm)
  is 5x worse than a false positive. Optimize with this in mind. Always report
  **true-alarm sensitivity separately** and keep it near 100%.
- **Never report plain accuracy as the headline** — the data is imbalanced (far more false
  than true alarms). Use ROC-AUC, sensitivity/specificity, PPV, and the challenge score.
- **The 2015 test set (500 records) is hidden/unreleased.** You CANNOT reproduce the official
  leaderboard. Use **5-fold cross-validation on the public 750 training records**. Say so
  explicitly anywhere results are reported.
- **Single dataset only (CinC-2015).** Do not add VTaC or any second dataset. For the LOAO headline,
  the "test set" is the held-out arrhythmia type; still use 5-fold CV for the in-distribution baseline.
- **Never commit data.** Everything under `data/` is git-ignored except `.gitkeep`.
- **Patient data is de-identified but still sensitive** — don't upload it anywhere or embed it
  in the repo/artifacts.

## Repo layout
```
config/          central config (paths, sample rate, thresholds) — config.yaml
data/raw/        downloaded datasets go here (git-ignored) — see DATASETS.md
data/interim/    intermediate cached arrays
data/processed/  model-ready feature tables
src/silentguard/ the Python package (the actual code)
  data/          wfdb loading + label parsing
  preprocessing/ filtering, baseline-wander removal, normalization
  features/      signal-quality indices (SQI) + waveform features (HR, RR, morphology)
  models/        baseline (RF/XGB), cnn (1D-CNN/attention), safety (decision layer)
  evaluation/    metrics (challenge score, sensitivity, etc.)
  explain/       SHAP / attention explanations
scripts/         runnable entrypoints (download, explore, train)
service/         FastAPI model-serving app
web/             Next.js dashboard (live monitor demo)
paper/           paper outline + drafts
notebooks/       exploration
tests/           tests
docs/            roadmap + title page
```

## Dataset (summary — full details in DATASETS.md)
- **PhysioNet/CinC 2015** → `data/raw/challenge-2015/`  (the ONLY dataset; 5 arrhythmia types,
  750 public records). OPEN ACCESS. Signals are WFDB (.hea + .mat) at 250 Hz; load with `wfdb`.
- **VTaC: dropped** (2026-07-22) — would not download here and is non-essential. Do not reintroduce.

## Tech stack & conventions
- Python 3.10+. Use type hints and docstrings. Keep functions pure where possible.
- Config-driven paths: read from `config/config.yaml` via `src/silentguard/config.py`.
  Never hardcode absolute paths.
- Signal libs: `wfdb`, `scipy`, `numpy`, `neurokit2`. Classical ML: `scikit-learn`, `xgboost`.
  Deep: `pytorch`. Explain: `shap`. Backend: `fastapi`+`uvicorn`.
- Keep the ML in Python (the FastAPI service). Do NOT try to run models in the browser.
- Small, testable units. Add a smoke test when you add a module.

## Build order (do NOT skip ahead — always keep a working baseline)
1. [x] `scripts/download_data.sh` works; one record loads via `wfdb`.
2. [x] `preprocessing/filters.py` — bandpass + baseline removal + normalize.
3. [x] `features/sqi.py` — at least one signal-quality index (e.g., bSQI).
4. [x] `features/waveform_features.py` — beat detection + HR/RR + cross-signal agreement.
5. [x] `models/baseline.py` — RandomForest/XGBoost on features, 5-fold CV, challenge score.  <-- REVIEW 1 target (DONE)
6. [x] `models/cnn.py` — 1D-CNN + attention CNN-LSTM on raw waveforms; RF+CNN ensemble is best.
7. [x] `models/safety.py` — SUPPRESS/KEEP/DEFER thresholds; sensitivity floor >= 99%.        <-- REVIEW 2 target (DONE)
8. [x] `models/domain.py` — Leave-One-Arrhythmia-Out (LOAO) generalization; report the gap (C1). <-- REVIEW 3 headline (DONE)
       (LOSO not feasible — no source tags in headers; see NOVELTY.md §2.)
9. [~] adaptive-latency: `choose_latency()` + tests DONE; latency-vs-sensitivity CURVE needs the
       deep/streaming model (per-alarm re-scoring over growing windows) — deferred to step 6.
10.[ ] (was few-shot local calibration — DROPPED with VTaC; future work.)
11.[x] `explain/explain.py` — SHAP + calibration (reliability curve + ECE) (C3). (waveform/attention deferred to step 6)
12.[ ] `service/` + `web/` — the live-triage product (retrofit, edge-friendly, multilingual UI).  <-- NEXT SESSION

## Definition of done (per component)
- A function has: type hints, a docstring, and a matching smoke test.
- A model has: a reproducible train script, saved artifact, and metrics logged to `data/processed/` or a CSV.
- Every reported number states the dataset, the split (CV fold or benchmark split), and the metric.

## Current status
**Single-dataset project (CinC-2015 only). Build steps 1–5, 7, 8, 11 done; Reviews 1–3
targets met. Steps 6 (deep model), 12 (product) remain.** Two runnable entrypoints:
- `python scripts/02_train_baseline.py` — in-distribution RF/XGB baseline (E1).
- `python scripts/03_generalization.py` — LOAO generalization + safety + one explanation.
Features cache: `data/interim/challenge2015_features.csv`. Results CSVs in `data/processed/`.

**E1 — in-distribution 5-fold CV (750 public records; hidden 500-test unavailable):**
| model | challenge score | true-alarm sens. | specificity | ROC-AUC |
|-------|-----------------|------------------|-------------|---------|
| XGBoost | **0.662** | 0.929 | 0.612 | 0.897 |
| RandomForest | 0.635 | 0.895 | 0.640 | 0.897 |
Per-type (XGB): TACHY easy (0.94/AUROC 0.98); VTACH hardest in-distribution (0.57/0.80).

**C1 — LOAO generalization (RF, physiological features; the headline result):**
Pooled score **0.290** (vs 0.635 in-distribution → **gap −0.345**); pooled true-sens 0.45.
Per held-out type: ASYSTOLE 0.60 (generalizes BEST, +0.08), VFIB 0.52, VTACH 0.37, BRADY 0.23,
**TACHY 0.11 — worst, AUROC 0.375 (inverted ranking): a model never trained on tachycardia
wrongly suppresses tachy alarms because the other four types are false-dominated.**
LOSO (C1b): NOT feasible (no source tags in headers).

**Step 6 — deep model (`scripts/04_deep_model.py`, torch installed):** 1D-CNN + attention
CNN-LSTM on the raw 3-channel waveform (fixed [ECG1, ECG2, pulse] tensor, values clipped to ±8
— robust-normalize can explode on flat signals; that bug silently broke training until fixed).
**Deep models alone do NOT beat RF** (small data: CNN AUROC 0.846, attn 0.775 < RF 0.897), and
alone they *defer more* (0.91). **But RF+CNN are complementary — the equal-weight ensemble wins:**
| model | in-dist score | AUROC | LOAO pooled | safety FA-supp @99% | defer |
|-------|--------------|-------|-------------|---------------------|-------|
| RandomForest | 0.635 | 0.897 | 0.290 | 0.079 | 0.767 |
| 1D-CNN | 0.611 | 0.846 | 0.290 | 0.086 | 0.912 |
| Attn-CNN-LSTM | 0.486 | 0.775 | 0.253 | 0.053 | 0.919 |
| **RF+CNN ensemble** | **0.729** | **0.920** | **0.484** | **0.276** | **0.643** |
Fair (identical-protocol) comparisons = AUROC and the safety operating point (both calibrated the
same way for every model). **Answer to "does better AUROC let us defer less?": YES via the
ensemble — AUROC 0.897→0.920 lifts FA-suppression 7.9%→27.6% and cuts defer 0.767→0.643 at the
same ≥99% floor.** (Ensemble challenge-score rows use an OOF-set threshold → treat as indicative;
AUROC + safety are the rigorous numbers.)

**C2 — safety layer (thresholds on 5-fold OOF, identical for every model):** all models hold
true-sens **0.993 ≥ 0.99 floor**; see table above for FA-suppression/defer. `choose_latency()`
implemented+tested (latency-vs-sensitivity curve still needs a streaming/growing-window model).

**C3 — trust:** SHAP top-reasons per alarm (e.g. a suppressed false asystole → "beats present:
n_beats/hr_mean push away from TRUE; high baseline-wander SQI"); calibration ECE ≈ 0.08.

**Env note:** venv at `.venv/`; installed: core + sklearn/xgboost + shap + matplotlib + **torch 2.13**.
fastapi NOT installed (added at step 12). `pip install -e .` done. Data at
`data/raw/challenge-2015/training/` (750 `.hea`+`.mat`). Waveform tensor cached at
`data/interim/challenge2015_waveforms_16s.npz`. VTaC dropped (won't download).

**Next:** step 12 (service/ + web/ product) — serve the **RF+CNN ensemble** with the safety layer
and SHAP/attention explanations; retrofit/edge-friendly/multilingual per the India framing.
Optional research polish: latency-vs-sensitivity curve (needs streaming re-scoring), and making the
ensemble's LOAO threshold fully leak-free. **Website = next session — do NOT touch service/ or web/.**
