"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  DECISION_META,
  ExplainerCard,
  fetchExplainer,
  fetchSaliency,
  fetchWaveform,
  SaliencyData,
  WaveformData,
} from "@/lib/api";
import ECGCanvas from "./ECGCanvas";
import { usePerf } from "./perf";
import { Badge, Card, Dot, ScanLine, Skeleton, SpotlightCard, Tabs, cn } from "./ui";

const TONES: Record<string, string> = {
  ASYSTOLE: "#ef4444",
  BRADY: "#38bdf8",
  TACHY: "#f59e0b",
  VTACH: "#a78bfa",
  VFIB: "#fb7185",
};

export default function Explainer() {
  const { reduced } = usePerf();
  const [cards, setCards] = useState<ExplainerCard[] | null>(null);
  const [waves, setWaves] = useState<Record<string, WaveformData>>({});
  const [sal, setSal] = useState<Record<string, SaliencyData>>({});
  const [active, setActive] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchExplainer()
      .then((cs) => {
        setCards(cs);
        setActive(cs[0]?.type ?? null);
        cs.forEach((c) => {
          fetchWaveform(c.record, 8)
            .then((w) => setWaves((prev) => ({ ...prev, [c.record]: w })))
            .catch(() => {});
          fetchSaliency(c.record, 120)
            .then((s) => setSal((prev) => ({ ...prev, [c.record]: s })))
            .catch(() => {});
        });
      })
      .catch((e) => setErr(String(e)));
  }, []);

  const card = useMemo(() => cards?.find((c) => c.type === active) ?? null, [cards, active]);

  if (err)
    return (
      <Card className="border-suppress/30 bg-suppress/[0.06] p-5 text-[13px] leading-relaxed text-suppress">
        Engine unreachable — the ECGs and verdicts on this page come from the running model, so
        nothing is shown rather than faked.
        <code className="mt-2 block rounded bg-black/40 px-2 py-1.5 text-[12px] text-slate-300">
          .venv/bin/uvicorn service.main:app --port 8000
        </code>
      </Card>
    );

  if (!cards)
    return (
      <div className="space-y-4">
        <Skeleton className="h-11 w-full max-w-lg rounded-xl" />
        <Card className="p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <Skeleton className="h-6 w-52" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-4/5" />
              <Skeleton className="mt-5 h-12 w-full rounded-xl" />
            </div>
            <Skeleton className="h-[168px] w-full rounded-xl" />
          </div>
        </Card>
      </div>
    );

  const w = card ? waves[card.record] : undefined;
  const d = card?.decision ? DECISION_META[card.decision] : null;
  const tone = card ? TONES[card.type] ?? "#3ddc84" : "#3ddc84";

  return (
    <div className="space-y-5">
      {/* type selector */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          items={cards.map((c) => ({
            id: c.type,
            label: c.type,
            hint: `${c.name} — ${c.criterion}`,
          }))}
          active={active ?? ""}
          onChange={setActive}
        />
        <span className="text-[11px] text-muted">
          {cards.length} alarm types · each on a real record
        </span>
      </div>

      {/* detail */}
      <AnimatePresence mode="wait">
        {card && (
          <motion.div
            key={card.type}
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? {} : { opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <SpotlightCard hover={false} className="overflow-hidden p-6 sm:p-7">
              <div
                className="absolute inset-x-0 top-0 h-[2px]"
                style={{ background: `linear-gradient(90deg, transparent, ${tone}, transparent)` }}
              />
              <div className="grid grid-cols-1 gap-7 lg:grid-cols-[1fr_1.15fr]">
                {/* ------------------------------------------ teaching */}
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-semibold tracking-tight text-white">{card.name}</h3>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider"
                      style={{ background: `${tone}1f`, color: tone }}
                    >
                      {card.type}
                    </span>
                  </div>

                  <p className="mt-3 text-[13.5px] leading-relaxed text-slate-300">
                    {card.clinical}
                  </p>

                  <div className="mt-5 rounded-xl border border-white/[0.08] bg-black/25 p-4">
                    <div className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted">
                      <Dot color={tone} pulse={false} />
                      monitor alarm criterion
                    </div>
                    <div className="font-mono text-[12.5px] text-slate-200">{card.criterion}</div>
                  </div>

                  <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
                    <div className="mb-1.5 text-[10px] uppercase tracking-wider text-amber-300/80">
                      why it fires falsely
                    </div>
                    <p className="text-[13px] leading-relaxed text-slate-300">{card.false_hint}</p>
                  </div>
                </div>

                {/* --------------------------------------- real evidence */}
                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
                    <span>
                      real record <b className="text-slate-200">{card.record}</b>
                      {w?.channel ? ` · lead ${w.channel}` : ""}
                      {w ? ` · ${w.fs} Hz` : ""}
                    </span>
                    <span>{w ? `${w.beats.length} beats detected · 8 s` : "loading ECG…"}</span>
                  </div>

                  <div
                    className="relative overflow-hidden rounded-xl border border-white/[0.08]"
                    style={{ background: "#04120b" }}
                  >
                    {w ? (
                      <ECGCanvas samples={w.samples} beats={w.beats} height={168} color={tone} />
                    ) : (
                      <div className="relative flex h-[168px] items-center justify-center text-[12px] text-muted">
                        <ScanLine />
                        loading real waveform…
                      </div>
                    )}
                  </div>

                  {/* where the CNN looked, on this exact record */}
                  {sal[card.record] && (
                    <div className="mt-2">
                      <SaliencyStrip data={sal[card.record]} tone={tone} />
                    </div>
                  )}

                  {/* engine verdict on this exact record */}
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Card className="p-4">
                      <div className="text-[10px] uppercase tracking-wider text-muted">
                        engine verdict
                      </div>
                      {d ? (
                        <div className="mt-1.5 flex items-baseline gap-2">
                          <span className="text-lg font-bold" style={{ color: d.color }}>
                            {d.label}
                          </span>
                          <span className="text-[12px] font-mono tabular-nums text-muted">
                            {Math.round((card.confidence ?? 0) * 100)}% conf.
                          </span>
                        </div>
                      ) : (
                        <div className="mt-1.5 text-[12px] text-muted">unavailable</div>
                      )}
                      {d && (
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                          <motion.div
                            className="h-full rounded-full"
                            initial={reduced ? false : { width: 0 }}
                            animate={{ width: `${Math.round((card.confidence ?? 0) * 100)}%` }}
                            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                            style={{ background: d.color }}
                          />
                        </div>
                      )}
                    </Card>

                    <Card className="p-4">
                      <div className="text-[10px] uppercase tracking-wider text-muted">
                        ground truth
                      </div>
                      <div className="mt-1.5">
                        <Badge tone={card.true_label === 1 ? "keep" : "suppress"}>
                          {card.true_label === 1
                            ? "TRUE alarm"
                            : card.true_label === 0
                              ? "FALSE alarm"
                              : "unknown"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-muted">
                        Shown for honesty only — never given to the model.
                      </p>
                    </Card>
                  </div>

                  <p className="mt-3 text-[11px] leading-relaxed text-muted">
                    Dots mark QRS complexes found by our own beat detector on this record — not
                    annotations shipped with the data.
                  </p>
                </div>
              </div>
            </SpotlightCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* type strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {cards.map((c) => {
          const on = c.type === active;
          const t = TONES[c.type] ?? "#3ddc84";
          return (
            <button
              key={c.type}
              onClick={() => setActive(c.type)}
              className={cn(
                "rounded-xl border p-3 text-left transition",
                on
                  ? "border-white/20 bg-white/[0.06]"
                  : "border-white/[0.07] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
              )}
            >
              <span className="block h-1 w-8 rounded-full" style={{ background: t }} />
              <span className="mt-2 block text-[12px] font-medium text-slate-200">{c.name}</span>
              <span className="mt-0.5 block text-[10px] text-muted">{c.record}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- saliency strip */

/**
 * Grad-CAM attention across the CNN's analysis window, drawn as a heat strip.
 * Real model output — the taller/brighter the band, the more that slice of the
 * waveform drove the network's decision.
 */
function SaliencyStrip({ data, tone }: { data: SaliencyData; tone: string }) {
  const s = data.saliency;
  const peakIdx = s.reduce((b, v, i) => (v > s[b] ? i : b), 0);
  const peakS = data.window_seconds * (1 - (peakIdx + 0.5) / s.length);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px] text-muted">
        <span>where the CNN looked (Grad-CAM)</span>
        <span className="font-mono">peak {peakS.toFixed(1)}s before the alarm</span>
      </div>
      <div className="flex h-6 items-end gap-px overflow-hidden rounded-md bg-white/[0.03] p-px">
        {s.map((v, i) => (
          <span
            key={i}
            className="flex-1 rounded-[1px]"
            style={{
              height: `${Math.max(6, v * 100)}%`,
              background: tone,
              opacity: 0.18 + 0.82 * v,
            }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-muted">
        <span>−{data.window_seconds}s</span>
        <span>alarm</span>
      </div>
    </div>
  );
}
