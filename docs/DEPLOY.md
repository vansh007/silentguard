# Deploying SilentGuard

The product is two pieces: a **FastAPI service** holding the frozen RF+CNN ensemble, and a
**Next.js frontend** that talks to it. The frontend is trivial to host. The API is the part
that needs a decision from you first.

---

## ⚠ Read this before publishing anything

`CLAUDE.md` states: *"Patient data is de-identified but still sensitive — don't upload it
anywhere or embed it in the repo/artifacts."*

Any public deployment of the API **re-hosts CinC-2015 waveforms**, because the Live Monitor,
Ward and Explainer stream real records. That is a policy call for the project owner, not
something a build should do silently. The three options:

| Option | What ships | Trade-off |
|---|---|---|
| **A. Local only** (current) | nothing | Zero exposure. Anyone wanting to see it runs two commands. |
| **B. Public frontend, private API** | the site, pointed at an API behind auth/VPN | Site is shareable; live pages show their real "engine unreachable" state to strangers. |
| **C. Full public deploy** | the 12 curated demo records (~7 MB) | Fully interactive for anyone with the link. Defensible — CinC-2015 is open-access on PhysioNet and already public — but it is still a re-host, so make the call deliberately. |

The `Dockerfile` and `.dockerignore` are written for **C**, excluding the full 417 MB corpus
and re-admitting only the 12 records `service/engine.py` actually serves. Switch to **A** or
**B** by removing the `!data/raw/...` allowlist from `.dockerignore`.

---

## API

```bash
# from the repo root
docker build -f service/Dockerfile -t silentguard-api .
docker run -p 8000:8000 -e SILENTGUARD_ALLOWED_ORIGINS="https://your-frontend.example" silentguard-api
curl localhost:8000/health     # {"status":"ok","model_loaded":true,...}
```

Prerequisites in the build context (all git-ignored, so regenerate them first):

```bash
.venv/bin/python scripts/05_freeze_ensemble.py   # -> data/processed/models/ensemble/
.venv/bin/python scripts/make_figures.py         # -> docs/figures/, oof_predictions.csv
```

Notes:
- **Size**: torch CPU is the bulk of the image (~700 MB–1 GB). Any host with 1 GB RAM will do;
  inference is a RandomForest plus a 4-block CNN over 16 s of signal.
- **Cold start**: the ensemble loads lazily on the first request. `/health` triggers it, so
  hit that once after boot.
- **Hosts that fit**: Fly.io, Railway, Render, a small VPS, or any container service. Vercel
  cannot run this — it needs a long-lived process for the WebSocket streams.
- **CORS**: set `SILENTGUARD_ALLOWED_ORIGINS` to your frontend origin. It defaults to `*`,
  which is fine locally and wrong in public.
- **WebSockets**: `/ws/stream/{id}` must not be buffered by a proxy. On nginx set
  `proxy_http_version 1.1` and forward `Upgrade`/`Connection` headers.

## Frontend

```bash
cd web
NEXT_PUBLIC_API_BASE=https://your-api.example npm run build
```

The API base is read at build time by `web/lib/api.ts`, so it must be set when you build,
not when you run. On Vercel/Netlify add `NEXT_PUBLIC_API_BASE` as an environment variable
and deploy the `web/` directory.

Every page degrades honestly if the API is unreachable — skeletons and an explicit
"engine unreachable" state, never placeholder numbers — so a frontend-only deploy is a
legitimate half-step, not a broken one.

## Checklist

- [ ] Decide A / B / C above and set `.dockerignore` accordingly
- [ ] Regenerate artifacts (`05_freeze_ensemble.py`, `make_figures.py`)
- [ ] `SILENTGUARD_ALLOWED_ORIGINS` pinned to the real frontend origin
- [ ] `NEXT_PUBLIC_API_BASE` set at frontend build time
- [ ] `/health` returns `model_loaded: true` from the deployed host
- [ ] The "research prototype — not a cleared medical device" banner is still visible
      (it is in `app/layout.tsx`; do not remove it for a public deployment)
