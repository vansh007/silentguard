#!/usr/bin/env bash
# Assemble and push the SilentGuard API to a Hugging Face Space (Docker SDK).
#
# The Space gets ONLY what the product serves: code, the frozen ensemble, the result CSVs,
# the generated figures, and the ~12 curated demo records (~12 MB) — never the 417 MB corpus.
# The record list is read from service/engine.py so it cannot drift from what the API needs.
#
# Usage:
#   scripts/deploy_hf_space.sh <hf-username>/<space-name>   # stage + push
#   scripts/deploy_hf_space.sh --stage-only <dir>           # stage only (for a local docker build)
#
# Prerequisites:
#   1. Create the Space at https://huggingface.co/new-space  (SDK: Docker, hardware: CPU basic)
#   2. huggingface-cli login      (or have a write token ready when git prompts)
#   3. Artifacts built locally:
#        .venv/bin/python scripts/05_freeze_ensemble.py
#        .venv/bin/python scripts/make_figures.py
set -euo pipefail

STAGE_ONLY=0
SPACE="${1:-}"
if [[ "$SPACE" == "--stage-only" ]]; then
  STAGE_ONLY=1
  OUT="${2:-}"
  [[ -n "$OUT" ]] || { echo "usage: $0 --stage-only <dir>" >&2; exit 1; }
elif [[ -z "$SPACE" ]]; then
  echo "usage: $0 <hf-username>/<space-name>   |   $0 --stage-only <dir>" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PY="${PYTHON:-.venv/bin/python}"
[[ -x "$PY" ]] || PY="python3"

# --- preflight -------------------------------------------------------------------------
ART="data/processed/models/ensemble/ensemble_meta.json"
[[ -f "$ART" ]] || { echo "ERROR: $ART missing. Run scripts/05_freeze_ensemble.py first." >&2; exit 1; }
[[ -f "data/processed/oof_predictions.csv" ]] || {
  echo "ERROR: data/processed/oof_predictions.csv missing. Run scripts/make_figures.py first." >&2; exit 1; }

# the exact records the API can be asked for (demo list + explainer examples)
RECORDS="$("$PY" - <<'EOF'
from service import engine
ids = {r["id"] for r in engine.DEMO_RECORDS} | {e["record"] for e in engine.EXPLAINER}
print(" ".join(sorted(ids)))
EOF
)"
echo "Records to ship: $RECORDS"

if (( STAGE_ONLY )); then
  rm -rf "$OUT"; mkdir -p "$OUT"
  STAGE="$(cd "$OUT" && pwd)"
else
  STAGE="$(mktemp -d)"
  trap 'rm -rf "$STAGE"' EXIT
fi
echo "Staging in $STAGE"

# --- assemble --------------------------------------------------------------------------
cp deploy/Dockerfile              "$STAGE/Dockerfile"
cp deploy/hf-space/README.md     "$STAGE/README.md"
cp deploy/requirements-deploy.txt "$STAGE/requirements-deploy.txt"
cp pyproject.toml                "$STAGE/pyproject.toml"

mkdir -p "$STAGE/src" "$STAGE/config" "$STAGE/service" "$STAGE/docs/figures" \
         "$STAGE/data/processed/models" "$STAGE/data/raw/challenge-2015/training"

cp -R src/silentguard          "$STAGE/src/"
cp -R config/.                 "$STAGE/config/"
cp service/*.py                "$STAGE/service/"
[[ -d service/static ]] && cp -R service/static "$STAGE/service/"
cp -R data/processed/models/.  "$STAGE/data/processed/models/"
cp data/processed/*.csv        "$STAGE/data/processed/"
cp docs/figures/*.png          "$STAGE/docs/figures/" 2>/dev/null || true

for r in $RECORDS; do
  for ext in hea mat; do
    f="data/raw/challenge-2015/training/${r}.${ext}"
    [[ -f "$f" ]] && cp "$f" "$STAGE/data/raw/challenge-2015/training/"
  done
done

echo "Payload size: $(du -sh "$STAGE" | cut -f1)"

if (( STAGE_ONLY )); then
  cat <<EOF

Staged only. Build and run it locally with:
  docker build -t silentguard-api "$STAGE"
  docker run -p 8000:8000 -e PORT=8000 silentguard-api
  curl localhost:8000/health
EOF
  exit 0
fi

# --- push ------------------------------------------------------------------------------
cd "$STAGE"
git init -q
git lfs install --local 2>/dev/null || true
# .mat waveforms are binary; HF wants anything sizeable in LFS
cat > .gitattributes <<'EOF'
*.mat filter=lfs diff=lfs merge=lfs -text
*.joblib filter=lfs diff=lfs merge=lfs -text
*.pt filter=lfs diff=lfs merge=lfs -text
*.png filter=lfs diff=lfs merge=lfs -text
EOF
git add -A
git -c user.email=deploy@silentguard -c user.name=silentguard-deploy \
    commit -qm "Deploy SilentGuard API (frozen RF+CNN ensemble)"
git branch -M main
git remote add origin "https://huggingface.co/spaces/${SPACE}"

echo
echo "Pushing to https://huggingface.co/spaces/${SPACE}"
echo "(if prompted: username = your HF username, password = an HF token with write access)"
git push -f origin main

cat <<EOF

Done. Next:
  1. Watch the build:  https://huggingface.co/spaces/${SPACE}  (first build ~5-10 min; torch is big)
  2. Check health:     curl https://${SPACE/\//-}.hf.space/health
  3. Set the Space secret SILENTGUARD_ALLOWED_ORIGINS to your Vercel URL
     (Space -> Settings -> Variables and secrets)
  4. Point the frontend at it: NEXT_PUBLIC_API_BASE=https://${SPACE/\//-}.hf.space
EOF
