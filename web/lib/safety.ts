/**
 * Faithful TypeScript port of `src/silentguard/models/safety.py`.
 *
 * The interactive safety dial recomputes the operating point in the browser from the
 * real per-record out-of-fold predictions served by `/api/oof`. To keep that honest it
 * must reproduce the Python decision layer exactly — same threshold rule, same tie
 * handling, same reported quantities. Any change here must be mirrored there.
 *
 * Convention (identical to the engine): `pFalse` = P(alarm is FALSE); `y` is 1 = TRUE
 * alarm, 0 = FALSE alarm.
 *   pFalse >= tHigh          -> SUPPRESS
 *   pFalse <= tLow           -> KEEP
 *   tLow < pFalse < tHigh    -> DEFER
 */

export type SafetyDecision = "suppress" | "keep" | "defer";

export interface Thresholds {
  tHigh: number;
  tLow: number;
}

export interface SafetyReport extends Thresholds {
  trueSensitivity: number; // fraction of TRUE alarms NOT suppressed — must stay >= floor
  faSuppression: number; // fraction of FALSE alarms silenced
  deferRate: number;
  keepPpv: number;
  nKeep: number;
  nSuppress: number;
  nDefer: number;
  suppressedTrue: number;
  suppressedFalse: number;
  n: number;
}

const EPS = 1e-9;

/** Port of `safety.calibrate_thresholds` — pick (tHigh, tLow) for a sensitivity floor. */
export function calibrateThresholds(pFalse: number[], y: number[], floor: number): Thresholds {
  const truePf = pFalse.filter((_, i) => y[i] === 1).sort((a, b) => a - b);
  const falsePf = pFalse.filter((_, i) => y[i] === 0).sort((a, b) => a - b);

  let tHigh: number;
  if (truePf.length === 0) {
    tHigh = 0.9;
  } else {
    const kTrue = Math.floor((1 - floor) * truePf.length); // allowed missed true alarms
    tHigh = kTrue <= 0 ? truePf[truePf.length - 1] + EPS : truePf[truePf.length - kTrue];
  }

  let tLow: number;
  if (falsePf.length === 0) {
    tLow = 0.1;
  } else {
    const kFalse = Math.floor((1 - floor) * falsePf.length);
    tLow = kFalse <= 0 ? falsePf[0] - EPS : falsePf[kFalse - 1];
  }

  return { tHigh, tLow: Math.min(tLow, tHigh) };
}

/** Port of `safety.decide`. */
export function decide(pFalse: number, tHigh: number, tLow: number): SafetyDecision {
  if (pFalse >= tHigh) return "suppress";
  if (pFalse <= tLow) return "keep";
  return "defer";
}

/** Port of `safety.safety_report` — summarise one operating point. */
export function safetyReport(
  pFalse: number[],
  y: number[],
  tHigh: number,
  tLow: number
): SafetyReport {
  const dec = pFalse.map((p) => decide(p, tHigh, tLow));

  let nTrue = 0,
    nFalse = 0,
    suppressedTrue = 0,
    suppressedFalse = 0,
    nKeep = 0,
    nSuppress = 0,
    nDefer = 0,
    keepTrue = 0;

  for (let i = 0; i < y.length; i++) {
    const isTrue = y[i] === 1;
    isTrue ? nTrue++ : nFalse++;
    if (dec[i] === "suppress") {
      nSuppress++;
      isTrue ? suppressedTrue++ : suppressedFalse++;
    } else if (dec[i] === "keep") {
      nKeep++;
      if (isTrue) keepTrue++;
    } else nDefer++;
  }

  return {
    tHigh,
    tLow,
    trueSensitivity: nTrue ? 1 - suppressedTrue / nTrue : NaN,
    faSuppression: nFalse ? suppressedFalse / nFalse : NaN,
    deferRate: y.length ? nDefer / y.length : NaN,
    keepPpv: nKeep ? keepTrue / nKeep : NaN,
    nKeep,
    nSuppress,
    nDefer,
    suppressedTrue,
    suppressedFalse,
    n: y.length,
  };
}

/**
 * Sweep the SUPPRESS threshold across all observed probabilities.
 * Mirrors `_safety_curve` in `scripts/make_figures.py` (the source of fig3).
 */
export function safetyCurve(
  pFalse: number[],
  y: number[]
): Array<{ t: number; sens: number; supp: number }> {
  const nTrue = y.reduce((a, v) => a + (v === 1 ? 1 : 0), 0);
  const nFalse = y.length - nTrue;
  if (!nTrue || !nFalse) return [];

  const cuts = Array.from(new Set([0, ...pFalse, 1.0001])).sort((a, b) => a - b);
  const out = cuts.map((t) => {
    let st = 0,
      sf = 0;
    for (let i = 0; i < y.length; i++) {
      if (pFalse[i] >= t) (y[i] === 1 ? st++ : sf++);
    }
    return { t, sens: 1 - st / nTrue, supp: sf / nFalse };
  });
  return out.sort((a, b) => a.sens - b.sens);
}

/** Challenge score — the asymmetric official metric, FN weighted 5x. */
export function challengeScore(y: number[], keep: number[], fnPenalty = 5): number {
  let tp = 0,
    tn = 0,
    fp = 0,
    fn = 0;
  for (let i = 0; i < y.length; i++) {
    if (y[i] === 1 && keep[i] === 1) tp++;
    else if (y[i] === 0 && keep[i] === 0) tn++;
    else if (y[i] === 0 && keep[i] === 1) fp++;
    else fn++;
  }
  const denom = tp + tn + fp + fnPenalty * fn;
  return denom ? (tp + tn) / denom : NaN;
}
