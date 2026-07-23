"use client";

import { motion } from "framer-motion";
import { useId } from "react";
import { usePerf } from "../perf";
import { cn } from "./primitives";

export interface TabItem {
  id: string;
  label: string;
  hint?: string;
}

/**
 * Segmented tab bar with a sliding active pill (framer `layoutId`).
 * Controlled — the parent owns `active`.
 */
export default function Tabs({
  items,
  active,
  onChange,
  className = "",
  size = "md",
}: {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  const { reduced } = usePerf();
  const group = useId();
  const pad = size === "sm" ? "px-3 py-1.5 text-[12px]" : "px-4 py-2 text-[13px]";

  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex flex-wrap items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1 backdrop-blur",
        className
      )}
    >
      {items.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            title={t.hint}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative rounded-lg transition-colors",
              pad,
              on ? "text-white" : "text-muted hover:text-slate-200"
            )}
          >
            {on &&
              (reduced ? (
                <span className="absolute inset-0 rounded-lg border border-ecg/30 bg-ecg/10" />
              ) : (
                <motion.span
                  layoutId={`tabpill-${group}`}
                  className="absolute inset-0 rounded-lg border border-ecg/30 bg-ecg/10"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ))}
            <span className="relative whitespace-nowrap">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
