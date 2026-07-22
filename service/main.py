"""FastAPI model-serving app for SilentGuard.

Serves the REAL frozen RF+CNN ensemble: real waveforms, real beat markers, real verdicts
(SUPPRESS/KEEP/DEFER) from FrozenEnsemble.predict_one. Nothing is hardcoded.

Endpoints
  GET  /health                         liveness + whether the model is loadable
  GET  /api/records                    curated demo records (+ live engine verdict summary)
  GET  /api/records/{id}               record metadata (channels, fs, duration, ground truth)
  GET  /api/records/{id}/waveform      real display samples + REAL QRS beats
  GET  /api/records/{id}/analysis      the REAL engine decision bundle
  WS   /ws/stream/{id}                 streams the pre-alarm waveform in real time, then the verdict
  GET  /                               a plain proof page (canvas ECG + live verdict; no 3D)

Run:  uvicorn service.main:app --reload --port 8000
"""
from __future__ import annotations
import asyncio
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import engine

app = FastAPI(title="SilentGuard API", version="0.1.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

STATIC = Path(__file__).parent / "static"


@app.get("/health")
def health():
    ok = True
    detail = "model loadable"
    try:
        engine.model()
    except Exception as e:  # surface a real error state, never fake readiness
        ok, detail = False, str(e)
    return {"status": "ok" if ok else "degraded", "model_loaded": ok, "detail": detail,
            "n_demo_records": len(engine.DEMO_RECORDS)}


@app.get("/api/records")
def list_records():
    """Curated demo records with their live engine verdict (computed, not stored)."""
    out = []
    for r in engine.DEMO_RECORDS:
        try:
            a = engine.analyze(r["id"])
            out.append({
                "id": r["id"], "note": r["note"], "arrhythmia": a["arrhythmia"],
                "true_label": a["true_label"], "decision": a["decision"],
                "p_false": round(a["p_false"], 3), "confidence": round(a["confidence"], 3),
            })
        except Exception as e:
            out.append({"id": r["id"], "note": r["note"], "error": str(e)})
    return {"records": out}


@app.get("/api/records/{rid}")
def record(rid: str):
    try:
        return engine.record_meta(rid)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))


@app.get("/api/records/{rid}/waveform")
def waveform(rid: str, channel: str | None = None, seconds: float = 24.0):
    try:
        return engine.display_window(rid, channel=channel, seconds=seconds)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))


@app.get("/api/records/{rid}/analysis")
def analysis(rid: str):
    try:
        return engine.analyze(rid)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))


@app.websocket("/ws/stream/{rid}")
async def stream(ws: WebSocket, rid: str, speed: float = 1.0, seconds: float = 24.0):
    """Stream the pre-alarm waveform in real time, then fire the alarm and the REAL verdict."""
    await ws.accept()
    try:
        dw = engine.display_window(rid, seconds=seconds)
    except Exception as e:
        await ws.send_json({"type": "error", "detail": str(e)})
        await ws.close()
        return

    fs = dw["fs"]
    samples = dw["samples"]
    await ws.send_json({
        "type": "meta", "channel": dw["channel"], "fs": fs, "total": len(samples),
        "beats": dw["beats"], "analysis_window_s": dw["analysis_window_s"],
        "arrhythmia": dw["arrhythmia"], "seconds": dw.get("seconds", seconds),
    })

    tick_ms = 60
    chunk = max(1, int(fs * (tick_ms / 1000.0) * max(0.1, speed)))
    try:
        for i in range(0, len(samples), chunk):
            await ws.send_json({"type": "samples", "i": i, "v": samples[i:i + chunk]})
            await asyncio.sleep(tick_ms / 1000.0)
        await ws.send_json({"type": "alarm", "arrhythmia": dw["arrhythmia"]})
        # the verdict is computed live from the frozen engine at the alarm moment
        verdict = await asyncio.get_event_loop().run_in_executor(None, engine.analyze, rid)
        await ws.send_json({"type": "verdict", **verdict})
    except WebSocketDisconnect:
        return
    finally:
        try:
            await ws.close()
        except Exception:
            pass


# static proof page (plain: canvas ECG + live verdict, no 3D)
if STATIC.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC)), name="static")


@app.get("/")
def index():
    page = STATIC / "index.html"
    if page.exists():
        return FileResponse(str(page))
    return {"detail": "proof page not found; API is at /health and /api/records"}
