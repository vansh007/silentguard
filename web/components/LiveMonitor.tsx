"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DECISION_META,
  DemoRecord,
  fetchRecords,
  streamUrl,
  StreamMsg,
  Verdict,
} from "@/lib/api";

type Status = "idle" | "loading" | "monitoring" | "alarm" | "analyzed" | "error";

export default function LiveMonitor() {
  const [records, setRecords] = useState<DemoRecord[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [meta, setMeta] = useState<{ channel: string; fs: number; arrhythmia: string } | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bufRef = useRef<number[]>([]);
  const beatsRef = useRef<Set<number>>(new Set());
  const drawnRef = useRef(0);
  const flashRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    fetchRecords()
      .then((r) => setRecords(r))
      .catch((e) => setApiError(String(e)));
  }, []);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth;
    const H = cv.clientHeight;
    if (cv.width !== W * dpr || cv.height !== H * dpr) {
      cv.width = W * dpr;
      cv.height = H * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // grid
    ctx.strokeStyle = "rgba(61,220,132,0.06)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 26) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 26) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    const buf = bufRef.current;
    const n = buf.length;
    if (n > 0) {
      const show = Math.min(Math.floor(drawnRef.current), n);
      const step = W / n;
      const mid = H / 2;
      const amp = H * 0.34;
      // trace
      ctx.strokeStyle = "#3ddc84";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < show; i++) {
        const x = i * step;
        const y = mid - buf[i] * amp;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
      // beats
      ctx.fillStyle = "rgba(120,180,255,0.9)";
      beatsRef.current.forEach((b) => {
        if (b < show) {
          const x = b * step;
          const y = mid - buf[b] * amp;
          ctx.beginPath();
          ctx.arc(x, y, 2.4, 0, 7);
          ctx.fill();
        }
      });
      // sweep head
      if (show < n) {
        const x = show * step;
        ctx.strokeStyle = "rgba(61,220,132,0.5)";
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
    }

    // alarm flash overlay
    if (flashRef.current > 0) {
      ctx.fillStyle = `rgba(239,68,68,${0.5 * flashRef.current})`;
      ctx.fillRect(0, 0, W, H);
      flashRef.current = Math.max(0, flashRef.current - 0.04);
    }
  }, []);

  // render loop
  useEffect(() => {
    const loop = () => {
      if (drawnRef.current < bufRef.current.length) {
        drawnRef.current += Math.max(1, bufRef.current.length / 200);
      }
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  const play = useCallback((id: string) => {
    if (wsRef.current) wsRef.current.close();
    bufRef.current = [];
    beatsRef.current = new Set();
    drawnRef.current = 0;
    flashRef.current = 0;
    setSelected(id);
    setVerdict(null);
    setMeta(null);
    setStatus("loading");

    const ws = new WebSocket(streamUrl(id));
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      const m: StreamMsg = JSON.parse(ev.data);
      if (m.type === "meta") {
        bufRef.current = new Array(m.total).fill(0);
        m.beats.forEach((b) => beatsRef.current.add(b));
        setMeta({ channel: m.channel, fs: m.fs, arrhythmia: m.arrhythmia });
        setStatus("monitoring");
      } else if (m.type === "samples") {
        for (let k = 0; k < m.v.length; k++) bufRef.current[m.i + k] = m.v[k];
        drawnRef.current = Math.max(drawnRef.current, m.i + m.v.length);
      } else if (m.type === "alarm") {
        flashRef.current = 1;
        setStatus("alarm");
      } else if (m.type === "verdict") {
        setVerdict(m);
        setStatus("analyzed");
      } else if (m.type === "error") {
        setApiError(m.detail);
        setStatus("error");
      }
    };
    ws.onclose = () => {
      drawnRef.current = bufRef.current.length;
    };
  }, []);

  useEffect(() => () => wsRef.current?.close(), []);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
      {/* record list */}
      <aside className="rounded-xl border border-hair bg-panel/60 p-3">
        <h2 className="mb-3 px-1 text-[11px] uppercase tracking-wider text-muted">Demo records</h2>
        {apiError && (
          <div className="rounded-lg border border-suppress/40 bg-suppress/10 p-3 text-xs text-suppress">
            API unreachable: {apiError}
            <div className="mt-1 text-muted">Start the backend: <code>uvicorn service.main:app --port 8000</code></div>
          </div>
        )}
        {records.length === 0 && !apiError && <div className="px-1 text-xs text-muted">loading…</div>}
        <div className="space-y-2">
          {records.map((r) => {
            const d = r.decision ? DECISION_META[r.decision] : null;
            const active = r.id === selected;
            return (
              <button
                key={r.id}
                onClick={() => play(r.id)}
                className={`w-full rounded-lg border p-2.5 text-left transition ${
                  active ? "border-ecg shadow-[inset_0_0_0_1px_#3ddc84]" : "border-hair hover:border-slate-600"
                } bg-panel`}
              >
                <div className="text-[13px] font-semibold">
                  {r.id} · <span className="text-muted">{r.arrhythmia}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-muted">{r.note}</div>
                {d && (
                  <span
                    className="mt-1.5 inline-block rounded px-1.5 py-0.5 text-[10px]"
                    style={{ background: `${d.color}22`, color: d.color }}
                  >
                    {d.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* monitor stage */}
      <section>
        <div className="relative overflow-hidden rounded-xl border border-hair" style={{ background: "#04140c" }}>
          <canvas ref={canvasRef} className="block h-[320px] w-full" />
          <div className="absolute left-3.5 top-3 text-[11px] tracking-wide text-muted">
            {meta ? `lead ${meta.channel} · ${meta.fs}Hz · ${meta.arrhythmia}` : "—"}
          </div>
          <div
            className="absolute right-3.5 top-3 text-[11px]"
            style={{ color: status === "alarm" ? "#ef4444" : "#7d8794" }}
          >
            {status === "idle" && "select a record"}
            {status === "loading" && "connecting…"}
            {status === "monitoring" && "monitoring…"}
            {status === "alarm" && "⚠ ALARM"}
            {status === "analyzed" && "analyzed"}
            {status === "error" && "error"}
          </div>
        </div>

        {/* verdict panel */}
        <div className="mt-5 min-h-[160px] rounded-xl border border-hair bg-panel/60 p-5">
          {!verdict && (
            <div className="text-sm text-muted">
              {selected
                ? "streaming ECG… the engine's verdict appears the moment the alarm fires."
                : "Pick a record. Its ECG streams in real time; when the alarm fires, the frozen RF+CNN ensemble decides SUPPRESS / KEEP / DEFER."}
            </div>
          )}
          {verdict && <VerdictPanel v={verdict} />}
        </div>
      </section>
    </div>
  );
}

function VerdictPanel({ v }: { v: Verdict }) {
  const d = DECISION_META[v.decision];
  const conf = Math.round(v.confidence * 100);
  const pf = Math.round(v.p_false * 100);
  const truth = v.true_label === 1 ? "TRUE alarm" : v.true_label === 0 ? "FALSE alarm" : "unknown";
  return (
    <div>
      <div className="text-3xl font-bold" style={{ color: d.color }}>
        {d.label}
      </div>
      <div className="text-[13px] text-muted">{d.sub}</div>
      <div className="mt-3 h-2 overflow-hidden rounded bg-slate-800">
        <div className="h-full rounded transition-all duration-700" style={{ width: `${conf}%`, background: d.color }} />
      </div>
      <div className="mt-1.5 text-[13px] text-muted">
        confidence {conf}% · P(false)={pf}% · latency {v.latency_used_s}s
      </div>

      <div className="mt-4">
        <h3 className="mb-2 text-[11px] uppercase tracking-wider text-muted">
          Why — SHAP (→ TRUE green / → SUPPRESS red)
        </h3>
        <div className="space-y-1.5">
          {v.reasons.map((r) => {
            const pos = r.contribution_to_true > 0;
            const w = Math.min(100, Math.abs(r.contribution_to_true) * 700);
            return (
              <div key={r.feature} className="flex items-center gap-2.5 text-xs">
                <span className="w-[150px] font-mono text-[11px] text-slate-300">{r.feature}</span>
                <span className="relative h-1.5 flex-1 rounded bg-slate-800">
                  <i
                    className="absolute top-0 bottom-0 rounded"
                    style={{
                      [pos ? "left" : "right"]: "50%",
                      width: `${w / 2}%`,
                      background: pos ? "#22c55e" : "#ef4444",
                    } as React.CSSProperties}
                  />
                  <i className="absolute bottom-0 top-0 left-1/2 w-px bg-slate-600" />
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 text-[11px] text-muted">
        Ground truth for this record: <b>{truth}</b> ({v.arrhythmia}). Shown for honesty — the engine
        never sees it.
      </div>
    </div>
  );
}
