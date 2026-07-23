import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center px-5 text-center">
      <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-ecg/80">flatline</div>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-white">404</h1>
      <p className="mt-3 text-[14px] text-muted">
        No signal on this channel. The page you asked for does not exist.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        {[
          { href: "/", label: "Home" },
          { href: "/monitor", label: "Live Monitor" },
          { href: "/ward", label: "Ward" },
          { href: "/research", label: "Research" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-xl border border-hair px-4 py-2 text-[13px] text-slate-200 transition hover:border-ecg/40 hover:text-white"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </main>
  );
}
