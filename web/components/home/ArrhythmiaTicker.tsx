"use client";

import Link from "next/link";
import { Marquee } from "../ui";

/**
 * The five CinC-2015 alarm types and their official trigger criteria.
 * These are clinical definitions (not model output) — the real ECGs and live
 * verdicts for each live on the Explainer page.
 */
const TYPES = [
  { code: "ASYSTOLE", name: "Asystole", crit: "no QRS for ≥ 4 s", tone: "#ef4444" },
  { code: "BRADY", name: "Extreme bradycardia", crit: "HR < 40 bpm for 5 beats", tone: "#38bdf8" },
  { code: "TACHY", name: "Extreme tachycardia", crit: "HR > 140 bpm for 17 beats", tone: "#f59e0b" },
  { code: "VTACH", name: "Ventricular tachycardia", crit: "≥ 5 ventricular beats > 100 bpm", tone: "#a78bfa" },
  { code: "VFIB", name: "Ventricular flutter / fib", crit: "fibrillatory waveform ≥ 4 s", tone: "#fb7185" },
];

export default function ArrhythmiaTicker() {
  return (
    <Marquee duration={38} gap="0.75rem">
      {TYPES.map((t) => (
        <Link
          key={t.code}
          href="/explainer"
          className="group flex shrink-0 items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.06]"
        >
          <span
            className="h-8 w-1 rounded-full transition-all group-hover:h-10"
            style={{ background: t.tone, boxShadow: `0 0 14px -2px ${t.tone}` }}
          />
          <span>
            <span className="block text-[13px] font-semibold text-white">{t.name}</span>
            <span className="block text-[11px] text-muted">{t.crit}</span>
          </span>
          <span className="ml-2 rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted">
            {t.code}
          </span>
        </Link>
      ))}
    </Marquee>
  );
}
