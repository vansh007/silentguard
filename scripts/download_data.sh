#!/usr/bin/env bash
# Download both open-access datasets into data/raw/. See DATASETS.md for details.
# Requires ~8-10 GB free disk. Safe to re-run (wget -c resumes).
set -euo pipefail
cd "$(dirname "$0")/.."

echo ">> PhysioNet/CinC Challenge 2015 (primary training data)..."
wget -r -N -c -np -q --show-progress https://physionet.org/files/challenge-2015/1.0.0/
mkdir -p data/raw/challenge-2015
cp -r physionet.org/files/challenge-2015/1.0.0/* data/raw/challenge-2015/

echo ">> VTaC (external validation, ~4 GB) ..."
wget -r -N -c -np -q --show-progress https://physionet.org/files/vtac/1.0/
mkdir -p data/raw/vtac
cp -r physionet.org/files/vtac/1.0/* data/raw/vtac/

echo ">> Done. Verify with: python scripts/01_explore_record.py"
