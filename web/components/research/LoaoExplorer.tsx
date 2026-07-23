"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { fetchResults, ResultsData } from "@/lib/api";
import { usePerf } from "../perf";
import { Badge, Card, Skeleton, Tabs, cn } from "../ui";

const ORDER = ["ASYSTOLE", "BRADY", "TACHY", "VTACH", "VFIB"];
const TONES: Record<string, string> = {
  ASYSTOLE: "#ef4444",
  BRADY: "#38bdf8",
  TACHY: "#f59e0b",
  VTACH: "#a78bfa",
  VFIB: "#fb7185",
};
const MODELS = [
  { id: "RF+CNN ensemble", label: "RF+CNN ensemble" },
  { id: "RandomForest", label: "RandomForest" },
  { id: "1D-CNN", label: "1D-CNN" },
];

const STORY: Record<string, string> = {
  ASYSTOLE:
    "Asystole survives best. A flat trace is unusual enough that the signal-quality features still flag it even when the model has never trained on an asystole alarm — the giveaway is generic, not rhythm-specific.",
  BRADY:
    "Bradycardia collapses badly. Without brady examples the model has no notion that widely-spaced beats can be legitimate, so it mis-ranks slow rhythms.",
  TACHY:
    "The worst case, and the important one: AUROC falls below 0.5, meaning the model actively mis-ranks tachycardia alarms. A model never trained on tachycardia will confidently suppress real tachycardia alarms. This is the single strongest argument against deploying a suppression filter on rhythms it has not seen.",
  VTACH:
    "Ventricular tachycardia is the hardest rhythm even in-distribution — the too-regular false VT is a genuinely subtle call — and holding it out removes the only examples that teach that distinction.",
  VFIB:
    "Flutter/fibrillation looks like noise, and noise is what the signal-quality features are built to detect — so some ability transfers, but not enough to be safe.",
};

/**
 * Toggle an arrhythmia out of training and watch the score collapse.
 * Every number is read from `loao_pertype.csv` via `/api/results` — the same file the
 * paper's Table 2 and Figure 2 are built from.
 */
