"use client";

import { useEffect, useId, useState } from "react";
import { usePerf } from "../perf";
import { cn } from "./primitives";

/* -------------------------------------------------------- DotPattern */

/** Faint dot field. Purely decorative — sits behind content. */
export function DotPattern({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
    >
      <defs>
        <pattern id={`dp-${id}`} width={22} height={22} patternUnits="userSpaceOnUse">
          <circle cx={1} cy={1} r={1} fill="rgba(61,220,132,0.16)" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#dp-${id})`} />
    </svg>
  );
}

/* ------------------------------------------------------- GridPattern */

/** ECG-paper style grid, faded out at the edges. */
export function GridPattern({
  className = "",
  size = 28,
  fade = "radial-gradient(circle at 50% 40%, black, transparent 75%)",
}: {
  className?: string;
  size?: number;
  fade?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{
        backgroundImage:
          "linear-gradient(rgba(61,220,132,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(61,220,132,0.055) 1px, transparent 1px)",
        backgroundSize: `${size}px ${size}px`,
        maskImage: fade,
        WebkitMaskImage: fade,
      }}
    />
  );
}

/* ----------------------------------------------------------- Meteors */

/**
 * Falling light streaks. Positions are randomised after mount so server and
 * client markup agree (no hydration mismatch). Off under reduced motion.
 */
export function Meteors({ count = 12 }: { count?: number }) {
  const { reduced } = usePerf();
  const [seeds, setSeeds] = useState<Array<{ top: number; left: number; delay: number; dur: number }>>(
    []
  );

  useEffect(() => {
    setSeeds(
      Array.from({ length: count }, () => ({
        top: Math.round(Math.random() * 60),
        left: Math.round(Math.random() * 100),
        delay: +(Math.random() * 6).toFixed(2),
        dur: +(4 + Math.random() * 5).toFixed(2),
      }))
    );
  }, [count]);

  if (reduced || seeds.length === 0) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {seeds.map((s, i) => (
        <span
          key={i}
          className="absolute h-0.5 w-0.5 animate-meteor rounded-full bg-ecg shadow-[0_0_0_1px_rgba(61,220,132,0.15)]"
          style={
            {
              top: `${s.top}%`,
              left: `${s.left}%`,
              animationDelay: `${s.delay}s`,
              "--dur": `${s.dur}s`,
            } as React.CSSProperties
          }
        >
          <span className="absolute top-1/2 -z-10 h-px w-[60px] -translate-y-1/2 bg-gradient-to-r from-ecg/60 to-transparent" />
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ Aurora */

/** Soft drifting colour blobs — the "alive" background. */
export function Aurora({ className = "" }: { className?: string }) {
  const { reduced } = usePerf();
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div
        className={cn(
          "absolute -left-24 top-0 h-72 w-72 rounded-full bg-ecg/[0.07] blur-[110px]",
          !reduced && "animate-float"
        )}
      />
      <div
        className={cn(
          "absolute -right-16 top-1/3 h-64 w-64 rounded-full bg-emerald-400/[0.06] blur-[110px]",
          !reduced && "animate-float"
        )}
        style={{ animationDelay: "2s" }}
      />
      <div
        className={cn(
          "absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-cyan-400/[0.04] blur-[110px]",
          !reduced && "animate-float"
        )}
        style={{ animationDelay: "4s" }}
      />
    </div>
  );
}

/* -------------------------------------------------------- BorderBeam */

/**
 * A light travelling around a card's border (Magic-UI style).
 * Renders a rotating conic gradient masked by an inset panel, so it needs the
 * parent to be `relative` + rounded.
 */
export function BorderBeam({
  color = "#3ddc84",
  duration = 5,
  inset = "#0a0f14",
}: {
  color?: string;
  duration?: number;
  inset?: string;
}) {
  const { reduced } = usePerf();
  if (reduced) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      <div
        className="absolute left-1/2 top-1/2 aspect-square w-[180%] -translate-x-1/2 -translate-y-1/2 animate-spin-slow"
        style={{
          background: `conic-gradient(from 0deg, transparent 0deg, transparent 250deg, ${color} 320deg, transparent 360deg)`,
          animationDuration: `${duration}s`,
        }}
      />
      <div className="absolute inset-px rounded-[inherit]" style={{ background: inset }} />
    </div>
  );
}

/* ---------------------------------------------------------- ScanLine */

/** Horizontal sweep, used to signal "the engine is analysing". */
export function ScanLine({ color = "#3ddc84" }: { color?: string }) {
  const { reduced } = usePerf();
  if (reduced) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      <div
        className="absolute inset-y-0 w-1/3 animate-beam-x"
        style={{ background: `linear-gradient(90deg, transparent, ${color}22, transparent)` }}
      />
    </div>
  );
}

/* -------------------------------------------------------- Spotlight */

/** Big soft ellipse of light behind a hero/section. */
export function Spotlight({
  className = "",
  color = "rgba(61,220,132,0.16)",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute", className)}
      style={{ background: `radial-gradient(ellipse at center, ${color}, transparent 65%)` }}
    />
  );
}
