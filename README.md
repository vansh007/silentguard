# Team Sentinel — ICU False-Alarm Intelligence

*Working project title: **Trustworthy False-Alarm Reduction for ICU Bedside Monitors —
A Generalization-Tested, Safety-Constrained, and Explainable Approach.***

ICU bedside monitors fire constantly and most arrhythmia alarms are false. Staff become
desensitized (**alarm fatigue**), and real emergencies can get missed. This project learns to
suppress false alarms from ECG/ABP/PPG waveforms **without ever silencing a real one**, measures
honestly how far that ability transfers to rhythms it never trained on, and explains each verdict.

Delivered as **a research paper + a working web product**.

## Team
| Name | Register No. |
|---|---|
| Vansh Mundhra | 23BCE1254 |
| Tanishk Yadav | 23BCE1588 |
| _(third member — add here)_ | |

Course: **BCSE335L — Healthcare Data Analytics**, VIT Chennai.

## Quick start

```bash
# 1. Environment
python -m venv .venv && source .venv/bin/activate     # (Windows: .venv\Scripts\activate)
pip install -r requirements.txt && pip install -e .

# 2. Download the dataset — CinC-2015 only, ~400 MB (see DATASETS.md)
bash scripts/download_data.sh

# 3. Train + freeze the engine, then generate the results/figures
python scripts/05_freeze_ensemble.py
python scripts/make_figures.py
```

### Run the product

```bash
# terminal 1 — the engine (NOTE: use .venv explicitly; a conda base env will not have it)
.venv/bin/uvicorn service.main:app --port 8000

# terminal 2 — the site
cd web && npm install && npm run dev      # http://localhost:3000
```

Pages: **/** (story + live stats) · **/monitor** (single-alarm triage with Grad-CAM overlay) ·
**/ward** (six beds streaming at once) · **/explainer** (the five alarms on real records) ·
**/research** (interactive safety dial + LOAO explorer) · **/results** (tables, figures, limits).

Deploying? See **docs/DEPLOY.md** — Vercel for the frontend, Hugging Face Spaces (or Cloud
Run) for the engine.

## Why it's novel (and India-relevant)
See **NOVELTY.md** for the full gap analysis. In one line: the 2015 benchmark only tested
*in-distribution* performance; we test whether a model generalizes to an **arrhythmia pattern it
never trained on** — via Leave-One-Arrhythmia-Out (train on 4 types, test on the held-out 5th),
which operationalizes the challenge's own "no best general algorithm" finding. This is our
deployability proxy for settings with no local labelled data (e.g. Indian ICUs with heterogeneous
monitor fleets). *Single-dataset scope:* we use only CinC-2015; cross-hospital and few-shot
local-calibration validation are argued in design but left as future work (no source tags / no
second dataset). See the honest limitations in NOVELTY.md §3.

## Results (leak-free 5-fold CV on the 750 public records)

| model | challenge score | AUROC | true-alarm sens. | FA suppressed @ ≥99% sens | defer rate |
|---|---|---|---|---|---|
| RandomForest | 0.641 | 0.893 | 0.898 | 6.8% | 77.9% |
| 1-D CNN | 0.611 | 0.846 | 0.895 | 8.6% | 91.2% |
| **RF+CNN ensemble** | **0.713** | **0.916** | **0.939** | **31.1%** | **62.4%** |

Generalization (C1, the headline): the ensemble falls from **0.713 in-distribution to 0.323**
on an arrhythmia held out of training entirely — worst on tachycardia, where AUROC drops
*below chance*. We publish that gap rather than hide it. Full tables and every caveat:
**docs/RESULTS.md**; the story of how we got there: **docs/PROJECT_LOG.md**.

## What's where
- **CLAUDE.md** — context + rules for Claude Code (read this if you use Claude Code).
- **NOVELTY.md** — the gap analysis and the four locked contributions.
- **DATASETS.md** — exactly which dataset, from where, and where to save it.
- **docs/RESULTS.md** — paper-ready tables + figures. **docs/PROJECT_LOG.md** — research diary.
- **docs/DEPLOY.md** — how to put it online.
- **src/silentguard/** — the engine. **service/** — FastAPI. **web/** — the Next.js product.
- **paper/outline.md** — the paper structure.

## The one rule to remember
Optimize the **asymmetric** challenge score `(TP+TN)/(TP+TN+FP+5*FN)` and keep
**true-alarm sensitivity ~100%**. Suppressing a real emergency is the one unacceptable failure.

## License / data note
Code: choose a license (MIT suggested). **Data is NOT included** and must not be committed —
it is downloaded locally per DATASETS.md. PhysioNet data is de-identified but still sensitive:
nothing under `data/` is tracked, and a public deployment ships only the 12 curated demo
records (6.7 MB), never the full corpus. See the decision note at the top of docs/DEPLOY.md.

**SilentGuard is a research prototype, not a cleared medical device.**
