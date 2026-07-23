import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import { PerfProvider } from "@/components/perf";
import PerfToggle from "@/components/PerfToggle";
import { Aurora, GridPattern } from "@/components/ui";

export const metadata: Metadata = {
  title: "SilentGuard — ICU false-alarm intelligence",
  description:
    "Real-time ICU alarm triage: suppress false alarms without ever silencing a real emergency. Research prototype.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-mono antialiased">
        <PerfProvider>
          {/* ambient background: ECG-paper grid + drifting glows */}
          <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
            <GridPattern size={44} className="opacity-60" />
            <Aurora />
          </div>

          <div className="w-full border-b border-amber-500/20 bg-amber-500/[0.06] px-4 py-1.5 text-center text-[11px] text-amber-300/90">
            ⚠ Research prototype — NOT a cleared medical device. Every waveform and verdict is
            computed live by the SilentGuard engine on real PhysioNet/CinC-2015 records.
          </div>
          <Nav />
          {children}
          <PerfToggle />
        </PerfProvider>
      </body>
    </html>
  );
}
