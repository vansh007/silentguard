"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import { usePerf } from "./perf";

const ParticleHeart = dynamic(() => import("./three/ParticleHeart"), {
  ssr: false,
  loading: () => <HeartGlowFallback />,
});

function HeartGlowFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-52 w-52 animate-pulse-soft rounded-full bg-ecg/20 blur-3xl" />
    </div>
  );
}

/** A looping, self-drawing ECG line built from a P-QRS-T template. */
function ECGLine() {
  const { reduced } = usePerf();
  const beats = 6;
  const w = 1200;
  const h = 120;
  const mid = h / 2;
  const bw = w / beats;
  let d = `M0 ${mid}`;
  for (let b = 0; b < beats; b++) {
    const x = b * bw;
    d += ` L${x + bw * 0.15} ${mid}`;
    d += ` q${bw * 0.04} -10 ${bw * 0.08} 0`; // P
    d += ` L${x + bw * 0.32} ${mid}`;
    d += ` L${x + bw * 0.36} ${mid + 12}`; // Q
    d += ` L${x + bw * 0.4} ${mid - 42}`; // R
    d += ` L${x + bw * 0.44} ${mid + 18}`; // S
    d += ` L${x + bw * 0.5} ${mid}`;
    d += ` q${bw * 0.06} -16 ${bw * 0.12} 0`; // T
    d += ` L${x + bw} ${mid}`;
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height: 110 }}>
      <defs>
        <linearGradient id="ecgfade" x1="0" x2="1">
          <stop offset="0" stopColor="#3ddc84" stopOpacity="0" />
          <stop offset="0.5" stopColor="#3ddc84" stopOpacity="0.9" />
          <stop offset="1" stopColor="#3ddc84" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={d}
        fill="none"
        stroke="url(#ecgfade)"
        strokeWidth={2}
        strokeLinejoin="round"
        initial={reduced ? false : { pathLength: 0 }}
        animate={reduced ? {} : { pathLength: [0, 1] }}
        transition={reduced ? undefined : { duration: 4, ease: "linear", repeat: Infinity }}
      />
    </svg>
  );
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.14, delayChildren: 0.2 } },
};
const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

export default function Hero() {
  const { reduced } = usePerf();
  return (
    <section className="relative flex min-h-[88vh] flex-col justify-center overflow-hidden">
      {/* particle heart */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute left-1/2 top-[42%] h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2">
          <ParticleHeart bpm={72} reduced={reduced} />
        </div>
        {/* radial scrim for legibility + depth */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 55% at 50% 42%, transparent 30%, rgba(5,7,10,0.55) 65%, #05070a 100%)",
          }}
        />
      </div>

      {/* content */}
      <motion.div
        variants={reduced ? undefined : container}
        initial={reduced ? undefined : "hidden"}
        animate={reduced ? undefined : "show"}
        className="relative z-10 mx-auto w-full max-w-5xl px-5 text-center"
      >
        <motion.p variants={item} className="mb-4 text-[12px] uppercase tracking-[0.25em] text-ecg/80">
          ICU false-alarm intelligence
        </motion.p>
        <motion.h1 variants={item} className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl">
          Every ICU heartbeat
          <br />
          tells a story.
        </motion.h1>
        <motion.p variants={item} className="mt-4 text-2xl font-medium text-muted sm:text-3xl">
          Not every alarm tells the truth.
        </motion.p>
        <motion.p variants={item} className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-slate-300">
          Most ICU arrhythmia alarms are false. SilentGuard reads the waveform behind each one and
          decides — in real time — <span className="text-suppress">suppress</span>,{" "}
          <span className="text-keep">keep</span>, or <span className="text-defer">defer</span>,
          without ever silencing a real emergency.
        </motion.p>
        <motion.div variants={item} className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/monitor"
            className="rounded-lg bg-ecg px-6 py-3 text-sm font-semibold text-[#04140c] shadow-[0_0_30px_-6px_#3ddc84] transition hover:brightness-110"
          >
            ▶ Try the live monitor
          </Link>
          <Link
            href="/explainer"
            className="rounded-lg border border-hair bg-white/[0.02] px-6 py-3 text-sm text-slate-200 backdrop-blur transition hover:border-slate-500"
          >
            Learn the alarms
          </Link>
        </motion.div>
      </motion.div>

      {/* ecg line at the bottom */}
      <div className="pointer-events-none absolute bottom-6 left-0 right-0 z-10 opacity-70">
        <ECGLine />
      </div>
    </section>
  );
}
