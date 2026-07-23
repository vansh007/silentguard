"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { fetchResults, figureUrl, ResultsData } from "@/lib/api";
import { usePerf } from "./perf";
import {
  Accordion,
  Badge,
  Card,
  Dialog,
  SectionHeading,
  Skeleton,
  SpotlightCard,
  Tabs,
  cn,
} from "./ui";

const FIG_CAPTIONS: Record<string, { title: string; caption: string }> = {
  "fig2_loao.png": {
    title: "Generalization to unseen arrhythmias (headline)",
    caption:
      "Challenge score when each arrhythmia type is held out of training entirely and tested zero-shot. Every type falls far below in-distribution; tachycardia is worst — the model never learns that high-rate alarms are usually real. This is the honest deployability limit.",
  },
  "fig3_safety.png": {
    title: "Safety trade-off",
    caption:
      "False-alarm suppression vs. true-alarm sensitivity as the suppress threshold is swept. At the ≥99% sensitivity floor (dashed) the ensemble sits well above the RandomForest — suppressing far more false alarms at the same safety guarantee.",
  },
  "fig1_roc.png": {
    title: "In-distribution ROC",
    caption:
      "RandomForest vs. 1-D CNN vs. the RF+CNN ensemble (leak-free 5-fold CV). The ensemble has the highest AUROC — fusing hand-crafted features with the raw-waveform CNN ranks true vs. false alarms best.",
  },
  "fig4_calibration.png": {
    title: "Calibration (reliability)",
    caption:
      "The ensemble's predicted probability vs. the empirical fraction of true alarms. Reasonably calibrated (ECE ≈ 0.09), so the confidence shown to a nurse means what it says.",
  },
  "fig5_explanation.png": {
    title: "Example explanation",
    caption:
      "A correctly-suppressed false VTACH alarm: its ECG and the top SHAP reasons. Low rhythm variability drives the suppression — the rhythm is too regular to be real ventricular tachycardia.",
  },
};
const FIG_ORDER = [
  "fig2_loao.png",
  "fig3_safety.png",
  "fig1_roc.png",
  "fig4_calibration.png",
  "fig5_explanation.png",
];

const pct = (s?: string) => (s == null ? "—" : `${Math.round(parseFloat(s) * 100)}%`);
const f3 = (s?: string) => (s == null ? "—" : parseFloat(s).toFixed(3));

const TABLES = [
  { id: "indist", label: "In-distribution" },
  { id: "safety", label: "Safety operating point" },
  { id: "loao", label: "Unseen arrhythmias" },
];

