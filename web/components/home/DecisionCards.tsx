"use client";

import { motion } from "framer-motion";
import { usePerf } from "../perf";
import { SpotlightCard } from "../ui";

const DECISIONS = [
  {
    label: "SUPPRESS",
    color: "#ef4444",
    rgb: "239,68,68",
    icon: "🔇",
    head: "Confident false alarm",
    body: "Noise, a lead that fell off, a motion artifact. Silenced before it ever reaches the ward — so it never adds to fatigue.",
    foot: "only when the engine is sure",
  },
  {
    label: "KEEP",
    color: "#22c55e",
    rgb: "34,197,94",
    icon: "🔔",
    head: "Likely a real emergency",
    body: "The alarm sounds exactly as it normally would and reaches the nurse immediately. The default whenever there is any doubt.",
    foot: "the safe default",
  },
  {
    label: "DEFER",
    color: "#f59e0b",
    rgb: "245,158,11",
    icon: "🤔",
    head: "Genuinely ambiguous",
    body: "Routed to a human instead of guessed. Under a heavy nurse-to-patient ratio this is the honest answer — and the engine says how long it waited.",
    foot: "abstention is a feature",
  },
];

export default function DecisionCards() {
  const { reduced } = usePerf();
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {DECISIONS.map((d, i) => (
        <motion.div
          key={d.label}
          initial={reduced ? false : { opacity: 0, y: 24 }}
          whileInView={reduced ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-70px" }}
          transition={{ duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <SpotlightCard glow={d.rgb} className="h-full overflow-hidden p-6">
            {/* top accent */}
            <div
              className="absolute inset-x-0 top-0 h-[2px]"
              style={{ background: `linear-gradient(90deg, transparent, ${d.color}, transparent)` }}
            />
            <div
              className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-20 blur-2xl transition-opacity duration-500 group-hover:opacity-40"
              style={{ background: d.color }}
            />
            <div className="flex items-center justify-between">
              <span
                className="text-lg font-bold tracking-tight"
                style={{ color: d.color, textShadow: `0 0 24px ${d.color}55` }}
              >
                {d.label}
              </span>
              <span className="text-xl opacity-70 transition-transform duration-300 group-hover:scale-110">
                {d.icon}
              </span>
            </div>
            <div className="mt-3 text-[13px] font-medium text-white">{d.head}</div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-300">{d.body}</p>
            <div className="mt-4 border-t border-white/[0.07] pt-3 text-[11px] uppercase tracking-wider text-muted">
              {d.foot}
            </div>
          </SpotlightCard>
        </motion.div>
      ))}
    </div>
  );
}
