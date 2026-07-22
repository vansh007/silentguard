// Typed client for the SilentGuard FastAPI service. Everything here maps to REAL engine output.

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "http://127.0.0.1:8000";

export type Decision = "suppress" | "keep" | "defer";

export interface Reason {
  feature: string;
  contribution_to_true: number; // signed SHAP toward TRUE; negative => toward SUPPRESS
}

export interface Verdict {
  record_id: string;
  arrhythmia: string;
  p_true: number;
  p_false: number;
  decision: Decision;
  confidence: number;
  reasons: Reason[];
  latency_used_s: number;
  true_label: 0 | 1 | null; // ground truth, shown for honesty only
}

export interface DemoRecord {
  id: string;
  note: string;
  arrhythmia?: string;
  true_label?: 0 | 1 | null;
  decision?: Decision;
  p_false?: number;
  confidence?: number;
  error?: string;
}

export async function fetchRecords(): Promise<DemoRecord[]> {
  const r = await fetch(`${API_BASE}/api/records`, { cache: "no-store" });
  if (!r.ok) throw new Error(`records ${r.status}`);
  const d = await r.json();
  return d.records as DemoRecord[];
}

export async function fetchAnalysis(id: string): Promise<Verdict> {
  const r = await fetch(`${API_BASE}/api/records/${id}/analysis`, { cache: "no-store" });
  if (!r.ok) throw new Error(`analysis ${r.status}`);
  return (await r.json()) as Verdict;
}

export function streamUrl(id: string, speed = 3, seconds = 24): string {
  const ws = API_BASE.replace(/^http/, "ws");
  return `${ws}/ws/stream/${id}?speed=${speed}&seconds=${seconds}`;
}

// WebSocket message shapes
export type StreamMsg =
  | { type: "meta"; channel: string; fs: number; total: number; beats: number[]; analysis_window_s: number; arrhythmia: string; seconds: number }
  | { type: "samples"; i: number; v: number[] }
  | { type: "alarm"; arrhythmia: string }
  | ({ type: "verdict" } & Verdict)
  | { type: "error"; detail: string };

export const DECISION_META: Record<Decision, { label: string; sub: string; color: string }> = {
  suppress: { label: "SUPPRESS", sub: "confident false alarm — silenced", color: "#ef4444" },
  keep: { label: "KEEP", sub: "likely real — reaches the nurse", color: "#22c55e" },
  defer: { label: "DEFER", sub: "uncertain — routed to a human", color: "#f59e0b" },
};
