import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import { PerfProvider } from "@/components/perf";
import PerfToggle from "@/components/PerfToggle";

export const metadata: Metadata = {
  title: "SilentGuard — ICU false-alarm intelligence",
  description:
    "Real-time ICU alarm triage: suppress false alarms without ever silencing a real emergency. Research prototype.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-mono antialiased">
        {/* ambient background: medical grid + soft glows */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.5]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(61,220,132,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(61,220,132,0.04) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              maskImage: "radial-gradient(circle at 50% 20%, black, transparent 75%)",
            }}
          />
          <div className="absolute -left-32 top-24 h-96 w-96 rounded-full bg-ecg/[0.06] blur-[120px]" />
          <div className="absolute -right-24 top-[60%] h-80 w-80 rounded-full bg-emerald-500/[0.05] blur-[120px]" />
        </div>

        <PerfProvider>
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
