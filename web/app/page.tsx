import Link from "next/link";
import HeadlineStats from "@/components/HeadlineStats";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-hair bg-panel/60 p-6 ${className}`}>{children}</div>
  );
}

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      {/* hero */}
      <section className="mb-14">
        <p className="mb-3 text-[12px] uppercase tracking-[0.2em] text-ecg/80">
          ICU false-alarm intelligence
        </p>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Every ICU heartbeat tells a story.
          <br />
          <span className="text-muted">Not every alarm tells the truth.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-slate-300">
          Bedside monitors fire constantly, and most arrhythmia alarms are false. Staff grow
          desensitised — <b className="text-white">alarm fatigue</b> — and real emergencies can be
          missed. SilentGuard reads the physiological waveforms leading up to each alarm and decides,
          in real time, whether to <span className="text-suppress">suppress</span> a false alarm,{" "}
          <span className="text-keep">keep</span> a real one, or{" "}
          <span className="text-defer">defer</span> an ambiguous one to a human —{" "}
          <b className="text-white">without ever silencing a true emergency</b>.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/monitor" className="rounded-lg bg-ecg px-5 py-2.5 text-sm font-semibold text-[#04140c]">
            ▶ Try the live monitor
          </Link>
          <Link href="/explainer" className="rounded-lg border border-hair px-5 py-2.5 text-sm text-slate-200 hover:border-slate-600">
            Learn the alarms
          </Link>
          <Link href="/results" className="rounded-lg border border-hair px-5 py-2.5 text-sm text-slate-200 hover:border-slate-600">
            See the evidence
          </Link>
        </div>
      </section>

      {/* live headline stats (real, from the engine) */}
      <section className="mb-14">
        <h2 className="mb-4 text-[11px] uppercase tracking-wider text-muted">
          What the engine achieves · live from the model
        </h2>
        <HeadlineStats />
      </section>

      {/* the problem */}
      <section className="mb-14">
        <h2 className="mb-4 text-xl font-semibold tracking-tight">The problem: alarm fatigue</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <div className="text-2xl font-bold text-white">61%</div>
            <p className="mt-1 text-[13px] text-slate-300">
              of alarms are false in our benchmark (456 of 750 records) — a nurse chasing them is
              pulled away from real care.
            </p>
          </Card>
          <Card>
            <div className="text-2xl font-bold text-white">5×</div>
            <p className="mt-1 text-[13px] text-slate-300">
              We treat <i>silencing a real alarm</i> as five times worse than keeping a false one —
              the official challenge cost. Safety is never traded for quiet.
            </p>
          </Card>
          <Card>
            <div className="text-2xl font-bold text-white">5 rhythms</div>
            <p className="mt-1 text-[13px] text-slate-300">
              Asystole, extreme bradycardia, extreme tachycardia, ventricular tachycardia, and
              ventricular flutter/fibrillation — the life-threatening alarms.
            </p>
          </Card>
        </div>
      </section>

      {/* how it works */}
      <section className="mb-14">
        <h2 className="mb-4 text-xl font-semibold tracking-tight">How it works</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <div className="text-[11px] uppercase tracking-wider text-ecg/80">1 · Waveform</div>
            <p className="mt-2 text-[13px] text-slate-300">
              The last seconds of ECG (plus ABP/PPG when present) leading up to the alarm are cleaned,
              and beats are detected — signal quality is measured, because most false alarms are
              noise.
            </p>
          </Card>
          <Card>
            <div className="text-[11px] uppercase tracking-wider text-ecg/80">2 · Engine</div>
            <p className="mt-2 text-[13px] text-slate-300">
              A frozen <b className="text-white">RF + CNN ensemble</b> fuses two views — 33
              hand-crafted physiological features and a 1-D CNN reading the raw waveform — into a
              calibrated probability that the alarm is false.
            </p>
          </Card>
          <Card>
            <div className="text-[11px] uppercase tracking-wider text-ecg/80">3 · Decision</div>
            <p className="mt-2 text-[13px] text-slate-300">
              A safety layer turns that probability into{" "}
              <span className="text-suppress">SUPPRESS</span> /{" "}
              <span className="text-keep">KEEP</span> / <span className="text-defer">DEFER</span>,
              with a true-alarm sensitivity floor, plus a plain-language reason for the call.
            </p>
          </Card>
        </div>
      </section>

      {/* the three-way decision */}
      <section className="mb-14">
        <h2 className="mb-4 text-xl font-semibold tracking-tight">Three outcomes, one rule</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="border-suppress/30">
            <div className="text-lg font-bold text-suppress">SUPPRESS</div>
            <p className="mt-1 text-[13px] text-slate-300">
              Confident it is a false alarm (noise/artifact). The alarm is silenced so it never adds
              to fatigue.
            </p>
          </Card>
          <Card className="border-keep/30">
            <div className="text-lg font-bold text-keep">KEEP</div>
            <p className="mt-1 text-[13px] text-slate-300">
              Likely a real emergency. The alarm sounds normally and reaches the nurse immediately.
            </p>
          </Card>
          <Card className="border-defer/30">
            <div className="text-lg font-bold text-defer">DEFER</div>
            <p className="mt-1 text-[13px] text-slate-300">
              Genuinely ambiguous. Rather than guess, it routes the alarm to a human — the safe
              choice under a heavy nurse load.
            </p>
          </Card>
        </div>
      </section>

      {/* why it matters / deployability */}
      <section className="mb-14">
        <h2 className="mb-4 text-xl font-semibold tracking-tight">Why it matters</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <h3 className="text-sm font-semibold text-white">Built for where there is no local data</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-300">
              Many ICUs — especially resource-constrained ones — run a heterogeneous mix of monitors
              with no labelled local data. So we don't just measure in-distribution accuracy; we test
              generalization to an arrhythmia the model <i>never trained on</i>
              (leave-one-arrhythmia-out). It's an honest stress test of deployability.
            </p>
          </Card>
          <Card>
            <h3 className="text-sm font-semibold text-white">Trustworthy, not a black box</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-300">
              Every verdict comes with calibrated confidence and the top reasons behind it (signal
              quality, heart-rate mismatch, rhythm regularity). A stretched nurse can see <i>why</i> —
              and the engine is designed to run on cheap edge hardware, retrofitting existing monitors.
            </p>
          </Card>
        </div>
      </section>

      {/* honesty */}
      <section className="mb-10">
        <Card className="border-amber-500/20 bg-amber-500/[0.04]">
          <h3 className="text-sm font-semibold text-amber-300/90">Honest by design</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-300">
            SilentGuard is a <b>research prototype, not a cleared medical device</b>. All results are
            5-fold cross-validation on 750 public CinC-2015 records (the official 500-record test set
            is unreleased). Generalization to unseen arrhythmias is genuinely hard — we show the gap
            rather than hide it. See the <Link href="/results" className="text-ecg underline">Results</Link>{" "}
            page for the real figures and limitations.
          </p>
        </Card>
      </section>

      <footer className="text-[11px] text-muted">
        Team Sentinel · BCSE335L Healthcare Data Analytics, VIT Chennai · engine + data: PhysioNet/CinC
        Challenge 2015.
      </footer>
    </main>
  );
}
