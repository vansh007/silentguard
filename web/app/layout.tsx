import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import { PerfProvider } from "@/components/perf";
import PerfToggle from "@/components/PerfToggle";
import { Aurora, GridPattern } from "@/components/ui";

// Prose in a display sans; every measured number stays monospaced so digits line up.
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

const SITE = "SilentGuard — ICU false-alarm intelligence";
const DESC =
  "Real-time ICU alarm triage: suppress false alarms without ever silencing a real emergency. A research prototype on PhysioNet/CinC 2015.";

export const metadata: Metadata = {
  title: { default: SITE, template: "%s" },
  description: DESC,
  applicationName: "SilentGuard",
  authors: [{ name: "Team Sentinel, VIT Chennai" }],
  keywords: [
    "ICU", "false alarm", "alarm fatigue", "arrhythmia", "ECG",
    "PhysioNet", "CinC 2015", "machine learning", "healthcare",
  ],
  openGraph: { title: SITE, description: DESC, type: "website", siteName: "SilentGuard" },
  twitter: { card: "summary_large_image", title: SITE, description: DESC },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen font-sans antialiased">
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
