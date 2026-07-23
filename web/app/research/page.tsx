import PageHeader from "@/components/PageHeader";
import SafetyDial from "@/components/research/SafetyDial";
import LoaoExplorer from "@/components/research/LoaoExplorer";
import { Callout, SectionHeading } from "@/components/ui";

export const metadata = {
  title: "Explore the research — SilentGuard",
  description:
    "Interactive: move the true-alarm sensitivity floor and hold arrhythmias out of training, recomputed live on real per-record predictions.",
};

export default function ResearchPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <PageHeader
        eyebrow="interactive"
        title="Explore the research"
        chips={["750 real records", "recomputed live in your browser", "leak-free predictions"]}
      >
        The two findings this project actually contributes, as controls you can move rather than
        charts you have to trust. Both recompute from the engine&apos;s real per-record out-of-fold
        predictions — nothing here is a simulation or a redrawn picture.
      </PageHeader>

      <section className="mb-16">
        <SectionHeading
          eyebrow="contribution C2 · selective prediction"
          title="How safe do you want to be?"
          sub="Silencing a false alarm helps a nurse; silencing a real one can kill. Move the floor and watch the whole operating point move with it."
        />
        <SafetyDial />
      </section>

      <section className="mb-16">
        <SectionHeading
          eyebrow="contribution C1 · generalization (headline)"
          title="What happens on a rhythm it has never seen?"
          sub="In-distribution accuracy flatters every model. Remove an arrhythmia from training entirely and the honest picture appears."
        />
        <LoaoExplorer />
      </section>

      <Callout title="Why this page exists">
        A single reported number hides the choice behind it. Both of these controls sweep a
        parameter that a real deployment has to pick — the sensitivity floor, and which rhythms you
        have training data for — and both are computed with the identical leak-free protocol used
        for every published figure. The client-side decision layer is a direct port of{" "}
        <code className="text-slate-300">src/silentguard/models/safety.py</code>, verified to match
        it to 1e-9 by <code className="text-slate-300">scripts/check_ts_parity.mjs</code>.
      </Callout>
    </main>
  );
}
