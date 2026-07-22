"use client";

import { usePerf } from "./perf";

export default function PerfToggle() {
  const { reduced, setReduced } = usePerf();
  return (
    <button
      onClick={() => setReduced(!reduced)}
      title="Toggle heavy motion & 3D (performance / accessibility)"
      className="fixed bottom-4 right-4 z-50 rounded-full border border-hair bg-panel/80 px-3.5 py-2 text-[11px] text-slate-300 backdrop-blur transition hover:border-slate-500"
    >
      {reduced ? "◐ Motion: reduced" : "◉ Motion: full"}
    </button>
  );
}
