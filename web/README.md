# web/ — Next.js dashboard (the demo)
Scaffold with `create-next-app`. Deploy on **Vercel**. Talks to the FastAPI `service/`.

Screens:
1. **Live ICU monitor** — stream a record, render ECG/ABP/PPG; when an alarm fires show
   the verdict (SUPPRESS/KEEP/DEFER) + confidence + explanation in real time (WebSocket/SSE).
2. **Nurse-station queue** — multi-bed view; false alarms dimmed, DEFER flagged for a human.
3. **Upload analyzer** — drop a WFDB/CSV record, get the full analysis.
4. **Analytics** — false-alarm-rate reduction over time, per-arrhythmia breakdown
   (Supabase queries) — this is your Module 6 descriptive/prescriptive analytics.
