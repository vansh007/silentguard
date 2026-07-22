"use client";

import { useEffect, useState } from "react";
import { fetchResults, figureUrl, ResultsData } from "@/lib/api";

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
const FIG_ORDER = ["fig2_loao.png", "fig3_safety.png", "fig1_roc.png", "fig4_calibration.png", "fig5_explanation.png"];

const pct = (s?: string) => (s == null ? "—" : `${Math.round(parseFloat(s) * 100)}%`);
const f3 = (s?: string) => (s == null ? "—" : parseFloat(s).toFixed(3));

export default function Results() {
  const [d, setD] = useState<ResultsData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetchResults().then(setD).catch((e) => setErr(String(e)));
  }, []);

  if (err)
    return (
      <div className="rounded-xl border border-suppress/40 bg-suppress/10 p-4 text-sm text-suppress">
        Engine unreachable: {err}. Start it with <code>.venv/bin/uvicorn service.main:app --port 8000</code>.
      </div>
    );
  if (!d) return <div className="text-sm text-muted">loading real results…</div>;
  if (!d.available)
    return (
      <div className="rounded-xl border border-hair bg-panel/50 p-4 text-sm text-muted">
        Results files not found. Regenerate with{" "}
        <code>.venv/bin/python scripts/make_figures.py</code>.
      </div>
    );

  const ens = (m: string) => d.summary.find((r) => r.model === m);
  const loaoEns = d.loao.filter((r) => r.model === "RF+CNN ensemble");

  return (
    <div className="space-y-10">
      {/* Table 1: in-distribution */}
      <section>
        <h2 className="mb-1 text-base font-semibold text-white">In-distribution performance</h2>
        <p className="mb-3 text-[12px] text-muted">
          Leak-free 5-fold cross-validation on 750 public CinC-2015 records. Same protocol for every
          row.
        </p>
        <Table
          head={["Model", "Challenge score", "AUROC", "True-alarm sensitivity"]}
          rows={d.summary.map((r) => [
            r.model,
            f3(r.indist_score),
            f3(r.indist_auroc),
            f3(r.indist_sens),
          ])}
          highlight="RF+CNN ensemble"
        />
      </section>

      {/* Table 3: safety */}
      <section>
        <h2 className="mb-1 text-base font-semibold text-white">Safety operating point (≥99% floor)</h2>
        <p className="mb-3 text-[12px] text-muted">
          At a ≥99% true-alarm sensitivity floor, how many false alarms are silenced and how many
          deferred. The ensemble suppresses far more at the same safety guarantee.
        </p>
        <Table
          head={["Model", "True-alarm sens.", "False alarms silenced", "Defer rate"]}
          rows={d.summary.map((r) => [
            r.model,
            f3(r.safety_true_sens),
            pct(r.safety_fa_suppression),
            pct(r.safety_defer_rate),
          ])}
          highlight="RF+CNN ensemble"
        />
      </section>

      {/* Table 2: LOAO */}
      <section>
        <h2 className="mb-1 text-base font-semibold text-white">
          Leave-One-Arrhythmia-Out generalization (ensemble)
        </h2>
        <p className="mb-3 text-[12px] text-muted">
          Train on four types, test zero-shot on the held-out fifth. The gap vs. in-distribution is
          the honest deployability result.
        </p>
        <Table
          head={["Held-out type", "Challenge score", "True-alarm sens.", "AUROC"]}
          rows={loaoEns.map((r) => [
            r.held_out,
            f3(r.challenge_score),
            f3(r.true_sensitivity),
            f3(r.auroc),
          ])}
          highlight="POOLED"
          highlightKey={0}
        />
      </section>

      {/* Figures */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-white">Figures</h2>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {FIG_ORDER.filter((f) => d.figures.includes(f)).map((f) => (
            <figure key={f} className="rounded-xl border border-hair bg-panel/60 p-4">
              <div className="mb-2 text-[13px] font-semibold text-white">{FIG_CAPTIONS[f].title}</div>
              <div className="overflow-hidden rounded-lg bg-white/[0.02]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={figureUrl(f)} alt={FIG_CAPTIONS[f].title} className="w-full" loading="lazy" />
              </div>
              <figcaption className="mt-2 text-[12px] leading-relaxed text-muted">
                {FIG_CAPTIONS[f].caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Honest limitations */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-white">Honest limitations</h2>
        <ul className="space-y-2 text-[13px] leading-relaxed text-slate-300">
          {[
            "Single dataset (CinC-2015). No measured cross-hospital or Indian performance; leave-one-source-out isn't possible (headers carry no monitor/manufacturer tags) and few-shot local calibration are future work.",
            "The official 500-record test set is unreleased — all numbers are 5-fold cross-validation / held-out-arrhythmia on the 750 public records.",
            "Generalization to unseen arrhythmias is genuinely poor (tachycardia worst) — a filter is only safe on rhythms represented in its training data.",
            "Even the ensemble defers a large share of alarms at the 99% safety floor; higher auto-decision coverage needs a stronger model or more data.",
            "Research prototype — NOT a cleared medical device.",
          ].map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-amber-400/70">•</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Table({
  head,
  rows,
  highlight,
  highlightKey = 0,
}: {
  head: string[];
  rows: string[][];
  highlight?: string;
  highlightKey?: number;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-hair">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-white/[0.03] text-left text-muted">
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const hot = highlight && r[highlightKey]?.includes(highlight);
            return (
              <tr key={i} className={`border-t border-hair ${hot ? "bg-ecg/[0.06]" : ""}`}>
                {r.map((c, j) => (
                  <td key={j} className={`px-4 py-2.5 ${j === 0 ? (hot ? "font-semibold text-ecg" : "text-slate-200") : "text-slate-300"}`}>
                    {c}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
