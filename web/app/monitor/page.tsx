import LiveMonitor from "@/components/LiveMonitor";
import PageHeader from "@/components/PageHeader";

export default function MonitorPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <PageHeader
        eyebrow="live triage"
        title="Live ICU alarm monitor"
        chips={[
          "real WFDB waveforms",
          "real QRS detection",
          "frozen RF+CNN ensemble",
          "SHAP reasons",
        ]}
      >
        Pick a real ICU alarm. Its ECG streams in real time; the moment the alarm fires, the frozen
        RF+CNN ensemble decides <span className="font-semibold text-suppress">suppress</span>,{" "}
        <span className="font-semibold text-keep">keep</span>, or{" "}
        <span className="font-semibold text-defer">defer</span> — and shows why. Ground truth is
        revealed afterwards, for honesty; the engine never sees it.
      </PageHeader>
      <LiveMonitor />
    </main>
  );
}
