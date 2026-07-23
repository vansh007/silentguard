"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * A glowing heart-shaped particle cloud that beats on a cardiac rhythm.
 *
 * Pass `beatTimes` — the QRS times our detector actually found in a real record — and the
 * heart contracts on that patient's real inter-beat intervals, irregularities included.
 * `bpm` is only the fallback for when the engine is unreachable.
 */
export type HeartMode = "beating" | "alarm" | "analysing" | "verdict";

function heartXY(t: number): [number, number] {
  const x = 16 * Math.pow(Math.sin(t), 3);
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  return [x, y];
}

// Cardiac-ish envelope: fast contraction, slower relaxation, brief diastole.
function beatEnvelope(phase: number): number {
  if (phase < 0.12) return Math.sin((phase / 0.12) * Math.PI * 0.5); // rise
  if (phase < 0.34) return Math.cos(((phase - 0.12) / 0.22) * Math.PI * 0.5); // fall
  return 0;
}

/**
 * Phase within the current beat, driven by real QRS times.
 * Loops the recorded window seamlessly; returns null if the times are unusable.
 */
function phaseFromBeats(beatTimes: number[], elapsed: number): number | null {
  const n = beatTimes.length;
  if (n < 3) return null;
  const t0 = beatTimes[0];
  const span = beatTimes[n - 1] - t0;
  if (!(span > 0)) return null;

  const t = t0 + (elapsed % span);
  for (let i = n - 2; i >= 0; i--) {
    if (t >= beatTimes[i]) {
      const rr = beatTimes[i + 1] - beatTimes[i];
      return rr > 0 ? (t - beatTimes[i]) / rr : null;
    }
  }
  return null;
}

function HeartPoints({
  bpm = 72,
  beatTimes,
  reduced = false,
  mode = "beating",
  accent = "#4dffa0",
}: {
  bpm?: number;
  beatTimes?: number[];
  reduced?: boolean;
  mode?: HeartMode;
  accent?: string;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);
  const count = reduced ? 1400 : 6000;

  // eased weights so a mode change is a transition, not a jump
  const wChaos = useRef(0);
  const wThink = useRef(0);
  const colCur = useRef(new THREE.Color(accent));
  const colTgt = useMemo(() => new THREE.Color(accent), [accent]);

  const { positions, home, noise, lattice } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const home = new Float32Array(count * 3);
    const noise = new Float32Array(count * 3);   // scatter offsets for the alarm
    const lattice = new Float32Array(count * 3); // shell the particles form while analysing
    for (let i = 0; i < count; i++) {
      const t = Math.random() * Math.PI * 2;
      const [hx, hy] = heartXY(t);
      const r = Math.sqrt(Math.random()); // fill toward the edge
      const scale = 0.062;
      const x = hx * scale * r + (Math.random() - 0.5) * 0.06;
      const y = hy * scale * r + (Math.random() - 0.5) * 0.06 + 0.15;
      // volumetric depth: thicker near the center, tapering out
      const z = (Math.random() - 0.5) * 0.55 * (1 - r) + (Math.random() - 0.5) * 0.08;
      positions.set([x, y, z], i * 3);
      home.set([x, y, z], i * 3);
      noise.set(
        [(Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5],
        i * 3
      );
      // fibonacci sphere -> an even "scanning" shell
      const k = i + 0.5;
      const phi = Math.acos(1 - (2 * k) / count);
      const theta = Math.PI * (1 + Math.sqrt(5)) * k;
      const R = 1.15;
      lattice.set(
        [R * Math.cos(theta) * Math.sin(phi), R * Math.sin(theta) * Math.sin(phi) + 0.15, R * Math.cos(phi)],
        i * 3
      );
    }
    return { positions, home, noise, lattice };
  }, [count]);

  useFrame((state, delta) => {
    const pts = pointsRef.current;
    if (!pts) return;
    const time = state.clock.elapsedTime;
    // real inter-beat intervals when we have them; a steady rate only as fallback
    const realPhase = beatTimes ? phaseFromBeats(beatTimes, time) : null;
    const phase = realPhase ?? (time * (bpm / 60)) % 1;
    const env = beatEnvelope(phase);

    // ease the mode weights (exponential smoothing, frame-rate independent)
    const k = 1 - Math.exp(-delta * 3.2);
    wChaos.current += ((mode === "alarm" ? 1 : 0) - wChaos.current) * k;
    wThink.current += ((mode === "analysing" ? 1 : 0) - wThink.current) * k;
    const chaos = wChaos.current;
    const think = wThink.current;

    const pulse = 1 + 0.09 * env * (1 - think);
    pts.rotation.y = reduced ? 0.35 : Math.sin(time * 0.12) * 0.5 + think * time * 0.35;
    pts.scale.setScalar(pulse);

    const pos = pts.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const push = env * 0.05 * (1 - think);
    const jitter = chaos * (0.35 + 0.25 * Math.sin(time * 11));

    for (let i = 0; i < count; i++) {
      const j = i * 3;
      const hx = home[j], hy = home[j + 1], hz = home[j + 2];
      const d = Math.hypot(hx, hy, hz) || 1;
      // beating: radial emission on the QRS
      let x = hx + (hx / d) * push;
      let y = hy + (hy / d) * push;
      let z = hz + (hz / d) * push;
      // alarm: the form scatters
      if (chaos > 0.001) {
        x += noise[j] * jitter;
        y += noise[j + 1] * jitter;
        z += noise[j + 2] * jitter;
      }
      // analysing: particles migrate onto a scanning shell
      if (think > 0.001) {
        x += (lattice[j] - x) * think;
        y += (lattice[j + 1] - y) * think;
        z += (lattice[j + 2] - z) * think;
      }
      arr[j] = x;
      arr[j + 1] = y;
      arr[j + 2] = z;
    }
    pos.needsUpdate = true;

    if (matRef.current) {
      colCur.current.lerp(colTgt, k);
      matRef.current.color.copy(colCur.current);
      matRef.current.opacity = 0.55 + 0.4 * env * (1 - think) + 0.2 * think;
      matRef.current.size = (reduced ? 0.03 : 0.025) + 0.012 * env + 0.008 * chaos;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        color="#4dffa0"
        size={0.026}
        sizeAttenuation
        transparent
        opacity={0.7}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function ParticleHeart({
  bpm = 72,
  beatTimes,
  reduced = false,
  mode = "beating",
  accent = "#4dffa0",
}: {
  bpm?: number;
  beatTimes?: number[];
  reduced?: boolean;
  /** Narrative state: normal rhythm, alarm scatter, engine analysing, verdict settled. */
  mode?: HeartMode;
  /** Particle colour — carries the decision colour once a verdict lands. */
  accent?: string;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.2], fov: 45 }}
      dpr={reduced ? 1 : [1, 2]}
      gl={{ antialias: !reduced, alpha: true }}
      frameloop={reduced ? "demand" : "always"}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#05070a"]} />
      <HeartPoints bpm={bpm} beatTimes={beatTimes} reduced={reduced} mode={mode} accent={accent} />
    </Canvas>
  );
}
