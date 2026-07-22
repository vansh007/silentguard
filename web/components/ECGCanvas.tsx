"use client";

import { useEffect, useRef } from "react";

/** Static real-ECG renderer: grid + trace + QRS beat markers. */
export default function ECGCanvas({
  samples,
  beats,
  height = 120,
  color = "#3ddc84",
}: {
  samples: number[];
  beats?: number[];
  height?: number;
  color?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const draw = () => {
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const W = cv.clientWidth;
      const H = height;
      cv.width = W * dpr;
      cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      // grid
      ctx.strokeStyle = "rgba(61,220,132,0.06)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 22) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += 22) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      const n = samples.length;
      if (!n) return;
      const step = W / n;
      const mid = H / 2;
      const amp = H * 0.36;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = i * step;
        const y = mid - samples[i] * amp;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = "rgba(120,180,255,0.85)";
      (beats ?? []).forEach((b) => {
        if (b < n) {
          const x = b * step;
          const y = mid - samples[b] * amp;
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, 7);
          ctx.fill();
        }
      });
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(cv);
    return () => ro.disconnect();
  }, [samples, beats, height, color]);

  return <canvas ref={ref} className="block w-full" style={{ height }} />;
}
