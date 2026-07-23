"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  DECISION_META,
  DemoRecord,
  fetchRecords,
  streamUrl,
  StreamMsg,
  Verdict,
} from "@/lib/api";
import { usePerf } from "./perf";
import {
  Badge,
  BorderBeam,
  Card,
  Dot,
  Gauge,
  ScanLine,
  Skeleton,
  Tabs,
  cn,
} from "./ui";

type Status = "idle" | "loading" | "monitoring" | "alarm" | "analyzed" | "error";

const STATUS_META: Record<Status, { text: string; color: string; pulse: boolean }> = {
  idle: { text: "select a record", color: "#7d8794", pulse: false },
  loading: { text: "connecting…", color: "#7d8794", pulse: true },
  monitoring: { text: "monitoring", color: "#3ddc84", pulse: true },
  alarm: { text: "⚠ ALARM — analysing", color: "#ef4444", pulse: true },
  analyzed: { text: "verdict ready", color: "#3ddc84", pulse: false },
  error: { text: "error", color: "#ef4444", pulse: false },
};

export default function LiveMonitor() {
  const { reduced } = usePerf();
  const [records, setRecords] = useState<DemoRecord[] | null>(null);
  const [filter, setFilter] = useState("ALL");
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
      .then(setRecords)
      .catch((e) => {
        setRecords([]);
        setApiError(String(e));
      });
  }, []);

  const types = useMemo(() => {
    const set = new Set((records ?? []).map((r) => r.arrhythmia).filter(Boolean) as string[]);
    return ["ALL", ...Array.from(set).sort()];
  }, [records]);

  const shown = useMemo(
    () => (records ?? []).filter((r) => filter === "ALL" || r.arrhythmia === filter),
    [records, filter]
  );

  /* ------------------------------------------------------------- canvas */

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

    // ECG paper: fine grid + bolder every 5th line
    for (const [step, alpha] of [
      [13, 0.035],
      [65, 0.09],
    ] as const) {
      ctx.strokeStyle = `rgba(61,220,132,${alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= W; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
      }
      for (let y = 0; y <= H; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      ctx.stroke();
    }

    const buf = bufRef.current;
    const n = buf.length;
    if (n > 0) {
      const show = Math.min(Math.floor(drawnRef.current), n);
      const step = W / n;
      const mid = H / 2;
      const amp = H * 0.34;

      // glow pass, then the crisp trace on top
      ctx.lineJoin = "round";
      for (const [width, color] of [
        [5, "rgba(61,220,132,0.14)"],
        [1.6, "#3ddc84"],
      ] as const) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        for (let i = 0; i < show; i++) {
          const x = i * step;
          const y = mid - buf[i] * amp;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }

      // REAL detected QRS complexes
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
        const g = ctx.createLinearGradient(x - 40, 0, x, 0);
        g.addColorStop(0, "rgba(61,220,132,0)");
        g.addColorStop(1, "rgba(61,220,132,0.35)");
        ctx.fillStyle = g;
        ctx.fillRect(x - 40, 0, 40, H);
        ctx.strokeStyle = "rgba(61,220,132,0.7)";
        ctx.lineWidth = 1;
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

  /* -------------------------------------------------------------- stream */

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
    ws.onerror = () => setStatus("error");
    ws.onclose = () => {
      drawnRef.current = bufRef.current.length;
    };
  }, []);

  useEffect(() => () => wsRef.current?.close(), []);

  const st = STATUS_META[status];
  const analysing = status === "alarm";

  /* ---------------------------------------------------------------- view */

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
      {/* ------------------------------------------------- record picker */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[11px] uppercase tracking-wider text-muted">Demo records</h2>
          {records && (
            <span className="text-[11px] text-muted">
              {shown.length}/{records.length}
            </span>
          )}
        </div>

        {apiError && (
          <Card className="mb-3 border-suppress/30 bg-suppress/[0.06] p-3 text-[12px] text-suppress">
            Engine unreachable.
            <div className="mt-1.5 text-[11px] leading-relaxed text-muted">
              Start the backend:
              <code className="mt-1 block rounded bg-black/40 px-2 py-1 text-slate-300">
                .venv/bin/uvicorn service.main:app --port 8000
              </code>
            </div>
          </Card>
        )}

        {records && types.length > 2 && (
          <Tabs
            items={types.map((t) => ({ id: t, label: t === "ALL" ? "All" : t }))}
            active={filter}
            onChange={setFilter}
            size="sm"
            className="mb-3 w-full"
          />
        )}

        <div className="max-h-[calc(100vh-15rem)] space-y-2 overflow-y-auto pr-1">
          {!records &&
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-3">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="mt-2 h-2.5 w-full" />
                <Skeleton className="mt-2 h-4 w-20 rounded-full" />
              </Card>
            ))}

          {shown.map((r, i) => {
            const d = r.decision ? DECISION_META[r.decision] : null;
            const active = r.id === selected;
            return (
              <motion.button
                key={r.id}
                onClick={() => play(r.id)}
                initial={reduced ? false : { opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.3) }}
                className={cn(
                  "relative w-full overflow-hidden rounded-xl border p-3 text-left transition",
                  active
                    ? "border-ecg/50 bg-ecg/[0.07] shadow-[0_0_28px_-14px_#3ddc84]"
                    : "border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]"
                )}
              >
                {active && (
                  <span className="absolute inset-y-0 left-0 w-[2px] bg-ecg shadow-[0_0_10px_#3ddc84]" />
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-white">{r.id}</span>
                  <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted">
                    {r.arrhythmia ?? "—"}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">{r.note}</p>
                {d && (
                  <span
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{ background: `${d.color}1f`, color: d.color }}
                  >
                    <Dot color={d.color} pulse={false} />
                    {d.label}
                  </span>
                )}
              </motion.button>
            );
          })}

          {records && records.length > 0 && shown.length === 0 && (
            <div className="rounded-xl border border-white/[0.08] p-4 text-center text-[12px] text-muted">
              no demo records of this type
            </div>
          )}
        </div>
      </aside>

      {/* ------------------------------------------------------- the stage */}
      <section>
        <div
          className="relative overflow-hidden rounded-2xl border border-white/[0.08]"
          style={{ background: "#04120b" }}
        >
          {analysing && <BorderBeam color="#ef4444" duration={2.4} inset="#04120b" />}
          <div className="relative">
            <canvas ref={canvasRef} className="block h-[340px] w-full" />
            {analysing && <ScanLine color="#ef4444" />}

            {/* top-left telemetry */}
            <div className="pointer-events-none absolute left-4 top-3.5 flex flex-wrap items-center gap-2 text-[11px]">
              {meta ? (
                <>
                  <span className="rounded bg-black/40 px-2 py-1 text-slate-300">
                    lead <b className="text-white">{meta.channel}</b>
                  </span>
                  <span className="rounded bg-black/40 px-2 py-1 text-slate-300">{meta.fs} Hz</span>
                  <span className="rounded bg-black/40 px-2 py-1 text-slate-300">
                    {meta.arrhythmia}
                  </span>
                </>
              ) : (
                <span className="rounded bg-black/40 px-2 py-1 text-muted">no signal</span>
              )}
            </div>

            {/* status pill */}
            <div className="absolute right-4 top-3.5">
              <span
                className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px]"
                style={{ borderColor: `${st.color}55`, background: `${st.color}14`, color: st.color }}
              >
                <Dot color={st.color} pulse={st.pulse} />
                {st.text}
              </span>
            </div>

            {/* legend */}
            <div className="pointer-events-none absolute bottom-3 left-4 flex items-center gap-2 text-[10px] text-muted">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[rgba(120,180,255,0.9)]" />
              detected QRS complexes (real, from our beat detector)
            </div>

            {!selected && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="rounded-xl border border-white/10 bg-black/50 px-4 py-2.5 text-[12px] text-slate-300 backdrop-blur">
                  ← pick a record to start streaming
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------ verdict panel */}
        <div className="mt-5">
          <AnimatePresence mode="wait">
            {verdict ? (
              <motion.div
                key={verdict.record_id}
                initial={reduced ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? {} : { opacity: 0, y: -10 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <VerdictPanel v={verdict} />
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Card className="p-6 text-[13px] leading-relaxed text-muted">
                  {selected
                    ? "Streaming the real pre-alarm ECG… the engine's verdict appears the moment the alarm fires."
                    : "Pick a record on the left. Its ECG streams in real time; when the alarm fires, the frozen RF+CNN ensemble decides SUPPRESS / KEEP / DEFER and shows the reasons behind the call."}
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------- verdict */

function VerdictPanel({ v }: { v: Verdict }) {
  const { reduced } = usePerf();
  const d = DECISION_META[v.decision];
  const truth = v.true_label === 1 ? "TRUE alarm" : v.true_label === 0 ? "FALSE alarm" : "unknown";
  const correct =
    v.true_label == null
      ? null
      : (v.true_label === 0 && v.decision === "suppress") ||
        (v.true_label === 1 && v.decision === "keep");

  return (
    <Card className="overflow-hidden p-6">
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${d.color}, transparent)` }}
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[auto_1fr]">
        {/* gauge */}
        <div className="flex items-center gap-5">
          <Gauge value={v.confidence} color={d.color} sub="confidence" />
          <div>
            <div
              className="text-2xl font-bold tracking-tight"
              style={{ color: d.color, textShadow: `0 0 26px ${d.color}55` }}
            >
              {d.label}
            </div>
            <div className="mt-0.5 text-[12px] text-muted">{d.sub}</div>
            <dl className="mt-3 space-y-1 text-[12px]">
              <div className="flex gap-2">
                <dt className="text-muted">P(false)</dt>
                <dd className="tabular-nums text-slate-200">
                  {(v.p_false * 100).toFixed(1)}%
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted">latency used</dt>
                <dd className="tabular-nums text-slate-200">{v.latency_used_s}s</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted">record</dt>
                <dd className="text-slate-200">
                  {v.record_id} · {v.arrhythmia}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* SHAP reasons */}
        <div>
          <h3 className="mb-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
            why this call — SHAP contributions
            <span className="normal-case tracking-normal">
              <span className="text-keep">→ real</span> <span className="text-muted">/</span>{" "}
              <span className="text-suppress">→ suppress</span>
            </span>
          </h3>
          <div className="space-y-2">
            {v.reasons.map((r, i) => {
              const pos = r.contribution_to_true > 0;
              const w = Math.min(100, Math.abs(r.contribution_to_true) * 700);
              return (
                <div key={r.feature} className="flex items-center gap-3 text-xs">
                  <span className="w-[152px] shrink-0 truncate font-mono text-[11px] text-slate-300">
                    {r.feature}
                  </span>
                  <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                    <motion.i
                      className="absolute bottom-0 top-0 rounded-full"
                      initial={reduced ? false : { width: 0 }}
                      animate={{ width: `${w / 2}%` }}
                      transition={{ duration: 0.7, delay: 0.15 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                      style={{
                        [pos ? "left" : "right"]: "50%",
                        background: pos ? "#22c55e" : "#ef4444",
                        boxShadow: `0 0 12px -2px ${pos ? "#22c55e" : "#ef4444"}`,
                      } as React.CSSProperties}
                    />
                    <i className="absolute bottom-0 left-1/2 top-0 w-px bg-white/20" />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* honesty footer */}
      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-white/[0.07] pt-4 text-[11px] text-muted">
        <span>Ground truth for this record:</span>
        <Badge tone={v.true_label === 1 ? "keep" : "suppress"}>{truth}</Badge>
        {correct !== null && (
          <Badge tone={correct ? "ecg" : "amber"}>
            {correct ? "engine agreed" : v.decision === "defer" ? "engine deferred" : "engine differed"}
          </Badge>
        )}
        <span className="ml-auto">revealed after the fact — the engine never sees it</span>
      </div>
    </Card>
  );
}
