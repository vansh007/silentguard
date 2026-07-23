import Explainer from "@/components/Explainer";
import EcgPrimer from "@/components/explainer/EcgPrimer";
import HeartLink from "@/components/explainer/HeartLink";
import PageHeader from "@/components/PageHeader";

export default function ExplainerPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <PageHeader
        eyebrow="learn the alarms"
        title="Arrhythmia explainer"
        chips={["5 alarm types", "real ICU records", "our own beat detection", "live verdicts"]}
      >
        The five life-threatening alarms SilentGuard triages — each shown on a{" "}
        <b className="text-slate-200">real</b> ICU record, with the beats our detector found and the
        live verdict from the engine. Coloured dots mark detected QRS complexes: each
        heartbeat&apos;s ventricular contraction.
      </PageHeader>

      <HeartLink />
      <EcgPrimer />
      <Explainer />
    </main>
  );
}
