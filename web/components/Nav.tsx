"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { fetchHealth } from "@/lib/api";
import { usePerf } from "./perf";
import { cn, Dot } from "./ui";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/monitor", label: "Live Monitor" },
  { href: "/explainer", label: "Explainer" },
  { href: "/results", label: "Results" },
];

/** Polls the FastAPI engine so the header shows real availability, never a fake "online". */
function EngineStatus({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<"checking" | "ok" | "degraded" | "down">("checking");

  useEffect(() => {
    let alive = true;
    const check = () =>
      fetchHealth()
        .then((h) => alive && setState(h.model_loaded ? "ok" : "degraded"))
        .catch(() => alive && setState("down"));
    check();
    const t = setInterval(check, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const meta = {
    checking: { c: "#7d8794", t: "checking engine…" },
    ok: { c: "#3ddc84", t: "engine online" },
    degraded: { c: "#f59e0b", t: "model not loaded" },
    down: { c: "#ef4444", t: "engine offline" },
  }[state];

  return (
    <span
      title={
        state === "down"
          ? "Start the backend: .venv/bin/uvicorn service.main:app --port 8000"
          : meta.t
      }
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-wider",
        compact && "px-2"
      )}
      style={{ color: meta.c }}
    >
      <Dot color={meta.c} pulse={state === "ok"} />
      {!compact && meta.t}
    </span>
  );
}

export default function Nav() {
  const path = usePathname();
  const { reduced } = usePerf();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => setOpen(false), [path]);

  return (
    <nav
      className={cn(
        "sticky top-0 z-50 border-b transition-all duration-300",
        scrolled
          ? "border-hair bg-ink/85 shadow-[0_10px_30px_-20px_rgba(0,0,0,1)] backdrop-blur-xl"
          : "border-transparent bg-ink/40 backdrop-blur"
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3">
        {/* logo */}
        <Link href="/" className="group mr-2 flex items-center gap-2.5">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-lg border border-ecg/25 bg-ecg/10">
            <svg viewBox="0 0 24 12" className="h-3.5 w-4 text-ecg" fill="none">
              <path
                d="M0 6h5l2-4 3 8 2.5-5 2 3h9"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {!reduced && (
              <span className="absolute inset-0 rounded-lg bg-ecg/20 opacity-0 blur transition group-hover:opacity-100" />
            )}
          </span>
          <span className="text-sm font-semibold tracking-tight text-white">SilentGuard</span>
        </Link>

        {/* desktop links with sliding pill */}
        <div className="hidden flex-wrap items-center gap-1 sm:flex">
          {LINKS.map((l) => {
            const active = path === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "relative rounded-lg px-3 py-1.5 text-[13px] transition-colors",
                  active ? "text-white" : "text-muted hover:text-white"
                )}
              >
                {active &&
                  (reduced ? (
                    <span className="absolute inset-0 rounded-lg bg-white/[0.07]" />
                  ) : (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-lg border border-ecg/20 bg-white/[0.07]"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  ))}
                <span className="relative">{l.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden sm:inline-flex">
            <EngineStatus />
          </span>
          <span className="sm:hidden">
            <EngineStatus compact />
          </span>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            className="rounded-lg border border-hair px-2.5 py-1.5 text-[13px] text-slate-300 sm:hidden"
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* mobile drawer */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-hair sm:hidden"
          >
            <div className="flex flex-col p-2">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-[13px]",
                    path === l.href ? "bg-white/[0.07] text-white" : "text-muted"
                  )}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
