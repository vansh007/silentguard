import Link from "next/link";
import HeadlineStats from "@/components/HeadlineStats";
import Hero from "@/components/Hero";
import DecisionCards from "@/components/home/DecisionCards";
import ArrhythmiaTicker from "@/components/home/ArrhythmiaTicker";
import AlarmSequence from "@/components/home/AlarmSequence";
import { Reveal } from "@/components/motion";
import {
  Badge,
  Button,
  Callout,
  Card,
  DotPattern,
  Pipeline,
  SectionHeading,
  SpotlightCard,
} from "@/components/ui";

const PROBLEM = [
  {
    n: "61%",
    l: "of alarms are false",
    t: "456 of the 750 benchmark records are false alarms. Every one pulls a nurse away from a patient who needs them.",
  },
  {
    n: "5×",
    l: "asymmetric penalty",
    t: "Silencing a real alarm is scored five times worse than keeping a false one. Safety is never traded for quiet.",
  },
  {
    n: "5",
    l: "lethal rhythms",
    t: "Asystole, extreme bradycardia and tachycardia, ventricular tachycardia and ventricular flutter/fibrillation.",
  },
];

const PIPELINE = [
  {
    k: "signal",
    icon: "〜",
    title: "Read the waveform",
    body: "The seconds of ECG (plus ABP/PPG when present) before the alarm are filtered, beats detected, and signal quality measured — because most false alarms are simply noise.",
  },
  {
    k: "engine",
    icon: "◈",
    title: "Score it",
    body: "A frozen RF + CNN ensemble fuses 33 hand-crafted physiological features with a 1-D CNN reading the raw waveform, producing a calibrated probability that the alarm is false.",
  },
  {
    k: "decide",
    icon: "⚖",
    title: "Decide safely",
    body: "A safety layer turns that probability into SUPPRESS / KEEP / DEFER under a true-alarm sensitivity floor — and hands back a plain-language reason for the call.",
  },
];

const DIFFERENTIATORS = [
  {
    tag: "C1 · headline",
    title: "Tested on rhythms it has never seen",
    body: "We hold an entire arrhythmia type out of training and test zero-shot on it. In-distribution accuracy flatters every model; this is the number that predicts whether it survives a new ward.",
    span: "lg:col-span-3",
  },
  {
    tag: "C2 · safety",
    title: "It is allowed to say 'I don't know'",
    body: "Instead of forcing a binary call, ambiguous alarms are DEFERRED to a human, and the wait-time before deciding is chosen per alarm.",
    span: "lg:col-span-3",
  },
  {
    tag: "C3 · trust",
    title: "Calibrated, explained, never a black box",
    body: "Every verdict carries a confidence that means what it says (reliability-checked, ECE ≈ 0.09) and the SHAP reasons behind it — signal quality, heart-rate agreement, rhythm regularity.",
    span: "lg:col-span-2",
  },
  {
    tag: "deployment",
    title: "Built for where there is no local data",
    body: "No open Indian ICU alarm dataset exists, so an in-distribution model is useless there. Our generalization result is the honest proxy for that setting.",
    span: "lg:col-span-2",
  },
  {
    tag: "engineering",
    title: "Retrofit, edge-friendly",
    body: "A frozen ensemble small enough to run beside an existing bedside monitor rather than replacing it — the only economically realistic path in a budget ICU.",
    span: "lg:col-span-2",
  },
];

