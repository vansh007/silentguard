---
title: SilentGuard API
emoji: 🫀
colorFrom: green
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: ICU false-alarm triage engine (RF+CNN) — research prototype
---

# SilentGuard API

The model-serving backend for [SilentGuard](https://github.com/vansh007/silentguard) — a
research prototype that decides whether an ICU arrhythmia alarm is real or false.

**⚠ Research prototype — NOT a cleared medical device.** Nothing here is validated for
clinical use.

## What this serves

A frozen **RandomForest + 1-D CNN ensemble** trained on the 750 public records of the
PhysioNet/CinC Challenge 2015, behind a safety layer that emits **SUPPRESS / KEEP / DEFER**
under a ≥99% true-alarm sensitivity floor.

| Endpoint | What it returns |
|---|---|
| `GET /health` | liveness + whether the model loaded |
| `GET /api/records` | the curated demo records with live engine verdicts |
| `GET /api/records/{id}/waveform` | real display samples + real detected QRS beats |
| `GET /api/records/{id}/analysis` | the full decision bundle (verdict, confidence, SHAP reasons) |
| `GET /api/records/{id}/saliency` | Grad-CAM — where in the waveform the CNN looked |
| `GET /api/explainer` | one real teaching example per arrhythmia type |
| `GET /api/results` | the leak-free evaluation tables |
| `GET /api/oof` | per-record out-of-fold predictions (powers the interactive safety dial) |
| `GET /api/heartbeat` | real QRS timing for one record |
| `WS /ws/stream/{id}` | streams the pre-alarm waveform, then the verdict |

## Data

Only the ~12 curated demo records are bundled, not the full corpus. They come from the
**open-access** PhysioNet/CinC Challenge 2015 training set and are de-identified. The full
dataset is at <https://physionet.org/content/challenge-2015/>.

## Results (leak-free 5-fold CV, 750 public records)

| model | challenge score | AUROC | FA suppressed @ ≥99% sens |
|---|---|---|---|
| RandomForest | 0.641 | 0.893 | 6.8% |
| 1-D CNN | 0.611 | 0.846 | 8.6% |
| **RF+CNN ensemble** | **0.713** | **0.916** | **31.1%** |

The official 500-record test set was never released, so no leaderboard number is
reproducible — every figure here is cross-validation on the public training records.

Built for **BCSE335L Healthcare Data Analytics**, VIT Chennai.
