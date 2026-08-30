// EcoClamp Layer 3 -- trained anomaly detection (replaces fixed-percentage
// severity thresholds with a real Isolation Forest, trained fresh per
// machine on that machine's own accumulated readings).
//
// Important scope note, consistent with this project's honesty rules
// elsewhere (see AI_MODEL_STATUS below): this model is trained on each
// machine's own UNLABELLED operating history. It learns "what this specific
// machine's normal current pattern looks like" and flags statistical
// outliers against it. It is NOT trained on labelled real-world fault
// examples (none exist for this project), and a high anomaly score is not a
// diagnosis of any specific failure -- same as every other layer here.

import type { SeverityLevel } from "@/lib/types";
import type { BaselineResult } from "./baseline";
import { analyzeDeviation, DEVIATION_THRESHOLDS } from "./anomaly";
import { fitIsolationForest, isolationScore, type FeatureVector } from "./isolationForest";

export interface MlReading {
  current_amps: number;
  recorded_at: string;
}

// Below this many readings there isn't enough history to fit a meaningful
// forest -- fall back to the simple statistical-deviation rule (Layer 1/2)
// until enough data accrues, same threshold philosophy as baseline learning.
export const MIN_SAMPLES_FOR_ML = 20;

// Score -> severity cut points. Unlike DEVIATION_THRESHOLDS (a fixed % of
// the reading itself), these are cut points on the *trained model's own
// output distribution* -- calibrated against the isolation-score paper's
// convention that ~0.5 is "typical" and >0.6 is "increasingly isolated."
export const ML_SCORE_THRESHOLDS = { watch: 0.55, warning: 0.62, critical: 0.7 };

export interface MlPoint {
  recordedAt: string;
  currentAmps: number;
  severity: SeverityLevel;
  mlScore: number | null; // null while the model is still warming up
}

export interface MachineMlResult {
  severityWindow: MlPoint[];
  modelTrained: boolean;
  modelSampleCount: number;
  latest: {
    severity: SeverityLevel;
    deviationPct: number;
    mlScore: number | null;
    explanation: string;
  };
}

function buildFeatures(readingsAsc: MlReading[], baseline: BaselineResult): FeatureVector[] {
  // Guard against a near-zero std dev (a dead-flat baseline) blowing up the
  // z-scores -- floor it the same way baseline.ts floors its normal-range
  // spread (max of std dev or 5% of the average).
  const std = baseline.stdDev > 0.001 ? baseline.stdDev : Math.max(0.001, baseline.averageCurrent * 0.05);

  return readingsAsc.map((r, i) => {
    const zCurrent = (r.current_amps - baseline.averageCurrent) / std;

    let zRate = 0;
    if (i > 0) {
      const prev = readingsAsc[i - 1];
      const minutes = Math.max(0.05, (new Date(r.recorded_at).getTime() - new Date(prev.recorded_at).getTime()) / 60000);
      zRate = (r.current_amps - prev.current_amps) / (std * minutes);
    }

    return [zCurrent, zRate];
  });
}

// Isolation Forest scores isolation, not direction -- a reading far BELOW
// baseline is just as "isolated" as one far above it. But direction matters
// a lot more than the score does here: if the machine simply isn't drawing
// its baseline current, that's idle, full stop -- it doesn't need to look
// "statistically unusual" to the forest to count (a machine idling steadily
// for a while can look perfectly "normal" to an isolation score, since nothing
// about it is erratic -- but it's still not consuming baseline current, so it
// should still read as idle). Only for a reading AT OR ABOVE baseline does
// the score decide whether it's unusual enough to escalate watch/warning/critical.
function severityFromScore(score: number, belowBaseline: boolean): SeverityLevel {
  if (belowBaseline) return "idle";
  if (score < ML_SCORE_THRESHOLDS.watch) return "normal";
  if (score >= ML_SCORE_THRESHOLDS.critical) return "critical";
  if (score >= ML_SCORE_THRESHOLDS.warning) return "warning";
  return "watch";
}

