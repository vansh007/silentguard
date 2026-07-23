"use client";

import { useEffect } from "react";

/** Route-level error boundary — a crash shows a real message, never a blank page. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("SilentGuard UI error:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center px-5">
      <div className="rounded-2xl border border-suppress/25 bg-suppress/[0.05] p-7">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-suppress">
          interface error
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-white">Something broke on this page.</h1>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          The engine and your data are unaffected — this is a rendering fault in the web layer. If
          it persists, check that the API is running on port 8000.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-black/40 p-3 font-mono text-[11px] text-slate-300">
          {error.message}
          {error.digest ? `\ndigest: ${error.digest}` : ""}
        </pre>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={reset}
            className="rounded-xl bg-ecg px-5 py-2.5 text-[13px] font-semibold text-[#04140c] transition hover:brightness-110"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-xl border border-hair px-5 py-2.5 text-[13px] text-slate-200 transition hover:border-slate-500"
          >
            Back home
          </a>
        </div>
      </div>
    </main>
  );
}
