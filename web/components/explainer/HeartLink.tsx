"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { usePerf } from "../perf";
import { Card, cn } from "../ui";

/**
 * Links each ECG deflection to the part of the heart that produces it.
 *
 * Both drawings are labelled schematics, not patient data — the real recordings sit
 * directly below this on the page. Hovering (or focusing) either side highlights both,
 * because the point is that the squiggle and the anatomy are the same event.
 */

type Region = "sa" | "atria" | "av" | "ventricles" | null;

const SEGMENTS: Array<{
  id: Exclude<Region, null>;
  wave: string;
  name: string;
  what: string;
  breaks: string;
  color: string;
}> = [
  {
    id: "sa",
    wave: "baseline",
    name: "SA node fires",
    what: "The heart's own pacemaker, high in the right atrium, sets the rate. It produces no visible deflection — it is the silent instruction that starts every beat.",
    breaks: "If it slows or stops, the rate collapses: this is the mechanism behind a genuine bradycardia or asystole alarm.",
    color: "#3ddc84",
  },
  {
    id: "atria",
    wave: "P wave",
    name: "The atria contract",
    what: "The small bump before the spike. The upper chambers squeeze, topping up the ventricles with the last 20% of their filling volume.",
    breaks: "In fibrillation the P wave disappears into a quivering baseline — the atria are no longer contracting as a unit.",
    color: "#38bdf8",
  },
  {
    id: "av",
    wave: "PR segment",
    name: "The signal is delayed",
    what: "The flat stretch after the P wave. The AV node deliberately holds the impulse for a fraction of a second so the atria finish emptying before the ventricles fire.",
    breaks: "Block this delay and the chambers fight each other; lengthen it too far and beats get dropped entirely.",
    color: "#a78bfa",
  },
  {
    id: "ventricles",
    wave: "QRS complex",
    name: "The ventricles contract",
    what: "The tall spike — the beat you feel as a pulse and the landmark our detector locks onto. The ventricles eject blood to the lungs and the body.",
    breaks: "A run of wide, fast QRS complexes is ventricular tachycardia. Chaotic ones are fibrillation. No QRS at all for four seconds is asystole.",
    color: "#ef4444",
  },
];

