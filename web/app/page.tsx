import Link from "next/link";
import HeadlineStats from "@/components/HeadlineStats";
import Hero from "@/components/Hero";
import { Reveal } from "@/components/motion";

function Glass({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`group rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-ecg/30 hover:bg-white/[0.05] hover:shadow-[0_10px_40px_-12px_rgba(61,220,132,0.25)] ${className}`}
    >
      {children}
    </div>
  );
}

export default function Home() {
  return (
    <>
      <Hero />

      <main className="mx-auto max-w-6xl px-5 pb-20">
        {/* live headline stats */}
        <section className="-mt-6 mb-20">
          <Reveal>
            <h2 className="mb-4 text-[11px] uppercase tracking-wider text-muted">
              What the engine achieves · live from the model
            </h2>
            <HeadlineStats />
          </Reveal>
        </section>

        {/* the problem */}
        <section className="mb-20">
          <Reveal>
            <h2 className="mb-1 text-2xl font-semibold tracking-tight">The problem: alarm fatigue</h2>
            <p className="mb-6 max-w-2xl text-[14px] text-muted">
              When most alarms are false, staff stop trusting them — and that is when real
              emergencies slip through.
            </p>
          </Reveal>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { n: "61%", t: "of alarms are false in our benchmark (456 of 750 records) — a nurse chasing them is pulled from real care." },
              { n: "5×", t: "silencing a real alarm is treated as five times worse than keeping a false one. Safety is never traded for quiet." },
              { n: "5 rhythms", t: "asystole, extreme brady/tachycardia, ventricular tachycardia, and ventricular flutter/fibrillation — the lethal alarms." },
            ].map((c, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <Glass>
                  <div className="text-3xl font-bold text-white">{c.n}</div>
                  <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{c.t}</p>
                </Glass>
              </Reveal>
            ))}
          </div>
        </section>

        {/* how it works */}
        <section className="mb-20">
          <Reveal>
            <h2 className="mb-6 text-2xl font-semibold tracking-tight">How it works</h2>
          </Reveal>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { k: "1 · Waveform", t: "The seconds of ECG (plus ABP/PPG when present) before the alarm are cleaned and beats detected; signal quality is measured, because most false alarms are noise." },
              { k: "2 · Engine", t: "A frozen RF + CNN ensemble fuses 33 hand-crafted physiological features with a 1-D CNN reading the raw waveform into a calibrated probability the alarm is false." },
              { k: "3 · Decision", t: "A safety layer turns that into SUPPRESS / KEEP / DEFER with a true-alarm sensitivity floor — plus a plain-language reason for the call." },
            ].map((c, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <Glass>
                  <div className="text-[11px] uppercase tracking-wider text-ecg/80">{c.k}</div>
                  <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{c.t}</p>
                </Glass>
              </Reveal>
            ))}
          </div>
        </section>

        {/* three-way decision */}
        <section className="mb-20">
          <Reveal>
            <h2 className="mb-6 text-2xl font-semibold tracking-tight">Three outcomes, one rule</h2>
          </Reveal>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { c: "#ef4444", l: "SUPPRESS", t: "Confident it is a false alarm (noise/artifact). Silenced, so it never adds to fatigue." },
              { c: "#22c55e", l: "KEEP", t: "Likely a real emergency. The alarm sounds normally and reaches the nurse immediately." },
              { c: "#f59e0b", l: "DEFER", t: "Genuinely ambiguous. Routed to a human rather than guessed — the safe choice under heavy load." },
            ].map((d, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <Glass className="border-l-2" >
                  <div className="text-lg font-bold" style={{ color: d.c }}>{d.l}</div>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-300">{d.t}</p>
                </Glass>
              </Reveal>
            ))}
          </div>
        </section>

        {/* why it matters */}
        <section className="mb-20">
          <Reveal>
            <h2 className="mb-6 text-2xl font-semibold tracking-tight">Why it matters</h2>
          </Reveal>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Reveal>
              <Glass>
                <h3 className="text-sm font-semibold text-white">Built for where there is no local data</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-300">
                  Many ICUs run heterogeneous monitors with no labelled local data. So we test
                  generalization to an arrhythmia the model <i>never trained on</i> — an honest
                  deployability stress test, not just in-distribution accuracy.
                </p>
              </Glass>
            </Reveal>
            <Reveal delay={0.08}>
              <Glass>
                <h3 className="text-sm font-semibold text-white">Trustworthy, not a black box</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-300">
                  Every verdict carries calibrated confidence and the reasons behind it (signal
                  quality, HR mismatch, rhythm regularity) — and is designed to run on cheap edge
                  hardware, retrofitting existing monitors.
                </p>
              </Glass>
            </Reveal>
          </div>
        </section>

        {/* honesty */}
        <section className="mb-14">
          <Reveal>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-6">
              <h3 className="text-sm font-semibold text-amber-300/90">Honest by design</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-300">
                SilentGuard is a <b>research prototype, not a cleared medical device</b>. All results
                are 5-fold cross-validation on 750 public CinC-2015 records (the 500-record test set
                is unreleased). Generalization to unseen arrhythmias is genuinely hard — we show the
                gap rather than hide it. See the{" "}
                <Link href="/results" className="text-ecg underline">Results</Link> page.
              </p>
            </div>
          </Reveal>
        </section>

        <footer className="text-[11px] text-muted">
          Team Sentinel · BCSE335L Healthcare Data Analytics, VIT Chennai · engine + data:
          PhysioNet/CinC Challenge 2015.
        </footer>
      </main>
    </>
  );
}
