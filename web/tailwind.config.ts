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
      keyframes: {
        "pulse-soft": {
          "0%,100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
