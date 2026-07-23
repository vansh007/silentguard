"use client";

import { motion } from "framer-motion";
import { usePerf } from "./perf";
import { Badge, GridPattern, Spotlight } from "./ui";

/** Shared hero strip for the sub-pages (Monitor / Explainer / Results). */
export default function PageHeader({
  eyebrow,
  title,
  children,
  chips = [],
}: {
  eyebrow: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  chips?: string[];
}) {
  const { reduced } = usePerf();
  const anim = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <header className="relative mb-9 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] px-6 py-9 sm:px-9">
      <GridPattern
        size={26}
        fade="linear-gradient(to bottom, black, transparent 85%)"
        className="opacity-70"
      />
      <Spotlight className="-top-32 left-1/4 h-64 w-[520px]" />
      <motion.div className="relative" {...anim}>
        <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-ecg/80">
          <span className="h-px w-6 bg-gradient-to-r from-transparent to-ecg/60" />
          {eyebrow}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1>
        {children && (
          <div className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-muted">{children}</div>
        )}
        {chips.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {chips.map((c) => (
              <Badge key={c}>{c}</Badge>
            ))}
          </div>
        )}
      </motion.div>
    </header>
  );
}
