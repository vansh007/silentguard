import PageHeader from "@/components/PageHeader";
import WardBoard from "@/components/ward/WardBoard";
import { Callout } from "@/components/ui";

export const metadata = {
  title: "Ward view — SilentGuard",
  description:
    "Six ICU beds streaming real waveforms at once, with live SUPPRESS/KEEP/DEFER verdicts and a running noise-reduction tally.",
};

export default function WardPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <PageHeader
        eyebrow="the product"
        title="Ward view"
        chips={["6 simultaneous beds", "independent live streams", "session tally", "loops continuously"]}
      >
        One alarm at a time is a demo; a ward is the actual problem. Six beds stream real
        CinC-2015 records at once, each with its own connection to the engine. Alarms fire on their
        own schedule, verdicts land as they are computed, and the counter at the top shows how much
        quieter the ward got — and, crucially, whether anything real was ever silenced.
      </PageHeader>

      <WardBoard />

      <div className="mt-8">
        <Callout title="What you are watching">
          Each tile holds its own WebSocket to <code className="text-slate-300">/ws/stream/&#123;id&#125;</code>,
          receives the real pre-alarm waveform, and then the frozen RF+CNN ensemble&apos;s verdict
          computed at the moment the alarm fires. Beds re-arm a few seconds after resolving, so the
          board keeps running. Heart rates are derived from the QRS complexes our own detector found
          in that window — nothing on this page is scripted or pre-recorded.
        </Callout>
      </div>
    </main>
  );
}
