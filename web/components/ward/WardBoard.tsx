"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DECISION_META, DemoRecord, fetchRecords, streamUrl, StreamMsg, Verdict } from "@/lib/api";
import { usePerf } from "../perf";
import { Badge, Card, Dot, Skeleton, cn } from "../ui";

type BedStatus = "idle" | "monitoring" | "alarm" | "verdict";

interface Tally {
  fired: number;
  suppress: number;
  keep: number;
  defer: number;
  missedReal: number;
}

const EMPTY: Tally = { fired: 0, suppress: 0, keep: 0, defer: 0, missedReal: 0 };

/**
 * A ward of beds streaming simultaneously — every trace, alarm and verdict is a real
 * WebSocket stream from the engine, one connection per bed. The tally at the top is a
 * running count of what actually happened this session, not a stored statistic.
 */
export default function WardBoard() {
  const [records, setRecords] = useState<DemoRecord[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [running, setRunning] = useState(true);
  const [tally, setTally] = useState<Tally>(EMPTY);

  useEffect(() => {
    fetchRecords()
      .then(setRecords)
      .catch((e) => setErr(String(e)));
  }, []);

  const beds = useMemo(() => (records ?? []).slice(0, 6), [records]);

  const onVerdict = useCallback((v: Verdict) => {
    setTally((t) => ({
      fired: t.fired + 1,
      suppress: t.suppress + (v.decision === "suppress" ? 1 : 0),
      keep: t.keep + (v.decision === "keep" ? 1 : 0),
      defer: t.defer + (v.decision === "defer" ? 1 : 0),
      missedReal: t.missedReal + (v.decision === "suppress" && v.true_label === 1 ? 1 : 0),
    }));
  }, []);

  if (err)
    return (
      <Card className="border-suppress/30 bg-suppress/[0.06] p-5 text-[13px] leading-relaxed text-suppress">
        Engine unreachable — the ward streams real records from the API.
        <code className="mt-2 block rounded bg-black/40 px-2 py-1.5 text-[12px] text-slate-300">
          .venv/bin/uvicorn service.main:app --port 8000
        </code>
      </Card>
    );

  const reduction = tally.fired ? tally.suppress / tally.fired : 0;

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------ tally bar */}
      <Card className="overflow-hidden p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-5">
            <TallyStat v={tally.fired} l="alarms fired" c="#e6edf3" />
            <TallyStat v={tally.suppress} l="silenced" c="#ef4444" />
            <TallyStat v={tally.keep} l="reached the nurse" c="#22c55e" />
            <TallyStat v={tally.defer} l="deferred" c="#f59e0b" />
            <TallyStat
              v={tally.missedReal}
              l="real alarms missed"
              c={tally.missedReal === 0 ? "#3ddc84" : "#ef4444"}
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted">noise reduction</div>
              <div className="text-xl font-bold font-mono tabular-nums text-ecg">
                {(reduction * 100).toFixed(0)}%
              </div>
            </div>
            <button
              onClick={() => setRunning((r) => !r)}
              className="rounded-lg border border-white/10 px-3 py-2 text-[12px] text-slate-300 transition hover:border-ecg/40 hover:text-white"
            >
              {running ? "⏸ pause ward" : "▶ resume ward"}
            </button>
            <button
              onClick={() => setTally(EMPTY)}
              className="rounded-lg border border-white/10 px-3 py-2 text-[12px] text-muted transition hover:text-white"
            >
              reset
            </button>
          </div>
        </div>
        <p className="mt-3 border-t border-white/[0.07] pt-3 text-[11px] leading-relaxed text-muted">
          Counted live from this session&apos;s real verdicts. &quot;Real alarms missed&quot; is the
          number that must stay at zero — it counts a genuine emergency the engine chose to
          suppress, checked against ground truth after the fact.
        </p>
      </Card>

      {/* ---------------------------------------------------------- beds */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {!records &&
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-[120px] w-full rounded-lg" />
              <Skeleton className="mt-3 h-4 w-32" />
            </Card>
          ))}
        {beds.map((r, i) => (
          <BedTile
            key={r.id}
            bed={i + 1}
            record={r}
            running={running}
            startDelayMs={i * 2600}
            onVerdict={onVerdict}
          />
        ))}
      </div>
    </div>
  );
}

