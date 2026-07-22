# service/ — SilentGuard real-engine API (FastAPI)

Serves the **real** frozen RF+CNN ensemble. Every waveform, beat marker, and verdict
(SUPPRESS / KEEP / DEFER) is computed live from the model — nothing is hardcoded.

## Prerequisites
1. Python deps installed (repo root): `pip install -r requirements.txt` and `pip install -e .`
2. The frozen engine exists at `data/processed/models/ensemble/`. If not, build it:
   ```bash
   python scripts/05_freeze_ensemble.py
   ```
3. CinC-2015 records present at `data/raw/challenge-2015/training/` (see DATASETS.md).

## Run
Use the project virtualenv **`.venv/`** (already has the deps + editable install). The simplest,
foolproof way is the full path — no `activate` needed, and it won't collide with conda `(base)`:
```bash
cd <repo root>
.venv/bin/uvicorn service.main:app --reload --port 8000
```
Or activate first (note the leading dot — it's `.venv`, not `venv`):
```bash
source .venv/bin/activate && uvicorn service.main:app --reload --port 8000
```
> If you see `ModuleNotFoundError: No module named 'silentguard'`, you're running the wrong Python
> (e.g. anaconda `base` or a fresh empty `venv`). Use `.venv/bin/uvicorn` as above. To rebuild the
> env from scratch: `python -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/pip install -e .`
Then open **http://127.0.0.1:8000/** — the Step-1 proof page: pick a record, its ECG streams in
real time, the alarm fires, and the engine's live verdict + reasons appear. (Plain by design;
the cinematic frontend lives in `web/`.)

## Endpoints
| Method | Path | Returns |
|--------|------|---------|
| GET | `/health` | liveness + whether the model loads |
| GET | `/api/records` | curated demo records, each with its **live** engine verdict |
| GET | `/api/records/{id}` | metadata (channels, fs, duration, ground-truth label) |
| GET | `/api/records/{id}/waveform?channel=II&seconds=24` | real display samples + **real QRS beats** |
| GET | `/api/records/{id}/analysis` | the real decision bundle from `predict_one` |
| WS  | `/ws/stream/{id}?speed=3` | streams the pre-alarm waveform, then fires alarm + verdict |

`analysis` / verdict shape (from `FrozenEnsemble.predict_one`):
```json
{"record_id","arrhythmia","p_true","p_false","decision","confidence",
 "reasons":[{"feature","contribution_to_true"}],"latency_used_s","true_label"}
```
`true_label` is the ground truth, included **for honesty in the UI** — the engine never sees it.

## Seed demo records (curated, all verdicts are real)
| id | arrhythmia | truth | engine verdict |
|----|-----------|-------|----------------|
| `v338s` | VTACH | FALSE | SUPPRESS (0.94) — rhythm too regular to be real VT |
| `a163l` | ASYSTOLE | FALSE | SUPPRESS (0.94) — beats clearly present |
| `b215l` | BRADY | FALSE | SUPPRESS (0.93) |
| `t384s` | TACHY | FALSE | SUPPRESS (0.85) |
| `v334s` | VTACH | TRUE | KEEP (0.80) — real emergency |
| `t156s` | TACHY | TRUE | KEEP (0.99) |
| `a604s` | ASYSTOLE | TRUE | KEEP (0.84) |
| `b537l` | BRADY | TRUE | KEEP (0.85) |
| `a705l` | ASYSTOLE | FALSE | DEFER (0.81) — ambiguous |
| `f346s` | VFIB | FALSE | DEFER (0.68) |
| `v652s` | VTACH | TRUE | DEFER (0.54) — borderline |

## Notes
- CORS is open (`*`) for the `web/` dev server.
- First `/analysis` call loads torch + the CNN (~1–2 s); subsequent calls are fast.
- Supabase (alarm logs / analytics) is deferred to a later step.
- `⚠ Research prototype — NOT a cleared medical device.`
