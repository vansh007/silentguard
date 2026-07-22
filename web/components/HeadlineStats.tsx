"use client";

import { useEffect, useState } from "react";
import { fetchResults } from "@/lib/api";
import { CountUp } from "./motion";

interface Stat {
  node: React.ReactNode;
  label: string;
  sub: string;
}

export default function HeadlineStats() {
  const [stats, setStats] = useState<Stat[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetchResults()
      .then((d) => {
        const ens = d.summary.find((r) => r.model.includes("ensemble"));
        if (!ens) return setErr(true);
        setStats([
          {
            node: <CountUp to={parseFloat(ens.indist_auroc)} decimals={3} />,
            label: "AUROC",
            sub: "in-distribution, 5-fold CV",
          },
          {
            node: <CountUp to={parseFloat(ens.safety_fa_suppression) * 100} suffix="%" />,
            label: "false alarms silenced",
            sub: "at the ≥99% safety floor",
          },
          { node: "≥99%", label: "true-alarm sensitivity", sub: "never miss a real emergency" },
        ]);
      })
      .catch(() => setErr(true));
  }, []);

  if (err)
    return (
      <div className="rounded-xl border border-hair bg-panel/50 p-4 text-xs text-muted">
        Live metrics unavailable — start the engine (
        <code>.venv/bin/uvicorn service.main:app --port 8000</code>). See{" "}
        <a className="text-ecg underline" href="/results">Results</a>.
      </div>
    );

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {(stats ?? Array(3).fill(null)).map((s, i) => (
        <div
          key={i}
          className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur transition hover:border-ecg/30"
        >
          <div className="text-3xl font-bold text-white">{s ? s.node : "…"}</div>
          <div className="mt-1 text-[13px] text-slate-300">{s?.label ?? " "}</div>
          <div className="mt-0.5 text-[11px] text-muted">{s?.sub ?? " "}</div>
        </div>
      ))}
    </div>
  );
}
