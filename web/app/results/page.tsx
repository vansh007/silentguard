import Results from "@/components/Results";

export default function ResultsPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <header className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight">Results &amp; honesty</h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
          The real, leak-free evidence behind SilentGuard — pulled live from the model&apos;s result
          files and generated figures. Nothing here is hand-typed: every number and chart is produced
          by <code>scripts/05_freeze_ensemble.py</code> and <code>scripts/make_figures.py</code>.
        </p>
      </header>
      <Results />
    </main>
  );
}
