# DATASETS.md — what to download, from where, and where to save it

Two open-access datasets. Both are waveform data in **WFDB format** (`.hea` header + `.dat`
signal), sampled at **250 Hz**. Neither needs paid access or CITI credentialing. Total disk
needed: keep **~8–10 GB free** (VTaC alone is ~4 GB uncompressed).

> A free PhysioNet account (https://physionet.org/register/) is recommended so downloads are
> tracked, but is not strictly required for these two open datasets.

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

## Dataset B — VTaC (EXTERNAL validation, VT alarms only)
"Ventricular Tachycardia annotated alarms from ICUs" (NeurIPS 2023 Datasets & Benchmarks).

- **What:** **5,037** VT alarm events (**1,441 true / 3,596 false**), from **3 US hospitals**
  and **3 monitor manufacturers** — the diversity is the whole point (that's your
  generalization test). Each record: a **6-minute** segment (5 min before + 1 min after the
  alarm), ECG leads + pulsatile waveform(s), 250 Hz, WFDB format.
- **Key files:**
  - `waveforms/` — WFDB records, organized in sub-folders per patient (up to 5 events each).
  - `event_labels.csv` — columns: `record`, `event`, `decision` (the true/false label).
  - `benchmark_data_split.csv` — the official **train/validation/test split** → USE THIS.
- **Page / DOI:** https://physionet.org/content/vtac/1.0/  (DOI 10.13026/8td2-g363)
- **Access:** **open** (CC BY-SA 4.0). Size: 2.7 GB zip / **4.0 GB uncompressed**.
- **Reference code:** https://github.com/ML-Health/VTaC (their ML scripts — useful to peek at).

**Download (terminal):**
```bash
wget -r -N -c -np https://physionet.org/files/vtac/1.0/
# then move into data/raw/vtac/
```
Or the **"Download the ZIP file"** button (2.7 GB) → unzip into `data/raw/vtac/`.

**Save to:**
```
data/raw/vtac/
  waveforms/
  event_labels.csv
  benchmark_data_split.csv
  RECORDS
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
- Cite both datasets + the standard PhysioNet reference in the paper (BibTeX in paper/outline.md).