function TallyStat({ v, l, c }: { v: number; l: string; c: string }) {
  return (
    <div>
      <motion.div
        key={v}
        initial={{ scale: 1.25, opacity: 0.6 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="text-2xl font-bold font-mono tabular-nums"
        style={{ color: c }}
      >
        {v}
      </motion.div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{l}</div>
    </div>
  );
}

/* -------------------------------------------------------------- one bed */

function BedTile({
  bed,
  record,
  running,
  startDelayMs,
  onVerdict,
}: {
  bed: number;
  record: DemoRecord;
  running: boolean;
  startDelayMs: number;
  onVerdict: (v: Verdict) => void;
}) {
  const { reduced } = usePerf();
  const [status, setStatus] = useState<BedStatus>("idle");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [hr, setHr] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bufRef = useRef<number[]>([]);
  const beatsRef = useRef<Set<number>>(new Set());
  const drawnRef = useRef(0);
  const flashRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    ctx.strokeStyle = "rgba(61,220,132,0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 18) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let y = 0; y <= H; y += 18) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();

    const buf = bufRef.current;
    const n = buf.length;
    if (n > 0) {
      const show = Math.min(Math.floor(drawnRef.current), n);
      const step = W / n;
      const mid = H / 2;
      const amp = H * 0.36;
      ctx.strokeStyle = "#3ddc84";
      ctx.lineWidth = 1.3;
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let i = 0; i < show; i++) {
        const x = i * step;
        const y = mid - buf[i] * amp;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
      if (show < n) {
        const x = show * step;
        ctx.strokeStyle = "rgba(61,220,132,0.6)";
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
    }

    if (flashRef.current > 0) {
      ctx.fillStyle = `rgba(239,68,68,${0.45 * flashRef.current})`;
      ctx.fillRect(0, 0, W, H);
      flashRef.current = Math.max(0, flashRef.current - 0.03);
    }
  }, []);

  useEffect(() => {
    const loop = () => {
      if (drawnRef.current < bufRef.current.length) {
        drawnRef.current += Math.max(1, bufRef.current.length / 240);
      }
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  const connect = useCallback(() => {
    wsRef.current?.close();
    bufRef.current = [];
    beatsRef.current = new Set();
    drawnRef.current = 0;
    flashRef.current = 0;
    setVerdict(null);
    setHr(null);
    setStatus("monitoring");

    const ws = new WebSocket(streamUrl(record.id, 3, 20));
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      const m: StreamMsg = JSON.parse(ev.data);
      if (m.type === "meta") {
        bufRef.current = new Array(m.total).fill(0);
        m.beats.forEach((b) => beatsRef.current.add(b));
        // real heart rate from the beats our detector found in this window
        const secs = m.seconds || m.total / m.fs;
        if (m.beats.length > 1 && secs > 0) {
          setHr(Math.round((m.beats.length / secs) * 60));
        }
      } else if (m.type === "samples") {
        for (let k = 0; k < m.v.length; k++) bufRef.current[m.i + k] = m.v[k];
        drawnRef.current = Math.max(drawnRef.current, m.i + m.v.length);
      } else if (m.type === "alarm") {
        flashRef.current = 1;
        setStatus("alarm");
      } else if (m.type === "verdict") {
        setVerdict(m);
        setStatus("verdict");
        onVerdict(m);
      } else if (m.type === "error") {
        setStatus("idle");
      }
    };
    ws.onclose = () => {
      drawnRef.current = bufRef.current.length;
    };
  }, [record.id, onVerdict]);

  // staggered start, then loop the bed so the ward keeps living
  useEffect(() => {
    if (!running) {
      wsRef.current?.close();
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    timerRef.current = setTimeout(connect, startDelayMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [running, connect, startDelayMs]);

  useEffect(() => {
    if (status !== "verdict" || !running) return;
    const t = setTimeout(connect, 9000);
    return () => clearTimeout(t);
  }, [status, running, connect]);

  const d = verdict ? DECISION_META[verdict.decision] : null;
  const alarming = status === "alarm";

  return (
    <motion.div
      animate={
        alarming && !reduced
          ? { boxShadow: ["0 0 0 0 rgba(239,68,68,0)", "0 0 32px -6px rgba(239,68,68,0.7)", "0 0 0 0 rgba(239,68,68,0)"] }
          : {}
      }
      transition={{ duration: 1.1, repeat: alarming ? Infinity : 0 }}
      className="rounded-2xl"
    >
      <Card className={cn("overflow-hidden p-4", alarming && "border-suppress/40")}>
        {/* head */}
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-white">
              Bed {bed}
            </span>
            <span className="text-[11px] text-muted">{record.id}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
            {hr != null && <span className="font-mono tabular-nums text-slate-300">{hr} bpm</span>}
            <span className="flex items-center gap-1.5" style={{ color: alarming ? "#ef4444" : "#3ddc84" }}>
              <Dot color={alarming ? "#ef4444" : "#3ddc84"} pulse={status !== "idle"} />
              {status === "alarm" ? record.arrhythmia : status === "verdict" ? "resolved" : "monitoring"}
            </span>
          </div>
        </div>

        {/* trace */}
        <div className="overflow-hidden rounded-lg border border-white/[0.06]" style={{ background: "#04120b" }}>
          <canvas ref={canvasRef} className="block h-[118px] w-full" />
        </div>

        {/* verdict */}
        <div className="mt-3 min-h-[46px]">
          <AnimatePresence mode="wait">
            {d && verdict ? (
              <motion.div
                key={verdict.decision + verdict.record_id}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? {} : { opacity: 0 }}
                className="flex items-center justify-between gap-2"
              >
                <div>
                  <span className="text-[13px] font-bold" style={{ color: d.color }}>
                    {d.label}
                  </span>
                  <span className="ml-2 text-[11px] font-mono tabular-nums text-muted">
                    {Math.round(verdict.confidence * 100)}% conf.
                  </span>
                </div>
                <Badge tone={verdict.true_label === 1 ? "keep" : "suppress"}>
                  {verdict.true_label === 1 ? "was real" : "was false"}
                </Badge>
              </motion.div>
            ) : (
              <motion.div key="wait" className="text-[11px] text-muted">
                {status === "alarm" ? "engine analysing…" : "streaming pre-alarm ECG…"}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </motion.div>
  );
}
