"use client";

import { LANGS, useLang } from "@/lib/i18n";
import { cn } from "./ui";

/** Switches the nurse-facing vocabulary. Research prose stays in English by design. */
export default function LangToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-white/[0.08] bg-white/[0.03] p-0.5",
        className
      )}
      role="group"
      aria-label="Nurse interface language"
    >
      {LANGS.map((l) => (
        <button
          key={l.id}
          onClick={() => setLang(l.id)}
          aria-pressed={lang === l.id}
          title={`${l.label} — nurse-facing labels`}
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] transition",
            lang === l.id ? "bg-ecg/15 text-ecg" : "text-muted hover:text-white"
          )}
        >
          {l.native}
        </button>
      ))}
    </div>
  );
}
