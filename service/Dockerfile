# SilentGuard API — the frozen RF+CNN ensemble behind a FastAPI service.
#
# Build from the REPO ROOT (it needs src/, service/, config/ and the artifacts):
#   docker build -f service/Dockerfile -t silentguard-api .
#   docker run -p 8000:8000 silentguard-api
#
# IMPORTANT — what goes in the image:
# The API only serves the curated demo records (~7 MB), not the whole 417 MB corpus.
# `.dockerignore` therefore excludes data/raw/** and you must copy in just the records
# you intend to serve (see the COPY below). Read docs/DEPLOY.md before publishing this
# anywhere: CLAUDE.md's data policy says patient data is not to be uploaded, and that is
# a decision for the project owner, not the build.

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# torch CPU wheels are large; install them first so the layer caches
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch==2.3.1 || \
    pip install torch --index-url https://download.pytorch.org/whl/cpu

COPY pyproject.toml README.md ./
COPY src/ ./src/
RUN pip install -e . && pip install "fastapi>=0.110" "uvicorn[standard]>=0.29"

COPY config/ ./config/
COPY service/ ./service/

# frozen engine + the result files the Results/Research pages read
COPY data/processed/models/ ./data/processed/models/
COPY data/processed/*.csv ./data/processed/
COPY docs/figures/ ./docs/figures/

# the demo records the product streams (see service/engine.py::DEMO_RECORDS)
COPY data/raw/challenge-2015/training/ ./data/raw/challenge-2015/training/

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health').status==200 else 1)"

CMD ["uvicorn", "service.main:app", "--host", "0.0.0.0", "--port", "8000"]
