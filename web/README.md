# web/ — SilentGuard frontend (Next.js App Router)

The visitor-facing experience. It talks to the FastAPI `service/` and renders **only real engine
output** — real waveforms, real beats, real SUPPRESS/KEEP/DEFER verdicts. Nothing is hardcoded.

**Status:** Step 2 in progress — the functional **Live Monitor** is done (clean, real data). The
Arrhythmia Explainer, Results/About, and the cinematic 3D layer (react-three-fiber particle heart,
blood-flow scroll) are next. Built in the order *real-but-plain → beautiful*.

## Prerequisites
- Node 18+ (tested on Node 20).
- The backend running (it serves the real engine):
  ```bash
  # from repo root, with the Python env active and the frozen model built:
  uvicorn service.main:app --port 8000
  ```
  See `service/README.md` (and run `python scripts/05_freeze_ensemble.py` if the model is missing).

## Run (development)
```bash
cd web
cp .env.local.example .env.local     # points at http://127.0.0.1:8000 by default
npm install
npm run dev                          # http://localhost:3000
```

## Run (production build)
```bash
npm run build && npm run start       # http://localhost:3000
```

## Configuration
- `NEXT_PUBLIC_API_BASE` (in `.env.local`) — base URL of the FastAPI service. Default
  `http://127.0.0.1:8000`. The WebSocket URL is derived from it automatically.

## What's here
- `app/` — App Router pages + global styles + the research-prototype disclaimer bar.
- `components/LiveMonitor.tsx` — real-time ECG canvas fed by the `/ws/stream/{id}` WebSocket:
  the waveform sweeps in, real QRS beats are marked, the alarm fires, and the engine's live
  verdict (decision, confidence, SHAP reasons, ground truth for honesty) appears.
- `lib/api.ts` — typed client for the service (records, analysis, stream URL, message shapes).

## Notes
- Respects `prefers-reduced-motion`; a dedicated Performance/Reduce-Motion toggle arrives with the
  3D layer (it will swap heavy scenes for light ones).
- `⚠ Research prototype — NOT a cleared medical device.`
- Dependencies are intentionally lean for now (Next + Tailwind). `three` + `@react-three/fiber` +
  `@react-three/drei` are added when the cinematic layer lands.