function explainMl(severity: SeverityLevel, score: number, deviationPct: number): string {
  const direction = deviationPct >= 0 ? "above" : "below";
  const pct = Math.abs(deviationPct).toFixed(1);
  switch (severity) {
    case "critical":
      return `Isolation Forest flags this as a strong statistical outlier (anomaly score ${score.toFixed(2)}) against this machine's own learned operating pattern -- ${pct}% ${direction} baseline. Investigate promptly.`;
    case "warning":
      return `Isolation Forest flags this reading as unusual (anomaly score ${score.toFixed(2)}) relative to this machine's learned normal pattern -- ${pct}% ${direction} baseline.`;
    case "watch":
      return `Isolation Forest flags a mild deviation from this machine's typical pattern (anomaly score ${score.toFixed(2)}) -- ${pct}% ${direction} baseline. Worth watching.`;
    case "idle":
      return `Current is ${pct}% below this machine's learned baseline (anomaly score ${score.toFixed(2)}). The machine appears powered on but idle / under no load, rather than experiencing a fault.`;
    default:
      return `Reading is consistent with this machine's learned normal operating pattern (anomaly score ${score.toFixed(2)}).`;
  }
}

function round(n: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

/**
 * Fits ONE Isolation Forest on the whole reading window and scores every
 * point with it (fit once, score many) -- so callers building an event
 * timeline or counting anomalies over dozens/hundreds of readings don't
 * refit per point. `seedKey` should be stable per machine (its id) so the
 * deterministic PRNG gives a stable score across re-renders of the same
 * underlying data, rather than the severity badge flickering on pure luck
 * of the random splits.
 */
export function classifyMachineWindow(readingsAsc: MlReading[], baseline: BaselineResult, seedKey: string): MachineMlResult {
  const n = readingsAsc.length;
  const currentValue = readingsAsc[n - 1]?.current_amps ?? 0;
  const deviationPct = baseline.averageCurrent > 0 ? round(((currentValue - baseline.averageCurrent) / baseline.averageCurrent) * 100, 1) : 0;

  if (n < MIN_SAMPLES_FOR_ML || baseline.averageCurrent <= 0) {
    const severityWindow: MlPoint[] = readingsAsc.map((r) => ({
      recordedAt: r.recorded_at,
      currentAmps: r.current_amps,
      severity: analyzeDeviation(r.current_amps, baseline.averageCurrent).severity,
      mlScore: null,
    }));
    const fallback = analyzeDeviation(currentValue, baseline.averageCurrent);
    return {
      severityWindow,
      modelTrained: false,
      modelSampleCount: n,
      latest: {
        severity: fallback.severity,
        deviationPct,
        mlScore: null,
        explanation:
          n === 0
            ? fallback.explanation
            : `${fallback.explanation} Isolation Forest model is still warming up (${n}/${MIN_SAMPLES_FOR_ML} readings needed) -- using statistical baseline comparison until then.`,
      },
    };
  }

  const features = buildFeatures(readingsAsc, baseline);
  const forest = fitIsolationForest(features, { seedKey: `${seedKey}:${n}` });

  const severityWindow: MlPoint[] = readingsAsc.map((r, i) => {
    const score = round(isolationScore(forest, features[i]), 3);
    // Same small noise tolerance as the rule-based layer (DEVIATION_THRESHOLDS.idle)
    // so a reading essentially AT baseline doesn't flicker in and out of idle.
    const belowBaseline =
      baseline.averageCurrent > 0 &&
      ((baseline.averageCurrent - r.current_amps) / baseline.averageCurrent) * 100 >= DEVIATION_THRESHOLDS.idle;
    return {
      recordedAt: r.recorded_at,
      currentAmps: r.current_amps,
      severity: severityFromScore(score, belowBaseline),
      mlScore: score,
    };
  });

  const last = severityWindow[severityWindow.length - 1];

  return {
    severityWindow,
    modelTrained: true,
    modelSampleCount: n,
    latest: {
      severity: last.severity,
      deviationPct,
      mlScore: last.mlScore,
      explanation: explainMl(last.severity, last.mlScore ?? 0, deviationPct),
    },
  };
}
