"use client";

import { useEffect, useState } from "react";
import {
  DECISION_META,
  ExplainerCard,
  fetchExplainer,
  fetchWaveform,
  WaveformData,
} from "@/lib/api";
import ECGCanvas from "./ECGCanvas";

export default function Explainer() {
  const [cards, setCards] = useState<ExplainerCard[] | null>(null);
  const [waves, setWaves] = useState<Record<string, WaveformData>>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchExplainer()
      .then((cs) => {
        setCards(cs);
        cs.forEach((c) =>
          fetchWaveform(c.record, 8)
            .then((w) => setWaves((prev) => ({ ...prev, [c.record]: w })))
            .catch(() => {})
        );
      })
      .catch((e) => setErr(String(e)));
  }, []);

  if (err)
    return (
      <div className="rounded-xl border border-suppress/40 bg-suppress/10 p-4 text-sm text-suppress">
        Engine unreachable: {err}. Start it with{" "}
        <code>.venv/bin/uvicorn service.main:app --port 8000</code>.
      </div>
    );

  return (
    <div className="space-y-5">
      {(cards ?? []).map((c) => {
        const w = waves[c.record];
        const d = c.decision ? DECISION_META[c.decision] : null;
        return (
          <div key={c.type} className="rounded-xl border border-hair bg-panel/60 p-5">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.1fr]">
              {/* text */}
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-white">{c.name}</h3>
                  <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-muted">
                    {c.type}
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{c.clinical}</p>
                <div className="mt-3 rounded-lg border border-hair bg-ink/40 px-3 py-2 text-[12px] text-slate-300">
                  <span className="text-muted">Alarm criterion:</span> {c.criterion}
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-muted">
                  <span className="text-slate-300">When it's false:</span> {c.false_hint}
                </p>
              </div>

              {/* real ECG + verdict */}
              <div>
                <div className="mb-2 flex items-center justify-between text-[11px] text-muted">
                  <span>
                    real record <b className="text-slate-300">{c.record}</b>
                    {w?.channel ? ` · lead ${w.channel}` : ""}
                  </span>
                  <span>{w ? `${w.beats.length} beats · 8s` : "loading ECG…"}</span>
                </div>
                <div className="overflow-hidden rounded-lg border border-hair" style={{ background: "#04140c" }}>
                  {w ? (
                    <ECGCanvas samples={w.samples} beats={w.beats} height={128} />
                  ) : (
                    <div className="flex h-[128px] items-center justify-center text-xs text-muted">
                      loading…
                    </div>
                  )}
                </div>
                {d && (
                  <div className="mt-3 flex items-center gap-3">
                    <span className="rounded px-2 py-1 text-xs font-semibold" style={{ background: `${d.color}22`, color: d.color }}>
                      engine: {d.label}
                    </span>
                    <span className="text-[12px] text-muted">
                      confidence {Math.round((c.confidence ?? 0) * 100)}% · ground truth{" "}
                      <b className="text-slate-300">{c.true_label === 1 ? "TRUE" : c.true_label === 0 ? "FALSE" : "?"}</b>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
