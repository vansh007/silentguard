import LiveMonitor from "@/components/LiveMonitor";

export default function MonitorPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <header className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight">Live ICU alarm monitor</h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
          Pick a real ICU alarm. Its ECG streams in real time; the moment the alarm fires, the
          frozen RF+CNN ensemble decides <span className="text-suppress">suppress</span>,{" "}
          <span className="text-keep">keep</span>, or <span className="text-defer">defer</span> —
          and shows why. Ground truth is revealed after, for honesty; the engine never sees it.
        </p>
      </header>
      <LiveMonitor />
    </main>
  );
}
