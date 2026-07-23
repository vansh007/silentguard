"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/**
 * Optional audio, synthesised with the Web Audio API — no audio files, nothing to load,
 * and nothing that could be mistaken for a recording of a real patient.
 *
 * Off by default: a page that makes noise unprompted is hostile, and a page that imitates
 * a medical alarm needs the user to opt in.
 */

interface SoundCtx {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  alarm: () => void;
  verdict: (decision: "suppress" | "keep" | "defer") => void;
  beat: () => void;
}

const Ctx = createContext<SoundCtx>({
  enabled: false,
  setEnabled: () => {},
  alarm: () => {},
  verdict: () => {},
  beat: () => {},
});

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const acRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (localStorage.getItem("sg-sound") === "1") setEnabledState(true);
  }, []);

  const setEnabled = (v: boolean) => {
    setEnabledState(v);
    localStorage.setItem("sg-sound", v ? "1" : "0");
    if (v) ctx(); // create/resume inside the click gesture so autoplay policy is satisfied
  };

  const ctx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    const AC = window.AudioContext ?? (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!acRef.current) acRef.current = new AC();
    if (acRef.current.state === "suspended") void acRef.current.resume();
    return acRef.current;
  }, []);

  /** One shaped tone. `type` picks the timbre; gain is kept deliberately low. */
  const tone = useCallback(
    (freq: number, start: number, dur: number, peak = 0.14, type: OscillatorType = "sine") => {
      const ac = ctx();
      if (!ac) return;
      const t0 = ac.currentTime + start;
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    },
    [ctx]
  );

  /** A low "lub-dub" — two thumps, the second softer, like a heart sound. */
  const beat = useCallback(() => {
    if (!enabled) return;
    tone(58, 0, 0.16, 0.16, "sine");
    tone(44, 0.16, 0.2, 0.1, "sine");
  }, [enabled, tone]);

  /** The classic three-pulse bedside alarm burst. */
  const alarm = useCallback(() => {
    if (!enabled) return;
    for (let i = 0; i < 3; i++) tone(880, i * 0.16, 0.1, 0.12, "square");
  }, [enabled, tone]);

  /** A short cue per decision: falling = silenced, rising = alert, flat pair = review. */
  const verdict = useCallback(
    (decision: "suppress" | "keep" | "defer") => {
      if (!enabled) return;
      if (decision === "suppress") {
        tone(620, 0, 0.16, 0.1);
        tone(410, 0.14, 0.26, 0.09);
      } else if (decision === "keep") {
        tone(520, 0, 0.14, 0.11);
        tone(780, 0.13, 0.24, 0.11);
      } else {
        tone(560, 0, 0.13, 0.09);
        tone(560, 0.19, 0.13, 0.09);
      }
    },
    [enabled, tone]
  );

  return (
    <Ctx.Provider value={{ enabled, setEnabled, alarm, verdict, beat }}>{children}</Ctx.Provider>
  );
}

export const useSound = () => useContext(Ctx);

/** Floating mute switch, paired with the motion toggle. */
export function SoundToggle() {
  const { enabled, setEnabled } = useSound();
  return (
    <button
      onClick={() => setEnabled(!enabled)}
      aria-pressed={enabled}
      title="Synthesised alarm and verdict cues (off by default)"
      className="fixed bottom-4 right-[168px] z-50 flex items-center gap-2 rounded-full border border-white/10 bg-panel/80 px-3.5 py-2 text-[11px] text-slate-300 shadow-lift backdrop-blur-xl transition hover:border-ecg/40 hover:text-white"
    >
      {enabled ? "🔊 Sound: on" : "🔇 Sound: off"}
    </button>
  );
}
