"use client";

import { motion } from "framer-motion";
import { usePerf } from "../perf";
import SpotlightCard from "./spotlight-card";

export interface PipelineStep {
  k: string;
  title: string;
  body: string;
  icon: React.ReactNode;
}

/** Numbered steps joined by an animated flowing beam (AnimatedBeam-style). */
export default function Pipeline({ steps }: { steps: PipelineStep[] }) {
  const { reduced } = usePerf();
  return (
    <div className="relative">
      {/* connector: only drawn on wide screens where the steps sit in a row */}
      <div className="pointer-events-none absolute inset-x-0 top-[74px] hidden md:block">
        <div className="relative mx-[16%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent">
          {!reduced && (
            <div className="absolute inset-0 overflow-hidden">
              <div className="h-px w-1/3 animate-beam-x bg-gradient-to-r from-transparent via-ecg to-transparent" />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <motion.div
            key={s.k}
            initial={reduced ? false : { opacity: 0, y: 22 }}
            whileInView={reduced ? {} : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-70px" }}
            transition={{ duration: 0.55, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            <SpotlightCard className="h-full p-6">
              <div className="flex items-center gap-3">
                <span className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-ecg/25 bg-ecg/10 text-lg text-ecg">
                  {s.icon}
                </span>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted">
                    step {i + 1}
                  </div>
                  <div className="text-sm font-semibold text-white">{s.title}</div>
                </div>
              </div>
              <p className="mt-4 text-[13px] leading-relaxed text-slate-300">{s.body}</p>
            </SpotlightCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
