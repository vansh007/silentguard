import PageHeader from "@/components/PageHeader";
import Results from "@/components/Results";

export default function ResultsPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <PageHeader
        eyebrow="evidence & limits"
        title="Results & honesty"
        chips={["750 public records", "leak-free 5-fold CV", "no test-set tuning", "limitations included"]}
      >
        The real, leak-free evidence behind SilentGuard — pulled live from the model&apos;s own
        result files and generated figures. Nothing here is hand-typed: every number and chart comes
        from <code className="text-slate-300">scripts/05_freeze_ensemble.py</code> and{" "}
        <code className="text-slate-300">scripts/make_figures.py</code>.
      </PageHeader>
      <Results />
    </main>
  );
}
