# SilentGuard API — one image, any container host.
#
# Built from the staging directory that scripts/deploy_hf_space.sh assembles, NOT from the
# repo root: the image carries only the code, the frozen ensemble, the result CSVs and the
# ~12 demo records the product actually streams (~12 MB), never the 417 MB corpus.
#
# Listens on $PORT — Hugging Face Spaces sets 7860, Cloud Run / Railway / Render set their
# own — and runs as uid 1000, which HF Spaces requires and everyone else tolerates.
#
# Local test:
#   scripts/deploy_hf_space.sh --stage-only /tmp/sg
#   docker build -t silentguard-api /tmp/sg && docker run -p 8000:8000 -e PORT=8000 silentguard-api

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=7860

# HF Spaces expects a non-root user with uid 1000
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    SILENTGUARD_ROOT=/home/user/app
WORKDIR $HOME/app

# torch CPU-only: the GPU wheels are several GB and we never use them
COPY --chown=user requirements-deploy.txt ./
RUN pip install --user --index-url https://download.pytorch.org/whl/cpu torch==2.3.1 && \
    pip install --user -r requirements-deploy.txt

# non-editable install: the package lands in site-packages, so the image needs no src/ at runtime
COPY --chown=user pyproject.toml README.md ./
COPY --chown=user src/ ./src/
RUN pip install --user --no-deps .

COPY --chown=user config/ ./config/
COPY --chown=user service/ ./service/
COPY --chown=user data/ ./data/
COPY --chown=user docs/ ./docs/

EXPOSE 7860

# shell form so $PORT expands
CMD uvicorn service.main:app --host 0.0.0.0 --port ${PORT:-7860}
