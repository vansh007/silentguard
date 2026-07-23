"use client";

import { motion } from "framer-motion";
import { usePerf } from "../perf";

/**
 * Radial confidence gauge. `value` is 0..1 — always a real engine number;
 * pass `label` for the centre text.
 */
export default function Gauge({
  value,
  color = "#3ddc84",
  size = 116,
  stroke = 9,
  label,
  sub,
}: {
  value: number;
  color?: string;
  size?: number;
  stroke?: number;
  label?: string;
  sub?: string;
}) {
  const { reduced } = usePerf();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  // leave a 60° gap at the bottom so it reads as a gauge, not a pie
  const arc = 0.833;
  const dash = c * arc;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-[195deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          initial={reduced ? false : { strokeDashoffset: dash }}
          animate={{ strokeDashoffset: dash * (1 - pct) }}
          transition={{ duration: reduced ? 0 : 1, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-bold tabular-nums text-white">
          {label ?? `${Math.round(pct * 100)}%`}
        </div>
        {sub && <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted">{sub}</div>}
      </div>
    </div>
  );
}
