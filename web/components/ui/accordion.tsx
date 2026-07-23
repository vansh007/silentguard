"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { usePerf } from "../perf";
import { cn } from "./primitives";

export interface AccordionItem {
  id: string;
  title: React.ReactNode;
  body: React.ReactNode;
  tone?: string;
}

/** Expand/collapse list with animated height. One item open at a time. */
export default function Accordion({
  items,
  defaultOpen,
  className = "",
}: {
  items: AccordionItem[];
  defaultOpen?: string;
  className?: string;
}) {
  const { reduced } = usePerf();
  const [open, setOpen] = useState<string | null>(defaultOpen ?? null);

  return (
    <div className={cn("divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]", className)}>
      {items.map((it) => {
        const on = open === it.id;
        return (
          <div key={it.id}>
            <button
              onClick={() => setOpen(on ? null : it.id)}
              aria-expanded={on}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.03]"
            >
              <span className="flex items-center gap-3 text-[13px] font-medium text-slate-200">
                {it.tone && (
                  <span className="h-4 w-1 rounded-full" style={{ background: it.tone }} />
                )}
                {it.title}
              </span>
              <motion.span
                animate={reduced ? undefined : { rotate: on ? 45 : 0 }}
                className="text-lg leading-none text-muted"
              >
                +
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {on && (
                <motion.div
                  initial={reduced ? false : { height: 0, opacity: 0 }}
                  animate={reduced ? {} : { height: "auto", opacity: 1 }}
                  exit={reduced ? {} : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 text-[13px] leading-relaxed text-slate-300">
                    {it.body}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
