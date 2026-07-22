import Explainer from "@/components/Explainer";

export default function ExplainerPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <header className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight">Arrhythmia explainer</h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
          The five life-threatening alarms SilentGuard triages — each shown on a{" "}
          <b className="text-slate-300">real</b> ICU record, with the beats our detector found and
          the live verdict from the engine. Blue dots mark detected QRS complexes (each
          heartbeat&apos;s ventricular contraction).
        </p>
      </header>

      {/* quick ECG primer (clinically accurate, static education) */}
      <div className="mb-6 rounded-xl border border-hair bg-panel/40 p-4 text-[12px] leading-relaxed text-slate-300">
        <span className="text-muted">Reading an ECG: </span>
        the <b className="text-white">P wave</b> is atrial contraction, the tall{" "}
        <b className="text-white">QRS complex</b> is the ventricles contracting (the pulse you feel),
        and the <b className="text-white">T wave</b> is the ventricles resetting. A dangerous rhythm
        distorts this pattern — asystole flattens it, tachycardia crowds it, fibrillation shreds it.
      </div>

      <Explainer />
    </main>
  );
}
