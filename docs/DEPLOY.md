# Deploying SilentGuard

Two pieces: a **Next.js frontend** (→ Vercel) and a **FastAPI service** holding the frozen
RF+CNN ensemble (→ *not* Vercel; see below).

**Recommended pairing: Vercel + Hugging Face Spaces.** Both free, no card required.

---

## ⚠ One decision first

`CLAUDE.md` says: *"Patient data is de-identified but still sensitive — don't upload it
anywhere."* Any public API re-hosts CinC-2015 waveforms, because the Monitor, Ward and
Explainer stream real records.

The deploy tooling ships **only the 12 curated demo records (6.7 MB)**, never the 417 MB
corpus. Those records are already public, open-access data on PhysioNet, so re-hosting them
is defensible — but make the call knowingly. If you'd rather not, deploy the frontend alone:
every page degrades honestly to an "engine unreachable" state rather than showing fake
numbers.

---

## Why the backend can't go on Vercel

| Requirement | Vercel |
|---|---|
| `WS /ws/stream/{id}` — long-lived streaming connections | ✗ serverless functions can't hold them |
| torch + sklearn + shap (~1 GB installed) | ✗ far past the function size limit |
| Warm model in memory between requests | ✗ every invocation is cold |

So the frontend goes to Vercel and the engine goes to a container host.

## Where to put the backend

| Host | Free tier | Fit | Watch out for |
|---|---|---|---|
| **Hugging Face Spaces** ← recommended | Yes, 2 vCPU / 16 GB, no card | Purpose-built for ML demos; WebSockets fine; stable `*.hf.space` URL | Sleeps after ~48 h idle (wakes on request); Space is public |
| **Google Cloud Run** | Generous, scales to zero | Best uptime/scale; set memory ≥ 1 GB | Needs a billing-enabled GCP account; cold start 10–30 s with torch |
| **Railway** | Trial credits, then ~$5/mo | Very smooth, WebSockets fine | Not free after the trial |
| **Render** | Free web service | Easy | 512 MB free tier is tight for torch — expect OOM; spins down after 15 min |
| **Fly.io** | Small paid allowance | Good latency, scale-to-zero | Default 256 MB is too small; use 1 GB |

Everything below uses the **same image** (`deploy/Dockerfile`), which listens on `$PORT` and
runs as uid 1000 — so switching hosts later is a config change, not a rewrite.

---

## Step 1 — Build the artifacts locally

The frozen model and result files are git-ignored, so regenerate them before deploying:

```bash
.venv/bin/python scripts/05_freeze_ensemble.py   # -> data/processed/models/ensemble/
.venv/bin/python scripts/make_figures.py         # -> docs/figures/, oof_predictions.csv
```

## Step 2 — Backend on Hugging Face Spaces

1. Create the Space: <https://huggingface.co/new-space> → **SDK: Docker**, hardware **CPU basic (free)**.
2. Log in so git can push: `pip install huggingface_hub && huggingface-cli login`
   (or paste a write token when git prompts for a password).
3. Push:

```bash
scripts/deploy_hf_space.sh <your-hf-username>/silentguard-api
```

The script stages a **12 MB** payload — code, the frozen ensemble, result CSVs, figures and
exactly the records `service/engine.py` can serve (the list is read from the source, so it
can't drift) — then pushes it to the Space. First build takes ~5–10 minutes; torch is large.

4. Verify: `curl https://<username>-silentguard-api.hf.space/health`
   → `{"status":"ok","model_loaded":true,...}`
5. In **Space → Settings → Variables and secrets**, add
   `SILENTGUARD_ALLOWED_ORIGINS = https://your-app.vercel.app`
   (it defaults to `*`, which is fine locally and wrong in public).

To try the exact image locally first:

```bash
scripts/deploy_hf_space.sh --stage-only /tmp/sg
docker build -t silentguard-api /tmp/sg
docker run -p 8000:8000 -e PORT=8000 silentguard-api
```

## Step 3 — Frontend on Vercel

1. <https://vercel.com/new> → import `vansh007/silentguard`.
2. **Root Directory: `web`** ← the one setting people miss. Framework auto-detects as Next.js.
3. Environment variable:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_API_BASE` | `https://<username>-silentguard-api.hf.space` |

   This is read at **build** time by `web/lib/api.ts`, so changing it later requires a
   redeploy, not just a restart. No trailing slash.
4. Deploy.

Or from the CLI:

```bash
npm i -g vercel
cd web
vercel --prod -e NEXT_PUBLIC_API_BASE=https://<username>-silentguard-api.hf.space
```

The frontend needs no secrets and never talks to the dataset directly — it only calls the
API. WebSocket URLs are derived from `NEXT_PUBLIC_API_BASE` by swapping the scheme, so an
`https://` base automatically yields `wss://` and won't trip mixed-content blocking.

## Step 4 — Verify the deployment

```bash
curl https://<api-host>/health                    # model_loaded: true
curl https://<api-host>/api/records | head -c 300 # live verdicts, not stored ones
```

Then on the live site:
- `/` — headline stats populate (they come from `/api/results`), heart caption names record `a163l`
- `/monitor` — pick a record, ECG streams, verdict + Grad-CAM overlay appear
- `/ward` — six beds stream simultaneously (this is the WebSocket smoke test)
- `/research` — the safety dial moves (this is the `/api/oof` smoke test)

## Checklist

- [ ] Artifacts regenerated (`05_freeze_ensemble.py`, `make_figures.py`)
- [ ] Data decision made consciously (see the top of this file)
- [ ] `/health` returns `model_loaded: true` from the deployed host
- [ ] `SILENTGUARD_ALLOWED_ORIGINS` pinned to the Vercel origin
- [ ] `NEXT_PUBLIC_API_BASE` set in Vercel **before** the build, no trailing slash
- [ ] Vercel Root Directory is `web`
- [ ] `/ward` streams — proves WebSockets survive the proxy
- [ ] The "research prototype — not a cleared medical device" banner is still visible
      (`web/app/layout.tsx`) — do not remove it for a public deployment

## Notes

- **Cold starts.** The ensemble loads lazily on first request; `/health` triggers it. A free
  HF Space that has slept will take ~30 s on the first hit, then be fast.
- **Slimming the image.** torch is ~90% of it. Exporting the CNN to ONNX would cut the image
  to a few hundred MB — worth doing only if you move to a memory-constrained host.
- **Reverse proxies.** If you front the API with nginx, `/ws/stream/{id}` needs
  `proxy_http_version 1.1` plus the `Upgrade`/`Connection` headers, or the ward will hang.