export default function Results() {
  const { reduced } = usePerf();
  const [d, setD] = useState<ResultsData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState("indist");
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    fetchResults()
      .then(setD)
      .catch((e) => setErr(String(e)));
  }, []);

  if (err)
    return (
      <Card className="border-suppress/30 bg-suppress/[0.06] p-5 text-[13px] leading-relaxed text-suppress">
        Engine unreachable — every number on this page is read from the model&apos;s result files, so
        nothing is shown rather than guessed.
        <code className="mt-2 block rounded bg-black/40 px-2 py-1.5 text-[12px] text-slate-300">
          .venv/bin/uvicorn service.main:app --port 8000
        </code>
      </Card>
    );

  if (!d)
    return (
      <div className="space-y-4">
        <Skeleton className="h-11 w-full max-w-md rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );

  if (!d.available)
    return (
      <Card className="p-5 text-[13px] leading-relaxed text-muted">
        Result files not found. Regenerate them with
        <code className="mt-2 block rounded bg-black/40 px-2 py-1.5 text-[12px] text-slate-300">
          .venv/bin/python scripts/05_freeze_ensemble.py &amp;&amp; .venv/bin/python
          scripts/make_figures.py
        </code>
      </Card>
    );

  const ens = d.summary.find((r) => r.model.includes("ensemble"));
  const loaoEns = d.loao.filter((r) => r.model === "RF+CNN ensemble");
  const pooled = loaoEns.find((r) => r.held_out?.includes("POOLED"));

  const KPIS = [
    { v: f3(ens?.indist_score), l: "in-distribution score", s: "5-fold CV, leak-free", c: "#3ddc84" },
    { v: f3(ens?.indist_auroc), l: "AUROC", s: "ranking quality", c: "#38bdf8" },
    { v: f3(pooled?.challenge_score), l: "unseen-arrhythmia score", s: "the honest gap", c: "#f59e0b" },
    { v: pct(ens?.safety_fa_suppression), l: "false alarms silenced", s: "at ≥99% sensitivity", c: "#ef4444" },
  ];

  const TABLE_PROPS = {
    indist: {
      head: ["Model", "Challenge score", "AUROC", "True-alarm sensitivity"],
      rows: d.summary.map((r) => [r.model, f3(r.indist_score), f3(r.indist_auroc), f3(r.indist_sens)]),
      note: "Leak-free 5-fold cross-validation on 750 public CinC-2015 records. Identical protocol for every row — each model's threshold is chosen on a validation split held out from the fold being scored.",
      highlight: "ensemble",
    },
    safety: {
      head: ["Model", "True-alarm sens.", "False alarms silenced", "Defer rate"],
      rows: d.summary.map((r) => [
        r.model,
        f3(r.safety_true_sens),
        pct(r.safety_fa_suppression),
        pct(r.safety_defer_rate),
      ]),
      note: "With a ≥99% true-alarm sensitivity floor enforced: how many false alarms get silenced, and how many alarms are handed to a human instead. The ensemble suppresses far more at the same safety guarantee.",
      highlight: "ensemble",
    },
    loao: {
      head: ["Held-out type", "Challenge score", "True-alarm sens.", "AUROC"],
      rows: loaoEns.map((r) => [
        r.held_out,
        f3(r.challenge_score),
        f3(r.true_sensitivity),
        f3(r.auroc),
      ]),
      note: "Train on four arrhythmia types, test zero-shot on the fifth. The gap against in-distribution is our headline deployability result — and it is large.",
      highlight: "POOLED",
    },
  }[tab]!;

  return (
    <div className="space-y-14">
      {/* ------------------------------------------------------ KPI strip */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {KPIS.map((k, i) => (
          <motion.div
            key={k.l}
            initial={reduced ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: i * 0.07 }}
          >
            <SpotlightCard className="h-full p-5">
              <div
                className="absolute inset-x-0 top-0 h-px"
                style={{ background: `linear-gradient(90deg, transparent, ${k.c}, transparent)` }}
              />
              <div className="text-2xl font-bold tabular-nums text-white sm:text-3xl">{k.v}</div>
              <div className="mt-1 text-[12px] text-slate-300">{k.l}</div>
              <div className="mt-0.5 text-[10px] text-muted">{k.s}</div>
            </SpotlightCard>
          </motion.div>
        ))}
      </section>

      {/* --------------------------------------------------------- tables */}
      <section>
        <SectionHeading
          eyebrow="the numbers"
          title="Measured performance"
          sub="Three views of the same frozen engine. Switch between them — every value is parsed straight from the result CSVs the training scripts wrote."
        />
        <Tabs items={TABLES} active={tab} onChange={setTab} className="mb-4" />
        <p className="mb-4 max-w-3xl text-[12.5px] leading-relaxed text-muted">
          {TABLE_PROPS.note}
        </p>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? {} : { opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <Table head={TABLE_PROPS.head} rows={TABLE_PROPS.rows} highlight={TABLE_PROPS.highlight} />
          </motion.div>
        </AnimatePresence>
      </section>

      {/* -------------------------------------------------------- figures */}
      <section>
        <SectionHeading
          eyebrow="evidence"
          title="Figures"
          sub="Generated by scripts/make_figures.py from the same result files — click any figure to enlarge it."
        />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {FIG_ORDER.filter((f) => d.figures.includes(f)).map((f, i) => (
            <motion.figure
              key={f}
              initial={reduced ? false : { opacity: 0, y: 22 }}
              whileInView={reduced ? {} : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: (i % 2) * 0.08 }}
              className={cn(i === 0 && "lg:col-span-2")}
            >
              <SpotlightCard className="h-full p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-[13px] font-semibold text-white">{FIG_CAPTIONS[f].title}</div>
                  {i === 0 && <Badge tone="ecg">headline</Badge>}
                </div>
                <button
                  onClick={() => setZoom(f)}
                  className="block w-full overflow-hidden rounded-xl bg-white/[0.03] transition hover:ring-1 hover:ring-ecg/30"
                  title="Click to enlarge"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={figureUrl(f)}
                    alt={FIG_CAPTIONS[f].title}
                    className="w-full"
                    loading="lazy"
                  />
                </button>
                <figcaption className="mt-3 text-[12px] leading-relaxed text-muted">
                  {FIG_CAPTIONS[f].caption}
                </figcaption>
              </SpotlightCard>
            </motion.figure>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------- limitations */}
      <section>
        <SectionHeading
          eyebrow="honesty layer"
          title="What this does not show"
          sub="The limits matter as much as the numbers. None of these are hidden in a footnote."
        />
        <Accordion
          defaultOpen="l1"
          items={[
            {
              id: "l1",
              tone: "#f59e0b",
              title: "Single dataset — no measured cross-hospital performance",
              body: "Everything is CinC-2015. Leave-one-source-out is impossible here because the record headers carry no hospital or monitor-manufacturer tags, so we do not claim it. Cross-hospital validation and few-shot local calibration are future work pending a second, source-tagged dataset — our unseen-arrhythmia result is the proxy argument, not a substitute.",
            },
            {
              id: "l2",
              tone: "#38bdf8",
              title: "The official test set was never released",
              body: "The challenge's 500-record test set is hidden, so no leaderboard number here is reproducible. Every figure is 5-fold cross-validation, or a held-out arrhythmia, on the 750 public training records — and we say so everywhere a number appears.",
            },
            {
              id: "l3",
              tone: "#ef4444",
              title: "Generalization to unseen arrhythmias is genuinely poor",
              body: "Held-out tachycardia is the worst case, with AUROC below chance — a model that never saw tachycardia actively mis-ranks tachycardia alarms. The practical reading: a suppression filter is only safe on rhythm types represented in its training data. Publishing that is the point of the experiment.",
            },
            {
              id: "l4",
              tone: "#a78bfa",
              title: "A large share of alarms are still deferred",
              body: "At the ≥99% sensitivity floor the ensemble hands many alarms back to a human rather than deciding. That is the safe behaviour, but higher auto-decision coverage needs a stronger model or more data — the ensemble already cut the defer rate substantially versus the RandomForest alone.",
            },
            {
              id: "l5",
              tone: "#7d8794",
              title: "Research prototype, not a medical device",
              body: "Nothing here is cleared, certified, or validated for clinical use. It is a course research project built on de-identified public data, and it should be read as evidence about a method — not as a product you could put beside a patient.",
            },
          ]}
        />
      </section>

      <Dialog open={zoom != null} onClose={() => setZoom(null)} title={zoom ? FIG_CAPTIONS[zoom].title : ""}>
        {zoom && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={figureUrl(zoom)} alt={FIG_CAPTIONS[zoom].title} className="w-full rounded-xl" />
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              {FIG_CAPTIONS[zoom].caption}
            </p>
          </>
        )}
      </Dialog>
    </div>
  );
}

/* ---------------------------------------------------------------- table */

function Table({
  head,
  rows,
  highlight,
}: {
  head: string[];
  rows: string[][];
  highlight?: string;
}) {
  const { reduced } = usePerf();
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.02]">
      <table className="w-full min-w-[540px] border-collapse text-[13px]">
        <thead>
          <tr className="bg-white/[0.03] text-left text-[11px] uppercase tracking-wider text-muted">
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const hot = highlight && r[0]?.includes(highlight);
            return (
              <motion.tr
                key={i}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className={cn(
                  "border-t border-white/[0.06] transition-colors",
                  hot ? "bg-ecg/[0.07]" : "hover:bg-white/[0.03]"
                )}
              >
                {r.map((c, j) => (
                  <td
                    key={j}
                    className={cn(
                      "px-4 py-3",
                      j === 0
                        ? hot
                          ? "font-semibold text-ecg"
                          : "text-slate-200"
                        : "tabular-nums text-slate-300"
                    )}
                  >
                    {c}
                  </td>
                ))}
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
