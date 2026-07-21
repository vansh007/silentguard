# service/ — FastAPI model server
Run: `uvicorn service.main:app --reload`
Endpoints: `GET /health`, `POST /analyze` (waveform in -> verdict + explanation out).
Persist alarm logs/analytics to **Supabase** (Postgres). Frontend in `web/` calls these.
