import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // clinical dark palette
        ink: "#05070a",
        panel: "#0d1117",
        hair: "#1c2530",
        ecg: "#3ddc84",
        suppress: "#ef4444",
        keep: "#22c55e",
        defer: "#f59e0b",
        muted: "#7d8794",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(61,220,132,0.45)",
        "glow-sm": "0 0 20px -6px rgba(61,220,132,0.4)",
        lift: "0 20px 60px -24px rgba(0,0,0,0.9)",
      },
      keyframes: {
        "pulse-soft": {
          "0%,100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(250%)" },
        },
        // each duplicated group carries its own trailing gap as padding,
        // so a full -100% shift lines the copies up seamlessly.
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-100%)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        meteor: {
          "0%": { transform: "rotate(215deg) translateX(0)", opacity: "1" },
          "70%": { opacity: "1" },
          "100%": { transform: "rotate(215deg) translateX(-520px)", opacity: "0" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "beam-x": {
          "0%": { transform: "translateX(-110%)", opacity: "0" },
          "18%,82%": { opacity: "1" },
          "100%": { transform: "translateX(110%)", opacity: "0" },
        },
        blink: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.25" },
        },
      },
      animation: {
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        shimmer: "shimmer 2.2s ease-in-out infinite",
        marquee: "marquee var(--duration, 32s) linear infinite",
        "spin-slow": "spin-slow 4s linear infinite",
        meteor: "meteor var(--dur, 5s) linear infinite",
        float: "float 6s ease-in-out infinite",
        "beam-x": "beam-x 2.6s ease-in-out infinite",
        blink: "blink 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
