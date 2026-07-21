"""FastAPI model-serving app for the SilentGuard product.

POST a waveform window -> get {p_false, decision, confidence, explanation}.
Keep the ML in Python here; the Next.js frontend (web/) calls these endpoints.
"""
from __future__ import annotations
from fastapi import FastAPI

app = FastAPI(title="SilentGuard API", version="0.0.1")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze")
def analyze():
    """TODO: accept a waveform (upload or JSON), preprocess -> features/model ->
    safety.decide -> explain. Return verdict + reasons. Log to Supabase."""
    return {"detail": "not implemented"}
