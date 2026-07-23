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

// ---- Arrhythmia Explainer ----
export interface ExplainerCard {
  type: string;
  record: string;
  name: string;
  criterion: string;
  clinical: string;
  false_hint: string;
  arrhythmia?: string;
  true_label?: 0 | 1 | null;
  decision?: Decision;
  confidence?: number;
  p_false?: number;
  error?: string;
}

export async function fetchExplainer(): Promise<ExplainerCard[]> {
  const r = await fetch(`${API_BASE}/api/explainer`, { cache: "no-store" });
  if (!r.ok) throw new Error(`explainer ${r.status}`);
  return (await r.json()).cards as ExplainerCard[];
}

export interface WaveformData {
  channel: string | null;
  fs: number;
  seconds?: number;
  samples: number[];
  beats: number[];
  analysis_window_s?: number;
  arrhythmia?: string;
}

export async function fetchWaveform(id: string, seconds = 10): Promise<WaveformData> {
  const r = await fetch(`${API_BASE}/api/records/${id}/waveform?seconds=${seconds}`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`waveform ${r.status}`);
  return (await r.json()) as WaveformData;
}

// ---- Results ----
export interface ResultsData {
  available: boolean;
  summary: Record<string, string>[];
  loao: Record<string, string>[];
  safety: Record<string, string>[];
  figures: string[];
}

export async function fetchResults(): Promise<ResultsData> {
  const r = await fetch(`${API_BASE}/api/results`, { cache: "no-store" });
  if (!r.ok) throw new Error(`results ${r.status}`);
  return (await r.json()) as ResultsData;
}

export const figureUrl = (name: string) => `${API_BASE}/figures/${name}`;

// ---- Health (live engine status indicator) ----
export interface Health {
  status: "ok" | "degraded";
  model_loaded: boolean;
  detail: string;
  n_demo_records: number;
}

export async function fetchHealth(): Promise<Health> {
  const r = await fetch(`${API_BASE}/health`, { cache: "no-store" });
  if (!r.ok) throw new Error(`health ${r.status}`);
  return (await r.json()) as Health;
}

// ---- Per-record leak-free predictions (powers the interactive safety dial) ----
export interface OofData {
  available: boolean;
  detail?: string;
  n: number;
  records: string[];
  arrhythmia: string[];
  label: number[]; // 1 = TRUE alarm, 0 = FALSE
  models: Record<string, { p_true_indist: (number | null)[]; p_true_loao: (number | null)[] }>;
  note?: string;
}

export async function fetchOof(): Promise<OofData> {
  const r = await fetch(`${API_BASE}/api/oof`, { cache: "no-store" });
  if (!r.ok) throw new Error(`oof ${r.status}`);
  return (await r.json()) as OofData;
}

// ---- Grad-CAM temporal saliency (where the CNN looked) ----
export interface SaliencyData {
  record_id: string;
  arrhythmia: string | null;
  window_seconds: number;
  fs: number;
  target: number; // 1 = evidence for TRUE alarm, 0 = for FALSE
  p_true: number;
  n_conv_steps: number;
  saliency: number[]; // 0..1, evenly spaced across the analysis window
}

export async function fetchSaliency(id: string, points = 400): Promise<SaliencyData> {
  const r = await fetch(`${API_BASE}/api/records/${id}/saliency?points=${points}`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`saliency ${r.status}`);
  return (await r.json()) as SaliencyData;
}

// ---- Real QRS timing (drives the hero heart's rhythm) ----
export interface HeartbeatData {
  record_id: string;
  arrhythmia?: string | null;
  true_label?: 0 | 1 | null;
  fs: number;
  seconds: number;
  beat_times_s: number[];
  bpm: number | null;
  n_beats: number;
  error?: string;
}

export async function fetchHeartbeat(record = "a604s"): Promise<HeartbeatData> {
  const r = await fetch(`${API_BASE}/api/heartbeat?record=${record}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`heartbeat ${r.status}`);
  return (await r.json()) as HeartbeatData;
}
