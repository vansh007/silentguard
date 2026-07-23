"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { usePerf } from "../perf";

/** Tiny classname joiner (keeps us off a clsx dependency). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ Card */

/** Glass surface. `hover` adds the lift + green rim used across the site. */
export function Card({
  children,
  className = "",
  hover = false,
  as: As = "div",
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  as?: "div" | "section" | "article" | "li";
}) {
  return (
    <As
      className={cn(
        "relative rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur",
        hover &&
          "transition duration-300 hover:-translate-y-1 hover:border-ecg/30 hover:bg-white/[0.05] hover:shadow-[0_16px_50px_-18px_rgba(61,220,132,0.35)]",
        className
      )}
    >
      {children}
    </As>
  );
}

/* ----------------------------------------------------------------- Badge */

const BADGE_TONES = {
  neutral: "border-white/10 bg-white/[0.05] text-slate-300",
  ecg: "border-ecg/30 bg-ecg/10 text-ecg",
  suppress: "border-suppress/30 bg-suppress/10 text-suppress",
  keep: "border-keep/30 bg-keep/10 text-keep",
  defer: "border-defer/30 bg-defer/10 text-defer",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
} as const;

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: keyof typeof BADGE_TONES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        BADGE_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Small pulsing status dot. */
export function Dot({ color = "#3ddc84", pulse = true }: { color?: string; pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-2 w-2">
      {pulse && (
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
          style={{ background: color }}
        />
      )}
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

/* ---------------------------------------------------------------- Button */

export function Button({
  children,
  href,
  onClick,
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  title,
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "outline";
  size?: "sm" | "md";
  className?: string;
  disabled?: boolean;
  title?: string;
}) {
  const base =
    "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl font-semibold transition disabled:opacity-40";
  const sizes = { sm: "px-3.5 py-2 text-[12px]", md: "px-6 py-3 text-sm" };
  const variants = {
    primary: "bg-ecg text-[#04140c] shadow-[0_0_30px_-8px_#3ddc84] hover:brightness-110",
    outline:
      "border border-hair bg-white/[0.02] text-slate-200 backdrop-blur hover:border-ecg/40 hover:text-white",
    ghost: "text-slate-300 hover:bg-white/[0.05] hover:text-white",
  };
  const cls = cn(base, sizes[size], variants[variant], className);

  const inner = (
    <>
      {/* sheen sweep on hover */}
      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      <span className="relative flex items-center gap-2">{children}</span>
    </>
  );

  if (href)
    return (
      <Link href={href} className={cls} title={title}>
        {inner}
      </Link>
    );
  return (
    <button onClick={onClick} className={cls} disabled={disabled} title={title}>
      {inner}
    </button>
  );
}

/* -------------------------------------------------------- SectionHeading */

export function SectionHeading({
  eyebrow,
  title,
  sub,
  className = "",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
}) {
  const { reduced } = usePerf();
  return (
    <motion.div
      className={cn("mb-7", className)}
      initial={reduced ? false : { opacity: 0, y: 18 }}
      whileInView={reduced ? {} : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      {eyebrow && (
        <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-ecg/80">
          <span className="h-px w-6 bg-gradient-to-r from-transparent to-ecg/60" />
          {eyebrow}
        </div>
      )}
      <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h2>
      {sub && <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted">{sub}</p>}
    </motion.div>
  );
}

/* -------------------------------------------------------------- Skeleton */

/** Shimmering placeholder — used instead of inventing values while loading. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-white/[0.04]", className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
    </div>
  );
}

/* ------------------------------------------------------------- StatTile */

export function StatTile({
  value,
  label,
  sub,
  tone = "#3ddc84",
  className = "",
}: {
  value: React.ReactNode;
  label: string;
  sub?: string;
  tone?: string;
  className?: string;
}) {
  return (
    <Card hover className={cn("overflow-hidden p-5", className)}>
      <div
        className="absolute inset-x-0 top-0 h-px opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${tone}, transparent)` }}
      />
      <div className="font-mono text-3xl font-bold tabular-nums tracking-tight text-white sm:text-4xl">
        {value}
      </div>
      <div className="mt-1.5 text-[13px] text-slate-300">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted">{sub}</div>}
    </Card>
  );
}

/* ------------------------------------------------------------- Callout */

export function Callout({
  title,
  tone = "amber",
  children,
}: {
  title: string;
  tone?: "amber" | "ecg";
  children: React.ReactNode;
}) {
  const c =
    tone === "amber"
      ? { border: "border-amber-500/20", bg: "bg-amber-500/[0.04]", text: "text-amber-300/90" }
      : { border: "border-ecg/20", bg: "bg-ecg/[0.04]", text: "text-ecg" };
  return (
    <div className={cn("rounded-2xl border p-6", c.border, c.bg)}>
      <h3 className={cn("text-sm font-semibold", c.text)}>{title}</h3>
      <div className="mt-2 text-[13px] leading-relaxed text-slate-300">{children}</div>
    </div>
  );
}
