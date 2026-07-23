"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { fetchOof, OofData } from "@/lib/api";
import { calibrateThresholds, safetyCurve, safetyReport, decide, challengeScore } from "@/lib/safety";
import { usePerf } from "../perf";
import { Badge, Card, Skeleton, Tabs, cn } from "../ui";

const MODELS = [
  { id: "ens", label: "RF+CNN ensemble" },
  { id: "rf", label: "RandomForest" },
  { id: "cnn", label: "1D-CNN" },
];

const SPLITS = [
  { id: "indist", label: "In-distribution", hint: "leak-free 5-fold CV" },
  { id: "loao", label: "Unseen arrhythmia", hint: "leave-one-arrhythmia-out" },
];

/**
 * Drag the true-alarm sensitivity floor and watch the whole operating point move.
 * Everything is recomputed in the browser from the REAL per-record out-of-fold
 * predictions (`/api/oof`) using a faithful port of the Python safety layer.
 */
export default function SafetyDial() {
  const { reduced } = usePerf();
  const [data, setData] = useState<OofData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [model, setModel] = useState("ens");
  const [split, setSplit] = useState("indist");
  const [floor, setFloor] = useState(0.99);

  useEffect(() => {
    fetchOof()
      .then((d) => (d.available ? setData(d) : setErr(d.detail ?? "not generated yet")))
      .catch((e) => setErr(String(e)));
  }, []);

  const { pFalse, y } = useMemo(() => {
    if (!data) return { pFalse: [] as number[], y: [] as number[] };
    const key = split === "loao" ? "p_true_loao" : "p_true_indist";
    const raw = data.models[model]?.[key as "p_true_indist"] ?? [];
    const pf: number[] = [];
    const yy: number[] = [];
    raw.forEach((p, i) => {
      if (p != null && Number.isFinite(p)) {
        pf.push(1 - p);
        yy.push(data.label[i]);
      }
    });
    return { pFalse: pf, y: yy };
  }, [data, model, split]);

  const report = useMemo(() => {
    if (!pFalse.length) return null;
    const th = calibrateThresholds(pFalse, y, floor);
    const rep = safetyReport(pFalse, y, th.tHigh, th.tLow);
    const keep = pFalse.map((p) => (decide(p, th.tHigh, th.tLow) === "suppress" ? 0 : 1));
    return { ...rep, score: challengeScore(y, keep) };
  }, [pFalse, y, floor]);

  const curve = useMemo(() => (pFalse.length ? safetyCurve(pFalse, y) : []), [pFalse, y]);

  if (err)
    return (
      <Card className="p-5 text-[13px] leading-relaxed text-muted">
        <span className="text-amber-300/90">Per-record predictions unavailable.</span> This control
        recomputes on real out-of-fold predictions, so it shows nothing rather than a simulation.
        Generate them with
        <code className="mt-2 block rounded bg-black/40 px-2 py-1.5 text-[12px] text-slate-300">
          .venv/bin/python scripts/make_figures.py
        </code>
      </Card>
    );

  if (!data || !report)
    return (
      <div className="space-y-4">
        <Skeleton className="h-11 w-full max-w-md rounded-xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );

  const missed = report.suppressedTrue;
  const violates = report.trueSensitivity < floor - 1e-9;

  return (
    <div className="space-y-5">
      {/* controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs items={MODELS} active={model} onChange={setModel} size="sm" />
        <Tabs items={SPLITS} active={split} onChange={setSplit} size="sm" />
        <Badge tone="ecg">{report.n} real records</Badge>
      </div>

      <Card className="overflow-hidden p-6">
        <div className="grid grid-cols-1 gap-7 lg:grid-cols-[1fr_1.1fr]">
          {/* -------------------------------------------------- the dial */}
          <div>
            <label htmlFor="floor" className="block text-[11px] uppercase tracking-wider text-muted">
              true-alarm sensitivity floor
            </label>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-4xl font-bold tabular-nums text-white">
                {(floor * 100).toFixed(1)}%
              </span>
              <span className="text-[12px] text-muted">of real emergencies must survive</span>
            </div>

            <input
              id="floor"
              type="range"
              min={0.9}
              max={1}
              step={0.002}
              value={floor}
              onChange={(e) => setFloor(parseFloat(e.target.value))}
              aria-label="True-alarm sensitivity floor"
              className="mt-4 w-full accent-[#3ddc84]"
            />
            <div className="mt-1 flex justify-between text-[10px] text-muted">
              <span>90% — permissive</span>
              <span>100% — never suppress a real alarm</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {[0.95, 0.99, 1.0].map((f) => (
                <button
                  key={f}
                  onClick={() => setFloor(f)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-[11px] transition",
                    Math.abs(floor - f) < 1e-9
                      ? "border-ecg/40 bg-ecg/10 text-ecg"
                      : "border-white/10 text-muted hover:text-white"
                  )}
                >
                  {f === 0.99 ? "99% (ours)" : `${f * 100}%`}
                </button>
              ))}
            </div>

            {/* consequence readout */}
            <div className="mt-6 space-y-3">
              <Stat
                label="false alarms silenced"
                value={`${(report.faSuppression * 100).toFixed(1)}%`}
                sub={`${report.suppressedFalse} of ${report.n - y.reduce((a, v) => a + v, 0)} false alarms`}
                bar={report.faSuppression}
                color="#ef4444"
              />
              <Stat
                label="handed to a human (defer)"
                value={`${(report.deferRate * 100).toFixed(1)}%`}
                sub={`${report.nDefer} alarms routed for review`}
                bar={report.deferRate}
                color="#f59e0b"
              />
              <Stat
                label="true-alarm sensitivity achieved"
                value={`${(report.trueSensitivity * 100).toFixed(2)}%`}
                sub={
                  missed === 0
                    ? "no real emergency suppressed"
                    : `${missed} real ${missed === 1 ? "emergency" : "emergencies"} suppressed`
                }
                bar={report.trueSensitivity}
                color={missed === 0 ? "#22c55e" : "#f59e0b"}
              />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-4 text-[12px]">
              <div>
                <div className="text-muted">challenge score</div>
                <div className="text-lg font-semibold tabular-nums text-white">
                  {report.score.toFixed(3)}
                </div>
              </div>
              <div>
                <div className="text-muted">suppress cutoff (t_high)</div>
                <div className="text-lg font-semibold tabular-nums text-white">
                  {report.tHigh.toFixed(3)}
                </div>
              </div>
            </div>

            {violates && (
              <p className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-3 text-[11px] leading-relaxed text-amber-300/90">
                At this floor the discrete set of 750 records cannot hit the target exactly — the
                layer lands at {(report.trueSensitivity * 100).toFixed(2)}%. That granularity limit
                is real and we show it rather than rounding it away.
              </p>
            )}
          </div>

          {/* ------------------------------------------------ the curve */}
          <div>
            <div className="mb-2 flex items-center justify-between text-[11px] text-muted">
              <span>false-alarm suppression vs. true-alarm sensitivity</span>
              <span className="tabular-nums">{curve.length} operating points</span>
            </div>
            <TradeoffPlot curve={curve} floor={floor} report={report} reduced={reduced} />
            <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
              Every point is a real threshold on real out-of-fold predictions. Moving the floor to
              the right (safer) forces the operating point down the curve — that fall is the price
              of the guarantee, and it is exactly the trade-off a ward has to make.
            </p>
          </div>
        </div>
      </Card>

      {/* the three-way split */}
      <DecisionSplit report={report} reduced={reduced} />
    </div>
  );
}

