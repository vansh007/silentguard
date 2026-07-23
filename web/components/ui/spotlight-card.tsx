"use client";

import { useRef, useState } from "react";
import { usePerf } from "../perf";
import { cn } from "./primitives";

/**
 * Card whose surface lights up under the cursor (Aceternity-style spotlight).
 * Falls back to a plain card under reduced motion.
 */
export default function SpotlightCard({
  children,
  className = "",
  glow = "61,220,132",
  hover = true,
}: {
  children: React.ReactNode;
  className?: string;
  /** rgb triplet string for the highlight colour */
  glow?: string;
  hover?: boolean;
}) {
  const { reduced } = usePerf();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: -999, y: -999 });
  const [on, setOn] = useState(false);

  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        if (reduced) return;
        const r = ref.current!.getBoundingClientRect();
        setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
      onMouseEnter={() => !reduced && setOn(true)}
      onMouseLeave={() => setOn(false)}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur",
        hover &&
          "transition duration-300 hover:-translate-y-1 hover:border-white/[0.16] hover:shadow-[0_18px_55px_-20px_rgba(0,0,0,0.9)]",
        className
      )}
    >
      {!reduced && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            opacity: on ? 1 : 0,
            background: `radial-gradient(340px circle at ${pos.x}px ${pos.y}px, rgba(${glow},0.13), transparent 72%)`,
          }}
        />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}
