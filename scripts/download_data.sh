#!/usr/bin/env bash
# Download the ONLY dataset (PhysioNet/CinC 2015) into data/raw/. See DATASETS.md.
# Requires ~1 GB free disk. Safe to re-run (wget -c resumes).
# NOTE: VTaC was dropped (2026-07-22) — single-dataset scope. Do not re-add it here.
set -euo pipefail
cd "$(dirname "$0")/.."

echo ">> PhysioNet/CinC Challenge 2015 (the only dataset)..."
wget -r -N -c -np -q --show-progress https://physionet.org/files/challenge-2015/1.0.0/
mkdir -p data/raw/challenge-2015
cp -r physionet.org/files/challenge-2015/1.0.0/* data/raw/challenge-2015/
# training signals ship zipped; unzip the 750 public records:
if [ -f data/raw/challenge-2015/training.zip ]; then
  unzip -q -o data/raw/challenge-2015/training.zip -d data/raw/challenge-2015/
fi

echo ">> Done. Verify with: python scripts/01_explore_record.py"