/* ------------------------------------------------------------------ bits */

function Stat({
  label,
  value,
  sub,
  bar,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  bar: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] text-slate-300">{label}</span>
        <span className="text-[15px] font-semibold tabular-nums" style={{ color }}>
          {value}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${Math.max(0, Math.min(1, bar)) * 100}%` }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          style={{ background: color }}
        />
      </div>
      <div className="mt-1 text-[10.5px] text-muted">{sub}</div>
    </div>
  );
}

function TradeoffPlot({
  curve,
  floor,
  report,
  reduced,
}: {
  curve: Array<{ t: number; sens: number; supp: number }>;
  floor: number;
  report: { trueSensitivity: number; faSuppression: number };
  reduced: boolean;
}) {
  const W = 420;
  const H = 300;
  const P = { l: 40, r: 12, t: 12, b: 34 };
  // x = sensitivity from 0.6..1 (inverted: safer to the right, as in fig3)
  const x0 = 0.6;
  const sx = (s: number) => P.l + ((s - x0) / (1 - x0)) * (W - P.l - P.r);
  const sy = (v: number) => H - P.b - v * (H - P.t - P.b);

  const path = curve
    .filter((p) => p.sens >= x0)
    .map((p, i) => `${i ? "L" : "M"}${sx(p.sens).toFixed(1)} ${sy(p.supp).toFixed(1)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
      aria-label={`Trade-off curve: at ${(report.trueSensitivity * 100).toFixed(1)}% sensitivity, ${(report.faSuppression * 100).toFixed(1)}% of false alarms are suppressed.`}>
      {/* grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((v) => (
        <g key={v}>
          <line x1={P.l} x2={W - P.r} y1={sy(v)} y2={sy(v)} stroke="rgba(255,255,255,0.06)" />
          <text x={P.l - 6} y={sy(v) + 3.5} textAnchor="end" fontSize="9" fill="#7d8794">
            {v * 100}%
          </text>
        </g>
      ))}
      {[0.6, 0.7, 0.8, 0.9, 1].map((v) => (
        <text key={v} x={sx(v)} y={H - P.b + 14} textAnchor="middle" fontSize="9" fill="#7d8794">
          {(v * 100).toFixed(0)}%
        </text>
      ))}
      <text x={(W + P.l) / 2} y={H - 4} textAnchor="middle" fontSize="9.5" fill="#7d8794">
        true-alarm sensitivity →
      </text>

      {/* the curve */}
      <motion.path
        d={path}
        fill="none"
        stroke="#3ddc84"
        strokeWidth={2}
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />

      {/* the floor */}
      <line
        x1={sx(floor)}
        x2={sx(floor)}
        y1={P.t}
        y2={H - P.b}
        stroke="#f59e0b"
        strokeWidth={1.4}
        strokeDasharray="4 4"
      />
      <text x={sx(floor) - 5} y={P.t + 10} textAnchor="end" fontSize="9" fill="#f59e0b">
        floor
      </text>

      {/* the chosen operating point */}
      <motion.circle
        cx={sx(report.trueSensitivity)}
        cy={sy(report.faSuppression)}
        r={6}
        fill="#3ddc84"
        stroke="#05070a"
        strokeWidth={2}
        animate={{
          cx: sx(report.trueSensitivity),
          cy: sy(report.faSuppression),
        }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}
        style={{ filter: "drop-shadow(0 0 8px #3ddc84aa)" }}
      />
    </svg>
  );
}

