"use client";

import { motion } from "framer-motion";
import { usePerf } from "./perf";

export default function PerfToggle() {
  const { reduced, setReduced } = usePerf();
  return (
    <motion.button
      onClick={() => setReduced(!reduced)}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      title="Toggle heavy motion & 3D (performance / accessibility)"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-white/10 bg-panel/80 px-3.5 py-2 text-[11px] text-slate-300 shadow-lift backdrop-blur-xl transition hover:border-ecg/40 hover:text-white"
    >
      <span
        className="relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors"
        style={{ background: reduced ? "rgba(255,255,255,0.12)" : "rgba(61,220,132,0.35)" }}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className="absolute h-2.5 w-2.5 rounded-full bg-white"
          style={{ left: reduced ? 3 : 13 }}
        />
      </span>
      {reduced ? "Motion: reduced" : "Motion: full"}
    </motion.button>
  );
}
