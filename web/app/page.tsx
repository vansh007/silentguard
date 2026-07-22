import LiveMonitor from "@/components/LiveMonitor";

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <header className="mb-7">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 animate-pulse-soft rounded-full bg-ecg" />
          <h1 className="text-lg font-semibold tracking-tight">SilentGuard</h1>
          <span className="text-sm text-muted">· Live ICU alarm monitor</span>
        </div>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
          Most ICU arrhythmia alarms are false, and the resulting alarm fatigue is dangerous.
          SilentGuard watches the waveform leading up to each alarm and decides — in real time —
          whether to <span className="text-suppress">suppress</span> it,{" "}
          <span className="text-keep">keep</span> it, or{" "}
          <span className="text-defer">defer</span> it to a human, without ever silencing a real
          emergency.
        </p>
      </header>

      <LiveMonitor />

      <footer className="mt-10 text-[11px] text-muted">
        Engine: frozen RF+CNN ensemble · in-distribution AUROC 0.916 · true-alarm sensitivity floor
        ≥ 99% · 5-fold CV on 750 public CinC-2015 records (hidden test set unavailable). The
        cinematic experience and Arrhythmia Explainer are in progress.
      </footer>
    </main>
  );
}
