# Team Sentinel — ICU False-Alarm Intelligence

*Working project title: **Trustworthy False-Alarm Reduction for ICU Bedside Monitors —
A Cross-Dataset, Safety-Constrained, and Explainable Approach.***

ICU bedside monitors fire constantly and most arrhythmia alarms are false. Staff become
desensitized (**alarm fatigue**), and real emergencies can get missed. This project learns to
suppress false alarms from ECG/ABP/PPG waveforms **without ever silencing a real one**, proves
it generalizes to hospitals it never trained on, and explains each verdict.

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
pip install -r requirements.txt

# 2. Download the dataset — CinC-2015 only, ~1 GB (see DATASETS.md)
bash scripts/download_data.sh                          # or follow DATASETS.md manually

# 3. Sanity-check one record loads and plots
python scripts/01_explore_record.py

# 4. Train the baseline (Review-1 target)
python scripts/02_train_baseline.py
```

## Why it's novel (and India-relevant)
See **NOVELTY.md** for the full gap analysis. In one line: the 2015 benchmark only tested
*in-distribution* performance; we test whether a model generalizes to an **arrhythmia pattern it
never trained on** — via Leave-One-Arrhythmia-Out (train on 4 types, test on the held-out 5th),
which operationalizes the challenge's own "no best general algorithm" finding. This is our
deployability proxy for settings with no local labelled data (e.g. Indian ICUs with heterogeneous
monitor fleets). *Single-dataset scope:* we use only CinC-2015; cross-hospital and few-shot
local-calibration validation are argued in design but left as future work (no source tags / no
second dataset). See the honest limitations in NOVELTY.md §3.

## What's where
- **CLAUDE.md** — context + rules for Claude Code (read this if you use Claude Code).
- **DATASETS.md** — exactly which datasets, from where, and where to save them.
- **docs/ICU_Alarm_Project_Roadmap.md** — the full semester roadmap (research + product + 3 reviews).
- **docs/ICU_Project_TitlePage.docx** — the title page for submission.
- **paper/outline.md** — the paper structure.
- **src/silentguard/** — the code (currently stubs with TODOs).

## The one rule to remember
Optimize the **asymmetric** challenge score `(TP+TN)/(TP+TN+FP+5*FN)` and keep
**true-alarm sensitivity ~100%**. Suppressing a real emergency is the one unacceptable failure.

## License / data note
Code: choose a license (MIT suggested). **Data is NOT included** and must not be committed —
it is downloaded locally per DATASETS.md. PhysioNet data is de-identified but sensitive.
