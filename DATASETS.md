# DATASETS.md — what to download, from where, and where to save it

> **Scope decision (2026-07-22): this project uses ONLY the PhysioNet/CinC 2015 dataset.**
> VTaC was dropped (it would not download in our environment and is non-essential to the
> contributions). The former Dataset B section is retained at the bottom, struck through, for
> historical context — do NOT treat it as required.

**One open-access dataset.** Waveform data in **WFDB format** (`.hea` header + `.mat` signal),
sampled at **250 Hz**. No paid access or CITI credentialing. Disk needed: **~1 GB**.

> A free PhysioNet account (https://physionet.org/register/) is recommended so downloads are
> tracked, but is not strictly required for this open dataset.

---

## Dataset A — PhysioNet/CinC Challenge 2015 (PRIMARY training data)
"Reducing False Arrhythmia Alarms in the ICU."

- **What:** 1,250 alarm recordings across **five** life-threatening arrhythmia types —
  Asystole (ASYSTOLE), Extreme Bradycardia (BRADY), Extreme Tachycardia (TACHY),
  Ventricular Tachycardia (VTACH), Ventricular Flutter/Fibrillation (VFIB/FLUTTER).
  **750 public (train)** + **500 hidden (test — labels NOT released).**
- **Each record:** 5 minutes of data ending at the alarm (real-time), +30 s after
  (retrospective set `training/` vs. the "…-e" retrospective variants). Two ECG leads +
  one or more pulsatile waveforms (ABP and/or PPG/PLETH).
- **Labels (train):** true/false is recorded in each record's **`.hea` header comment**
  (alongside the alarm type). Print a header on first load to see the exact format
  (see `scripts/01_explore_record.py`). Because the 500-record test set is hidden, evaluate
  with **5-fold cross-validation on the 750**.
- **Page / DOI:** https://physionet.org/content/challenge-2015/1.0.0/  (DOI 10.13026/c9fg-a467)
- **Access:** open.

**Download (terminal, recommended):**
```bash
wget -r -N -c -np https://physionet.org/files/challenge-2015/1.0.0/
# creates ./physionet.org/files/challenge-2015/1.0.0/... ; move the payload into data/raw/challenge-2015/
```
Or use the **"Download the ZIP file"** button on the content page and unzip into
`data/raw/challenge-2015/`.

**Save to:**
```
data/raw/challenge-2015/
  training/           # the 750 public records (.hea/.dat), plus alarm labels in headers
  ...
```

---

## After downloading — verify it worked
```bash
python -c "import wfdb; r=wfdb.rdrecord('data/raw/challenge-2015/training/a103l'); print(r.sig_name, r.fs, r.p_signal.shape)"
```
You should see the channel names (e.g. ['II','V','ABP','PLETH'] — they vary per record),
`250`, and an array shape. If channels differ per record, that's expected — handle missing
channels gracefully in `src/silentguard/data/io.py`.

## Reminders
- **Do not commit** anything under `data/` (already git-ignored).
- Channel availability is inconsistent across records — some have PPG, some ABP, some both.
  ECG lead II is the most commonly present; design features to degrade gracefully.
- Cite the dataset + the standard PhysioNet reference in the paper (BibTeX in paper/outline.md).

---

## ~~Dataset B — VTaC~~ (DROPPED 2026-07-22 — kept for historical context only)
> ~~"Ventricular Tachycardia annotated alarms from ICUs" (NeurIPS 2023 Datasets & Benchmarks).~~
> **Dropped:** the 2.7 GB download stalled at ~12 KB/s in our environment (throttled egress,
> ~65 h ETA), and the single-dataset re-scope makes it non-essential. The cross-dataset (E2/E3)
> and few-shot (E6) experiments that needed it are now future work; our headline generalization
> test is Leave-One-Arrhythmia-Out on CinC-2015 (see NOVELTY.md §2). If a second, source-tagged
> dataset is ever added, download it on a normal network — not this environment.