function DecisionSplit({
  report,
  reduced,
}: {
  report: { nSuppress: number; nKeep: number; nDefer: number; n: number };
  reduced: boolean;
}) {
  const parts = [
    { k: "SUPPRESS", v: report.nSuppress, c: "#ef4444" },
    { k: "KEEP", v: report.nKeep, c: "#22c55e" },
    { k: "DEFER", v: report.nDefer, c: "#f59e0b" },
  ];
  return (
    <Card className="p-5">
      <div className="mb-3 text-[11px] uppercase tracking-wider text-muted">
        what happens to all {report.n} alarms at this setting
      </div>
      <div className="flex h-8 overflow-hidden rounded-lg">
        {parts.map((p) => (
          <motion.div
            key={p.k}
            className="flex items-center justify-center text-[10px] font-semibold text-black/70"
            animate={{ width: `${(p.v / report.n) * 100}%` }}
            transition={reduced ? { duration: 0 } : { duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{ background: p.c }}
            title={`${p.k}: ${p.v}`}
          >
            {p.v / report.n > 0.08 ? p.v : ""}
          </motion.div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-[11px]">
        {parts.map((p) => (
          <span key={p.k} className="flex items-center gap-1.5 text-muted">
            <span className="h-2 w-2 rounded-sm" style={{ background: p.c }} />
            {p.k} <b className="tabular-nums text-slate-200">{p.v}</b>
          </span>
        ))}
      </div>
    </Card>
  );
}
