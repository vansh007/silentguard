"use client";

import { usePerf } from "../perf";
import { cn } from "./primitives";

/**
 * Infinite horizontal ticker. Children are duplicated once so the loop is
 * seamless; hovering pauses it so content stays readable.
 */
export default function Marquee({
  children,
  duration = 34,
  gap = "1rem",
  className = "",
}: {
  children: React.ReactNode;
  duration?: number;
  gap?: string;
  className?: string;
}) {
  const { reduced } = usePerf();

  if (reduced)
    return (
      <div className={cn("flex flex-wrap justify-center gap-3", className)}>{children}</div>
    );

  return (
    <div
      className={cn("group relative flex overflow-hidden", className)}
      style={
        {
          "--gap": gap,
          maskImage: "linear-gradient(90deg, transparent, black 12%, black 88%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, black 12%, black 88%, transparent)",
        } as React.CSSProperties
      }
    >
      {[0, 1].map((k) => (
        <div
          key={k}
          aria-hidden={k === 1}
          className="flex shrink-0 animate-marquee items-center group-hover:[animation-play-state:paused]"
          style={{ gap, paddingRight: gap, ["--duration" as string]: `${duration}s` }}
        >
          {children}
        </div>
      ))}
    </div>
  );
}
