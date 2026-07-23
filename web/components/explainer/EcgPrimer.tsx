"use client";

import { motion } from "framer-motion";
import { usePerf } from "../perf";
import { Accordion, Card } from "../ui";

/** Idealised P-QRS-T schematic — explicitly NOT patient data (the real ECGs sit below). */
function SchematicBeat() {
  const { reduced } = usePerf();
  const d =
    "M0 60 L40 60 q10 -14 20 0 L90 60 L100 74 L110 18 L120 82 L134 60 L160 60 q14 -20 28 0 L240 60";
  return (
    <div className="relative">
      <svg viewBox="0 0 240 100" className="w-full" style={{ maxHeight: 150 }}>
        <motion.path
          d={d}
          fill="none"
          stroke="#3ddc84"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={reduced ? false : { pathLength: 0 }}
          whileInView={reduced ? {} : { pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.6, ease: "easeInOut" }}
        />
        <g fill="#7d8794" fontSize="9" fontFamily="ui-monospace, monospace">
          <text x="44" y="38">P</text>
          <text x="100" y="12">R</text>
          <text x="90" y="90">Q</text>
          <text x="118" y="94">S</text>
          <text x="168" y="32">T</text>
        </g>
      </svg>
      <div className="mt-1 text-center text-[10px] uppercase tracking-wider text-muted">
        idealised schematic — not patient data
      </div>
    </div>
  );
}

export default function EcgPrimer() {
  return (
    <Card className="mb-6 overflow-hidden p-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <div>
          <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-ecg/80">
            reading an ECG
          </div>
          <SchematicBeat />
        </div>
        <Accordion
          defaultOpen="waves"
          items={[
            {
              id: "waves",
              tone: "#3ddc84",
              title: "What the P, QRS and T waves mean",
              body: (
                <>
                  The <b className="text-white">P wave</b> is the atria contracting, pushing blood
                  into the ventricles. The tall <b className="text-white">QRS complex</b> is the
                  ventricles contracting — this is the beat you feel as a pulse, and the spike our
                  detector locks onto. The <b className="text-white">T wave</b> is the ventricles
                  electrically resetting. A dangerous rhythm distorts this pattern: asystole flattens
                  it, tachycardia crowds it together, ventricular fibrillation shreds it entirely.
                </>
              ),
            },
            {
              id: "false",
              tone: "#f59e0b",
              title: "Why a monitor cries wolf",
              body: (
                <>
                  Bedside monitors trigger on simple thresholds over a single derived signal. A lead
                  that peels off the skin, a patient turning over, chest physiotherapy, or electrical
                  interference all mimic the pattern the threshold is looking for. The monitor is not
                  broken — it simply has no notion of whether the signal it is measuring is
                  trustworthy. That is precisely the gap our signal-quality features fill.
                </>
              ),
            },
            {
              id: "cross",
              tone: "#38bdf8",
              title: "Why a second signal settles most arguments",
              body: (
                <>
                  Many records carry an arterial blood pressure or photoplethysmogram channel
                  alongside the ECG. If the ECG claims the heart stopped but the pressure wave keeps
                  pulsing, the heart plainly did not stop — the electrode did. Cross-signal agreement
                  is one of the strongest features in the model, and it shows up repeatedly in the
                  SHAP explanations on the Live Monitor.
                </>
              ),
            },
            {
              id: "detect",
              tone: "#a78bfa",
              title: "How we find the beats",
              body: (
                <>
                  Every ECG is band-pass filtered, has its baseline wander removed and is normalised
                  before two independent QRS detectors run over it. Their level of agreement becomes
                  a signal-quality index (bSQI): when two good detectors disagree about where the
                  beats are, the signal is usually noise. The blue dots you see on the waveforms are
                  our own detections on that exact record.
                </>
              ),
            },
          ]}
        />
      </div>
    </Card>
  );
}
