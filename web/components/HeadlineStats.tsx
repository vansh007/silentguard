"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { fetchResults } from "@/lib/api";
import { CountUp } from "./motion";
import { usePerf } from "./perf";
import { Card, Skeleton, StatTile } from "./ui";

interface Stat {
  node: React.ReactNode;
  label: string;
  sub: string;
  tone: string;
}

/** Live headline metrics — read from the engine's own results files, never hardcoded. */
export default function HeadlineStats() {
  const { reduced } = usePerf();
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
            sub: "in-distribution, leak-free 5-fold CV",
            tone: "#3ddc84",
          },
          {
            node: <CountUp to={parseFloat(ens.safety_fa_suppression) * 100} suffix="%" />,
            label: "false alarms silenced",
            sub: "at the ≥99% true-alarm safety floor",
            tone: "#ef4444",
          },
          {
            node: <CountUp to={parseFloat(ens.safety_true_sens) * 100} decimals={1} suffix="%" />,
            label: "true-alarm sensitivity",
            sub: "the floor we never trade away",
            tone: "#22c55e",
          },
          {
            node: <CountUp to={parseFloat(ens.indist_score)} decimals={3} />,
            label: "challenge score",
            sub: "(TP+TN)/(TP+TN+FP+5·FN)",
            tone: "#f59e0b",
          },
        ]);
      })
      .catch(() => setErr(true));
  }, []);

  if (err)
    return (
      <Card className="p-5 text-[12px] leading-relaxed text-muted">
        <span className="text-amber-300/90">Live metrics unavailable.</span> These numbers are read
        from the running engine rather than hardcoded — start it with{" "}
        <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-slate-300">
          .venv/bin/uvicorn service.main:app --port 8000
        </code>
        , or see the{" "}
        <a className="text-ecg underline underline-offset-2" href="/results">
          Results
        </a>{" "}
        page.
      </Card>
    );

  if (!stats)
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="mt-3 h-3 w-32" />
            <Skeleton className="mt-2 h-2.5 w-40" />
          </Card>
        ))}
      </div>
    );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={reduced ? false : { opacity: 0, y: 20 }}
          whileInView={reduced ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          <StatTile value={s.node} label={s.label} sub={s.sub} tone={s.tone} />
        </motion.div>
      ))}
    </div>
  );
}
