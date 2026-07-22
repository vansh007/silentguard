"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface PerfState {
  reduced: boolean;
  setReduced: (v: boolean) => void;
}
const Ctx = createContext<PerfState>({ reduced: false, setReduced: () => {} });

export function PerfProvider({ children }: { children: React.ReactNode }) {
  const [reduced, setReducedState] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sg-reduced");
    if (saved != null) setReducedState(saved === "1");
    else if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setReducedState(true);
  }, []);

  const setReduced = (v: boolean) => {
    setReducedState(v);
    localStorage.setItem("sg-reduced", v ? "1" : "0");
  };

  return <Ctx.Provider value={{ reduced, setReduced }}>{children}</Ctx.Provider>;
}

export const usePerf = () => useContext(Ctx);
