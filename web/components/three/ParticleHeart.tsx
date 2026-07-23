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
}: {
  bpm?: number;
  beatTimes?: number[];
  reduced?: boolean;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);
  const count = reduced ? 1400 : 6000;

  const { positions, home } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const home = new Float32Array(count * 3);
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
    }
    return { positions, home };
  }, [count]);

  useFrame((state) => {
    const pts = pointsRef.current;
    if (!pts) return;
    const time = state.clock.elapsedTime;
    // real inter-beat intervals when we have them; a steady rate only as fallback
    const realPhase = beatTimes ? phaseFromBeats(beatTimes, time) : null;
    const phase = realPhase ?? (time * (bpm / 60)) % 1;
    const env = beatEnvelope(phase);
    const pulse = 1 + 0.09 * env;

    pts.rotation.y = reduced ? 0.35 : Math.sin(time * 0.12) * 0.5;
    pts.scale.setScalar(pulse);

    // subtle outward "emission" of particles on the beat
    const pos = pts.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const push = env * 0.05;
    for (let i = 0; i < count; i++) {
      const j = i * 3;
      const hx = home[j], hy = home[j + 1], hz = home[j + 2];
      const d = Math.hypot(hx, hy, hz) || 1;
      arr[j] = hx + (hx / d) * push;
      arr[j + 1] = hy + (hy / d) * push;
      arr[j + 2] = hz + (hz / d) * push;
    }
    pos.needsUpdate = true;

    if (matRef.current) {
      matRef.current.opacity = 0.55 + 0.4 * env;
      matRef.current.size = (reduced ? 0.03 : 0.025) + 0.012 * env;
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
}: {
  bpm?: number;
  beatTimes?: number[];
  reduced?: boolean;
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
      <HeartPoints bpm={bpm} beatTimes={beatTimes} reduced={reduced} />
    </Canvas>
  );
}
