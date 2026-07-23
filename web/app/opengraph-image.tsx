import { ImageResponse } from "next/og";

/** Link-preview card. Rendered at build time — no external assets (CSP-safe). */
export const runtime = "edge";
export const alt = "SilentGuard — ICU false-alarm intelligence";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px",
          background: "#05070a",
          backgroundImage:
            "radial-gradient(ellipse at 20% 0%, rgba(61,220,132,0.18), transparent 55%)",
          color: "#e6edf3",
          fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
          <svg width="64" height="32" viewBox="0 0 64 32">
            <path
              d="M2 16h12l6-12 8 24 6-16 5 8h23"
              fill="none"
              stroke="#3ddc84"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span style={{ fontSize: 30, color: "#3ddc84", letterSpacing: 2 }}>SILENTGUARD</span>
        </div>

        <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1 }}>
          Every ICU heartbeat tells a story.
        </div>
        <div style={{ fontSize: 44, color: "#7d8794", marginTop: 10 }}>
          Not every alarm tells the truth.
        </div>

        <div style={{ display: "flex", gap: 18, marginTop: 48 }}>
          {[
            ["SUPPRESS", "#ef4444"],
            ["KEEP", "#22c55e"],
            ["DEFER", "#f59e0b"],
          ].map(([label, color]) => (
            <div
              key={label}
              style={{
                display: "flex",
                fontSize: 24,
                color,
                border: `2px solid ${color}55`,
                background: `${color}18`,
                borderRadius: 12,
                padding: "10px 22px",
              }}
            >
              {label}
            </div>
          ))}
        </div>

        <div style={{ fontSize: 22, color: "#7d8794", marginTop: 44 }}>
          Research prototype · PhysioNet/CinC 2015 · Team Sentinel, VIT Chennai
        </div>
      </div>
    ),
    size
  );
}
