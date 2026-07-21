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

## The research contribution (the "why" behind design choices)
Full gap analysis + experiment table: **NOVELTY.md** (read it before designing experiments).
Positioning is against the benchmark paper (Clifford et al., CinC 2015) — we do NOT try to beat
its top score; we attack the open problems it exposed. Four locked contributions:
1. **C1 Cross-dataset generalization (headline)** — train on CinC-2015, test zero-shot on VTaC
   (unseen hospitals/manufacturers); measure the drop, then narrow it. *This is the deployability
   result — and the India-readiness result (see below).*
2. **C2 Adaptive-latency selective prediction** — SUPPRESS / KEEP / DEFER with a true-alarm
   sensitivity floor AND a per-alarm choice of how long to wait (generalizes the 2015 binary
   real-time/retrospective split).
3. **C3 Trust layer** — per-alarm explanations (attention/Grad-CAM + SHAP over SQIs) + calibration.
4. **C4 Rigor** — nested CV, no test-set tuning, calibration curves, honest external validation.

## India framing (the deployment target — shapes design, not cosmetic)
No false-alarm model has been trained on Indian ICU data and no open Indian ICU alarm dataset
exists — so an in-distribution model is useless there. Cross-hospital generalization (C1) IS the
answer to "deploy where there is no local training data." Resource-setting implications baked into
the design: robustness to noisy/budget monitors (SQIs matter more), DEFER routing under high
nurse-to-patient ratios (C2), edge/low-compute + retrofit-on-existing-monitors for the product,
multilingual nurse UI. Key India experiment that needs NO Indian data: **E6 few-shot local
calibration** — use VTaC as a stand-in "new hospital" and measure how many local labels are needed
to recover performance. Honest limitation: we design/argue Indian deployability, we do not claim
measured Indian performance.

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
- **For VTaC, use the provided split** (`benchmark_data_split.csv`) so results are comparable.
- **Never commit data.** Everything under `data/` is git-ignored except `.gitkeep`. Datasets
  are large (VTaC ~4 GB uncompressed).
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

## Datasets (summary — full details in DATASETS.md)
- **PhysioNet/CinC 2015** → `data/raw/challenge-2015/`  (primary training data, 5 arrhythmia types)
- **VTaC** → `data/raw/vtac/`  (VT-only, big, for external validation)
Both are OPEN ACCESS. Signals are WFDB format, 250 Hz. Load with the `wfdb` Python package.

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
6. [ ] `models/cnn.py` — 1D-CNN on raw waveforms; then attention CNN-LSTM.
7. [ ] `models/safety.py` — SUPPRESS/KEEP/DEFER thresholds; sensitivity floor >= 99%.        <-- REVIEW 2 target
8. [ ] cross-dataset eval: train 2015 -> test VTaC; report the gap (C1).                       <-- REVIEW 3 headline
9. [ ] adaptive-latency layer: per-alarm wait; latency-vs-sensitivity curve (C2).
10.[ ] few-shot local calibration on VTaC (E6) — the India deployability curve.
11.[ ] `explain/explain.py` — SHAP + attention maps + calibration (C3).
12.[ ] `service/` + `web/` — the live-triage product (retrofit, edge-friendly, multilingual UI).

## Definition of done (per component)
- A function has: type hints, a docstring, and a matching smoke test.
- A model has: a reproducible train script, saved artifact, and metrics logged to `data/processed/` or a CSV.
- Every reported number states the dataset, the split (CV fold or benchmark split), and the metric.

## Current status
**Baseline engine working end-to-end (build steps 1–5 done; Review-1 target met).**
Pipeline: load CinC-2015 record → preprocess (baseline removal + 0.5–40 Hz bandpass +
robust normalize) → 33 handcrafted features (4 SQIs, HR/RR stats + pauses, ECG-vs-pulse
cross-signal agreement, channel flags, alarm-type one-hot) → RF & XGBoost with class
weighting → 5-fold CV with **nested-CV threshold selection** (threshold picked on inner-CV
OOF probs of each training fold only — leak-free; lands near the Bayes-optimal ~1/6 for the
5×FN cost).

Run: `python scripts/02_train_baseline.py` (features cached to
`data/interim/challenge2015_features.csv`; summary → `data/processed/baseline_cv_results.csv`).

**Results (5-fold CV on the 750 public records — the 500-record test set is hidden):**
| model | challenge score | true-alarm sens. | specificity | ROC-AUC |
|-------|-----------------|------------------|-------------|---------|
| XGBoost | **0.662** | 0.929 | 0.612 | 0.897 |
| RandomForest | 0.635 | 0.895 | 0.640 | 0.897 |

Per-type (XGB): TACHY easy (score 0.94, AUROC 0.98); **VTACH hardest (score 0.57, AUROC 0.80)**
— matches the 2015 paper's finding that VT alarms defeated everyone. ASYSTOLE also weak
(AUROC 0.79), likely beat-detection struggling on flatline/noise.

**Env note:** venv at `.venv/` (torch/shap/fastapi NOT installed yet — added when steps 6/11/12
need them). `pip install -e .` done. Data lives at `data/raw/challenge-2015/training/` (750
`.hea`+`.mat` records, unzipped from the PhysioNet download).

**Next:** build step 6 (1D-CNN / attention on raw waveforms) to close the gap to published
entries (~0.75–0.84), focusing on the hard VTACH/ASYSTOLE/VFIB types; then step 7 (safety layer).
