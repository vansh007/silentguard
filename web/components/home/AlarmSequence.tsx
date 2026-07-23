"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { DECISION_META, fetchAnalysis, fetchHeartbeat, HeartbeatData, Verdict } from "@/lib/api";
import type { HeartMode } from "../three/ParticleHeart";
import { usePerf } from "../perf";
import { useSound } from "../sound";
import { Badge, Card, Skeleton, cn } from "../ui";

const ParticleHeart = dynamic(() => import("../three/ParticleHeart"), { ssr: false });

/**
 * The whole SilentGuard story in four beats, on one real record.
 *
 * `v338s` is a genuine CinC-2015 record: the monitor screamed VTACH, the rhythm was
 * actually too regular to be ventricular tachycardia, and the engine suppresses it. The
 * verdict, confidence and ground truth shown here are fetched live — only the staging is
 * choreography.
 */
const RECORD = "v338s";
const STEP_MS = 4200;

interface Step {
  mode: HeartMode;
  eyebrow: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    mode: "beating",
    eyebrow: "00 · baseline",
    title: "A heart is beating.",
    body: "Somewhere in an ICU a patient is stable. The bedside monitor is watching a handful of derived numbers and nothing else — it has no idea whether the signal it is measuring can be trusted.",
  },
  {
    mode: "alarm",
    eyebrow: "01 · the alarm",
    title: "The monitor screams.",
    body: "A threshold trips and a ventricular-tachycardia alarm fires. Every nurse in earshot has to decide, in seconds, whether to run. Most of the time — 61% in this benchmark — there is nothing to run to.",
  },
  {
    mode: "analysing",
    eyebrow: "02 · the engine",
    title: "SilentGuard reads the waveform.",
    body: "The 16 seconds before the alarm are filtered, beats detected, signal quality measured; a RandomForest over 33 physiological features and a 1-D CNN over the raw trace each score it, and their probabilities are fused.",
  },
  {
    mode: "verdict",
    eyebrow: "03 · the verdict",
    title: "A decision, and a reason.",
    body: "Not a black-box number: a three-way call under a hard true-alarm sensitivity floor, with calibrated confidence and the features that drove it.",
  },
];

export default function AlarmSequence() {
  const { reduced } = usePerf();
  const sound = useSound();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-25% 0px -25% 0px" });

  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [hb, setHb] = useState<HeartbeatData | null>(null);

  useEffect(() => {
    fetchAnalysis(RECORD).then(setVerdict).catch(() => {});
    fetchHeartbeat(RECORD).then(setHb).catch(() => {});
  }, []);

  // advance only while the section is on screen
  useEffect(() => {
    if (!inView || !auto || reduced) return;
    const t = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), STEP_MS);
    return () => clearTimeout(t);
  }, [inView, auto, step, reduced]);

  // sound cues follow the narrative
  const soundRef = useRef(sound);
  soundRef.current = sound;
  useEffect(() => {
    if (!inView) return;
    if (step === 1) soundRef.current.alarm();
    if (step === 3 && verdict) soundRef.current.verdict(verdict.decision);
  }, [step, inView, verdict]);

  const cur = STEPS[step];
  const d = verdict ? DECISION_META[verdict.decision] : null;
  const accent =
    cur.mode === "alarm" ? "#ef4444" : cur.mode === "analysing" ? "#f59e0b" : d && step === 3 ? d.color : "#4dffa0";

  return (
    <div ref={ref}>
      <Card className="relative overflow-hidden">
        {/* alarm wash */}
        <AnimatePresence>
          {step === 1 && !reduced && (
            <motion.div
              className="pointer-events-none absolute inset-0 z-10 bg-suppress/10"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.35, 1, 0.4] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2 }}
            />
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* ------------------------------------------------- the stage */}
          <div className="relative h-[320px] sm:h-[420px]">
            <ParticleHeart
              beatTimes={hb?.beat_times_s}
              reduced={reduced}
              mode={cur.mode}
              accent={accent}
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(65% 60% at 50% 50%, transparent 35%, rgba(5,7,10,0.5) 75%, rgba(5,7,10,0.9) 100%)",
              }}
            />
            <div className="pointer-events-none absolute bottom-3 left-4 font-mono text-[10px] text-muted">
              record {RECORD}
              {hb?.bpm ? ` · ${hb.bpm} bpm (real detected beats)` : ""}
            </div>
          </div>

          {/* -------------------------------------------------- the text */}
          <div className="flex flex-col justify-center p-6 sm:p-9">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={reduced ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? {} : { opacity: 0, y: -12 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-ecg/80">
                  {cur.eyebrow}
                </div>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  {cur.title}
                </h3>
                <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-slate-300">
                  {cur.body}
                </p>

                {/* the real verdict, only on the last beat */}
                {step === 3 && (
                  <div className="mt-5">
                    {verdict && d ? (
                      <div className="rounded-xl border border-white/[0.08] bg-black/30 p-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <span
                            className="text-xl font-bold"
                            style={{ color: d.color, textShadow: `0 0 24px ${d.color}55` }}
                          >
                            {d.label}
                          </span>
                          <span className="font-mono text-[12px] tabular-nums text-muted">
                            {Math.round(verdict.confidence * 100)}% confidence
                          </span>
                          <Badge tone={verdict.true_label === 1 ? "keep" : "suppress"}>
                            truth: {verdict.true_label === 1 ? "real" : "false"} alarm
                          </Badge>
                        </div>
                        {verdict.reasons[0] && (
                          <p className="mt-2 font-mono text-[11px] text-muted">
                            top reason: {verdict.reasons[0].feature}
                          </p>
                        )}
                      </div>
                    ) : (
                      <Skeleton className="h-20 w-full rounded-xl" />
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* step control */}
            <div className="mt-7 flex items-center gap-2">
              {STEPS.map((s, i) => (
                <button
                  key={s.eyebrow}
                  onClick={() => {
                    setAuto(false);
                    setStep(i);
                  }}
                  aria-label={s.title}
                  aria-current={i === step}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === step ? "w-8 bg-ecg" : "w-4 bg-white/15 hover:bg-white/30"
                  )}
                />
              ))}
              <button
                onClick={() => setAuto((a) => !a)}
                className="ml-3 font-mono text-[10px] uppercase tracking-wider text-muted transition hover:text-white"
              >
                {auto ? "❚❚ pause" : "▶ play"}
              </button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