export default function HeartLink() {
  const { reduced } = usePerf();
  const [hot, setHot] = useState<Region>(null);
  const active = SEGMENTS.find((s) => s.id === hot) ?? null;

  const dim = (id: Region) => (hot && hot !== id ? 0.25 : 1);

  return (
    <Card className="mb-6 overflow-hidden p-6">
      <div className="mb-5">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ecg/80">
          the squiggle is the anatomy
        </div>
        <h3 className="mt-1.5 text-lg font-semibold text-white">
          Every bump on an ECG is a part of the heart moving
        </h3>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted">
          Hover either drawing to link them. Both are labelled schematics — the real recordings
          are below.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,300px)_1fr]">
        {/* ------------------------------------------------------ anatomy */}
        <div>
          <svg viewBox="0 0 220 240" className="w-full" role="img" aria-label="Schematic heart">
            {/* ventricles */}
            <g
              onMouseEnter={() => setHot("ventricles")}
              onMouseLeave={() => setHot(null)}
              style={{ opacity: dim("ventricles"), cursor: "pointer", transition: "opacity .25s" }}
            >
              <path
                d="M40 110 Q36 200 110 228 Q184 200 180 110 Z"
                fill={hot === "ventricles" ? "rgba(239,68,68,0.22)" : "rgba(255,255,255,0.04)"}
                stroke={hot === "ventricles" ? "#ef4444" : "rgba(255,255,255,0.18)"}
                strokeWidth="2"
              />
              <line x1="110" y1="112" x2="110" y2="226" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />
              <text x="110" y="176" textAnchor="middle" fontSize="9" fill="#7d8794">
                ventricles
              </text>
            </g>

            {/* atria */}
            <g
              onMouseEnter={() => setHot("atria")}
              onMouseLeave={() => setHot(null)}
              style={{ opacity: dim("atria"), cursor: "pointer", transition: "opacity .25s" }}
            >
              <path
                d="M40 108 Q30 42 78 40 Q110 38 110 74 Q110 38 142 40 Q190 42 180 108 Z"
                fill={hot === "atria" ? "rgba(56,189,248,0.22)" : "rgba(255,255,255,0.045)"}
                stroke={hot === "atria" ? "#38bdf8" : "rgba(255,255,255,0.18)"}
                strokeWidth="2"
              />
              <text x="110" y="70" textAnchor="middle" fontSize="9" fill="#7d8794">
                atria
              </text>
            </g>

            {/* conduction path */}
            <g
              onMouseEnter={() => setHot("av")}
              onMouseLeave={() => setHot(null)}
              style={{ opacity: dim("av"), cursor: "pointer", transition: "opacity .25s" }}
            >
              <path
                d="M150 60 Q120 90 110 112 L110 150 M110 150 Q86 176 66 190 M110 150 Q134 176 154 190"
                fill="none"
                stroke={hot === "av" ? "#a78bfa" : "rgba(167,139,250,0.35)"}
                strokeWidth="2"
                strokeDasharray="3 3"
              />
              <circle cx="110" cy="112" r="5" fill={hot === "av" ? "#a78bfa" : "rgba(167,139,250,0.5)"} />
              <text x="122" y="130" fontSize="8" fill="#7d8794">
                AV node
              </text>
            </g>

            {/* SA node */}
            <g
              onMouseEnter={() => setHot("sa")}
              onMouseLeave={() => setHot(null)}
              style={{ opacity: dim("sa"), cursor: "pointer", transition: "opacity .25s" }}
            >
              <circle
                cx="150"
                cy="60"
                r={hot === "sa" ? 8 : 6}
                fill={hot === "sa" ? "#3ddc84" : "rgba(61,220,132,0.55)"}
                style={{ transition: "r .2s" }}
              />
              {!reduced && (
                <circle cx="150" cy="60" r="6" fill="none" stroke="#3ddc84" strokeWidth="1.5">
                  <animate attributeName="r" values="6;16;6" dur="2.2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.7;0;0.7" dur="2.2s" repeatCount="indefinite" />
                </circle>
              )}
              <text x="162" y="52" fontSize="8" fill="#7d8794">
                SA node
              </text>
            </g>
          </svg>
          <div className="mt-1 text-center font-mono text-[10px] uppercase tracking-wider text-muted">
            schematic — not patient data
          </div>
        </div>

        {/* --------------------------------------------------------- ECG */}
        <div>
          <svg viewBox="0 0 420 130" className="w-full" role="img" aria-label="Schematic ECG beat">
            {/* the trace */}
            <path
              d="M10 80 L70 80 Q86 58 102 80 L150 80 L150 80 L176 80 L188 96 L204 24 L220 104 L238 80 L290 80 Q312 46 334 80 L410 80"
              fill="none"
              stroke="rgba(255,255,255,0.28)"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* highlighted overlays, one per segment */}
            {[
              { id: "sa", d: "M10 80 L70 80", c: "#3ddc84" },
              { id: "atria", d: "M70 80 Q86 58 102 80", c: "#38bdf8" },
              { id: "av", d: "M102 80 L176 80", c: "#a78bfa" },
              { id: "ventricles", d: "M176 80 L188 96 L204 24 L220 104 L238 80", c: "#ef4444" },
            ].map((seg) => (
              <path
                key={seg.id}
                d={seg.d}
                fill="none"
                stroke={seg.c}
                strokeWidth={hot === seg.id ? 4 : 2.4}
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{
                  opacity: hot === seg.id ? 1 : hot ? 0.15 : 0.72,
                  transition: "opacity .25s, stroke-width .2s",
                  filter: hot === seg.id ? `drop-shadow(0 0 6px ${seg.c})` : undefined,
                }}
              />
            ))}
            <text x="86" y="50" textAnchor="middle" fontSize="9" fill="#7d8794">P</text>
            <text x="204" y="18" textAnchor="middle" fontSize="9" fill="#7d8794">R</text>
            <text x="312" y="40" textAnchor="middle" fontSize="9" fill="#7d8794">T</text>
          </svg>

          {/* segment buttons */}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SEGMENTS.map((s) => (
              <button
                key={s.id}
                onMouseEnter={() => setHot(s.id)}
                onMouseLeave={() => setHot(null)}
                onFocus={() => setHot(s.id)}
                onBlur={() => setHot(null)}
                className={cn(
                  "rounded-lg border p-2 text-left transition",
                  hot === s.id
                    ? "border-white/25 bg-white/[0.07]"
                    : "border-white/[0.07] bg-white/[0.02] hover:border-white/20"
                )}
              >
                <span className="block h-1 w-6 rounded-full" style={{ background: s.color }} />
                <span className="mt-1.5 block font-mono text-[11px] text-slate-200">{s.wave}</span>
              </button>
            ))}
          </div>

          {/* explanation */}
          <motion.div
            key={active?.id ?? "none"}
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-4 min-h-[112px] rounded-xl border border-white/[0.08] bg-black/25 p-4"
          >
            {active ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-1 rounded-full" style={{ background: active.color }} />
                  <span className="text-[13px] font-semibold text-white">{active.name}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                    {active.wave}
                  </span>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-slate-300">{active.what}</p>
                <p className="mt-2 text-[12px] leading-relaxed text-amber-300/80">
                  {active.breaks}
                </p>
              </>
            ) : (
              <p className="text-[12.5px] leading-relaxed text-muted">
                Hover a wave or a chamber. Each of the five alarms below is one of these steps going
                wrong — which is why reading the waveform, rather than trusting a threshold, is the
                whole idea.
              </p>
            )}
          </motion.div>
        </div>
      </div>
    </Card>
  );
}