export default function Home() {
  return (
    <>
      <Hero />

      <main className="mx-auto max-w-6xl px-5 pb-24">
        {/* ------------------------------------------------ live stats */}
        <section className="-mt-4 mb-24">
          <Reveal>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Badge tone="ecg">live from the model</Badge>
              <span className="text-[11px] text-muted">
                read from the engine&apos;s own result files — nothing on this page is typed by hand
              </span>
            </div>
          </Reveal>
          <HeadlineStats />
        </section>

        {/* ------------------------------------------------ ticker */}
        <section className="mb-24">
          <Reveal>
            <div className="mb-4 text-center text-[11px] uppercase tracking-[0.2em] text-muted">
              the five life-threatening alarms we triage
            </div>
          </Reveal>
          <ArrhythmiaTicker />
        </section>

        {/* ------------------------------------------------ the story */}
        <section className="mb-24">
          <SectionHeading
            eyebrow="the story"
            title="One alarm, start to finish"
            sub="Watch a real CinC-2015 record go from a stable rhythm to a screaming monitor to a reasoned verdict. The decision at the end is fetched live from the engine."
          />
          <AlarmSequence />
        </section>

        {/* ------------------------------------------------ the problem */}
        <section className="mb-24">
          <SectionHeading
            eyebrow="the problem"
            title="Alarm fatigue"
            sub="When most alarms are false, staff stop trusting them — and that is exactly when a real emergency slips through."
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {PROBLEM.map((c, i) => (
              <Reveal key={c.n} delay={i * 0.08}>
                <SpotlightCard className="h-full p-6">
                  <div className="bg-gradient-to-b from-white to-slate-400 bg-clip-text text-5xl font-bold tracking-tight text-transparent">
                    {c.n}
                  </div>
                  <div className="mt-1 text-[12px] uppercase tracking-wider text-ecg/80">{c.l}</div>
                  <p className="mt-3 text-[13px] leading-relaxed text-slate-300">{c.t}</p>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------ how it works */}
        <section className="mb-24">
          <SectionHeading
            eyebrow="how it works"
            title="Waveform in, decision out"
            sub="Three stages, roughly a second of compute, running beside the monitor that raised the alarm."
          />
          <Pipeline steps={PIPELINE} />
        </section>

        {/* ------------------------------------------------ decisions */}
        <section className="mb-24">
          <SectionHeading
            eyebrow="the output"
            title="Three outcomes, one rule"
            sub="Never silence a real emergency. Everything else follows from that constraint."
          />
          <DecisionCards />
        </section>

        {/* ------------------------------------------------ bento */}
        <section className="mb-24">
          <SectionHeading
            eyebrow="what makes it research"
            title="Not another accuracy number"
            sub="The contribution is deployability: does it generalize, can it abstain, and can a nurse trust it?"
          />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-6">
            {DIFFERENTIATORS.map((d, i) => (
              <Reveal key={d.title} delay={(i % 3) * 0.07} className={d.span}>
                <SpotlightCard className="h-full overflow-hidden p-6">
                  <DotPattern className="opacity-[0.35]" />
                  <div className="relative">
                    <Badge tone="ecg">{d.tag}</Badge>
                    <h3 className="mt-3 text-[15px] font-semibold text-white">{d.title}</h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{d.body}</p>
                  </div>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------ honesty */}
        <section className="mb-16">
          <Reveal>
            <Callout title="Honest by design">
              SilentGuard is a <b>research prototype, not a cleared medical device</b>. All results
              are leak-free 5-fold cross-validation on the 750 public CinC-2015 records — the
              official 500-record test set was never released, so no leaderboard number is
              reproducible here. Generalization to unseen arrhythmias is genuinely poor, and we
              publish that gap rather than hide it. See the{" "}
              <Link href="/results" className="text-ecg underline underline-offset-2">
                Results
              </Link>{" "}
              page for every caveat.
            </Callout>
          </Reveal>
        </section>

        {/* ------------------------------------------------ CTA */}
        <section className="mb-16">
          <Reveal>
            <Card className="overflow-hidden p-10 text-center">
              <DotPattern className="opacity-40" />
              <div className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[420px] -translate-x-1/2 rounded-full bg-ecg/10 blur-[90px]" />
              <div className="relative">
                <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  See it decide on a real ICU alarm
                </h2>
                <p className="mx-auto mt-3 max-w-lg text-[13px] leading-relaxed text-muted">
                  Pick a record, watch its actual ECG stream, and read the verdict the frozen
                  ensemble produces — with the reasons and the ground truth revealed afterwards.
                </p>
                <div className="mt-7 flex flex-wrap justify-center gap-3">
                  <Button href="/monitor">▶ Open the live monitor</Button>
                  <Button href="/explainer" variant="outline">
                    Learn the five alarms
                  </Button>
                </div>
              </div>
            </Card>
          </Reveal>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-hair pt-6 text-[11px] text-muted">
          <span>
            Team Sentinel · BCSE335L Healthcare Data Analytics, VIT Chennai
          </span>
          <span>data &amp; engine: PhysioNet/CinC Challenge 2015 · 750 public records</span>
        </footer>
      </main>
    </>
  );
}
