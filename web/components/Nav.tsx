"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/monitor", label: "Live Monitor" },
  { href: "/explainer", label: "Arrhythmia Explainer" },
  { href: "/results", label: "Results" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="sticky top-0 z-40 border-b border-hair bg-ink/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-5 py-3">
        <Link href="/" className="mr-4 flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 animate-pulse-soft rounded-full bg-ecg" />
          <span className="text-sm font-semibold tracking-tight">SilentGuard</span>
        </Link>
        <div className="flex flex-wrap gap-1">
          {LINKS.slice(1).map((l) => {
            const active = path === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 text-[13px] transition ${
                  active ? "bg-white/[0.06] text-white" : "text-muted hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