export default function LoaoExplorer() {
  const { reduced } = usePerf();
  const [d, setD] = useState<ResultsData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [model, setModel] = useState("RF+CNN ensemble");
  const [held, setHeld] = useState("TACHY");

  useEffect(() => {
    fetchResults()
      .then(setD)
      .catch((e) => setErr(String(e)));
  }, []);

  const rows = useMemo(() => (d?.loao ?? []).filter((r) => r.model === model), [d, model]);
  const byType = useMemo(() => Object.fromEntries(rows.map((r) => [r.held_out, r])), [rows]);
  const indist = useMemo(
    () => d?.summary.find((r) => r.model === model || (model.includes("ensemble") && r.model.includes("ensemble"))),
    [d, model]
  );

  if (err)
    return (
      <Card className="border-suppress/30 bg-suppress/[0.06] p-5 text-[13px] text-suppress">
        Engine unreachable — the LOAO numbers come from the model&apos;s result files.
      </Card>
    );
  if (!d) return <Skeleton className="h-80 w-full rounded-2xl" />;

  const ref = indist ? parseFloat(indist.indist_score) : NaN;
  const cur = byType[held] ? parseFloat(byType[held].challenge_score) : NaN;
  const curAuroc = byType[held] ? parseFloat(byType[held].auroc) : NaN;
  const curSens = byType[held] ? parseFloat(byType[held].true_sensitivity) : NaN;
  const drop = Number.isFinite(ref) && Number.isFinite(cur) ? (1 - cur / ref) * 100 : NaN;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs items={MODELS} active={model} onChange={setModel} size="sm" />
        <Badge tone="amber">zero-shot — the held-out type is never seen in training</Badge>
      </div>

      <Card className="overflow-hidden p-6">
        <div className="grid grid-cols-1 gap-7 lg:grid-cols-[1.05fr_1fr]">
          {/* ------------------------------------------------- selector */}
          <div>
            <div className="mb-3 text-[11px] uppercase tracking-wider text-muted">
              remove this arrhythmia from training
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ORDER.filter((t) => byType[t]).map((t) => {
                const on = t === held;
                const s = parseFloat(byType[t].challenge_score);
                return (
                  <button
                    key={t}
                    onClick={() => setHeld(t)}
                    aria-pressed={on}
                    className={cn(
                      "group relative overflow-hidden rounded-xl border p-3 text-left transition",
                      on
                        ? "border-white/25 bg-white/[0.07]"
                        : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-[12px] font-semibold text-white">
                        <span
                          className="h-3 w-1 rounded-full"
                          style={{ background: TONES[t] }}
                        />
                        {t}
                      </span>
                      <span className="font-mono tabular-nums text-[12px]" style={{ color: TONES[t] }}>
                        {s.toFixed(3)}
                      </span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <motion.div
                        className="h-full rounded-full"
                        initial={reduced ? false : { width: 0 }}
                        animate={{ width: `${Math.max(0, Math.min(1, s / (ref || 1))) * 100}%` }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        style={{ background: TONES[t] }}
                      />
                    </div>
                    <div className="mt-1 text-[10px] text-muted">
                      {byType[t].n_true} true · {byType[t].n_false} false
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="mt-4 text-[11.5px] leading-relaxed text-muted">
              Bars are relative to the in-distribution score ({Number.isFinite(ref) ? ref.toFixed(3) : "—"}).
              Every value is the same leak-free protocol: thresholds chosen on a validation split of
              the <i>training</i> types only.
            </p>
          </div>

          {/* -------------------------------------------------- collapse */}
          <div>
            <div className="mb-4 text-[11px] uppercase tracking-wider text-muted">
              what holding out {held} costs
            </div>

            <div className="flex items-end gap-6">
              <div>
                <div className="text-[11px] text-muted">trained on all five</div>
                <div className="text-3xl font-bold font-mono tabular-nums text-white">
                  {Number.isFinite(ref) ? ref.toFixed(3) : "—"}
                </div>
              </div>
              <motion.div
                className="pb-2 text-2xl text-muted"
                animate={reduced ? {} : { x: [0, 5, 0] }}
                transition={{ duration: 1.8, repeat: Infinity }}
              >
                →
              </motion.div>
              <div>
                <div className="text-[11px] text-muted">{held} never seen</div>
                <motion.div
                  key={held + model}
                  initial={reduced ? false : { opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-3xl font-bold font-mono tabular-nums"
                  style={{ color: TONES[held] }}
                >
                  {Number.isFinite(cur) ? cur.toFixed(3) : "—"}
                </motion.div>
              </div>
            </div>

            {Number.isFinite(drop) && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-suppress/30 bg-suppress/10 px-3 py-1 text-[12px] text-suppress">
                ▼ {drop.toFixed(0)}% of the score gone
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <Card className="p-4">
                <div className="text-[10px] uppercase tracking-wider text-muted">AUROC</div>
                <div
                  className="mt-1 text-xl font-bold font-mono tabular-nums"
                  style={{ color: curAuroc < 0.5 ? "#ef4444" : "#e6edf3" }}
                >
                  {Number.isFinite(curAuroc) ? curAuroc.toFixed(3) : "—"}
                </div>
                <div className="mt-1 text-[10px] text-muted">
                  {curAuroc < 0.5 ? "below chance — actively inverted" : "above chance"}
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-[10px] uppercase tracking-wider text-muted">
                  true-alarm sensitivity
                </div>
                <div className="mt-1 text-xl font-bold font-mono tabular-nums text-white">
                  {Number.isFinite(curSens) ? `${(curSens * 100).toFixed(0)}%` : "—"}
                </div>
                <div className="mt-1 text-[10px] text-muted">real alarms that survived</div>
              </Card>
            </div>

            <motion.p
              key={held}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 rounded-xl border border-white/[0.08] bg-black/25 p-4 text-[12.5px] leading-relaxed text-slate-300"
            >
              {STORY[held]}
            </motion.p>
          </div>
        </div>
      </Card>
    </div>
  );
}
