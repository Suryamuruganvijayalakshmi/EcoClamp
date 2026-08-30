// Baseline learning engine.
// Computes a machine's normal operating envelope from historical current
// readings using plain statistics (average + standard deviation). This is
// intentionally transparent (no black-box ML) so operators can trust it.

import type { ConfidenceLevel } from "@/lib/types";

export interface BaselineResult {
  averageCurrent: number;
  stdDev: number;
  minNormal: number;
  maxNormal: number;
  sampleCount: number;
  confidence: ConfidenceLevel;
  status: "learning" | "established";
}

/**
 * Minimum samples required before a baseline can be considered "established".
 * Configurable per-machine via `baseline_sample_requirement`, this is the
 * platform default fallback.
 */
export const DEFAULT_BASELINE_SAMPLE_REQUIREMENT = 30;

export function computeBaseline(
  readings: number[],
  sampleRequirement: number = DEFAULT_BASELINE_SAMPLE_REQUIREMENT
): BaselineResult {
  const n = readings.length;

  if (n === 0) {
    return {
      averageCurrent: 0,
      stdDev: 0,
      minNormal: 0,
      maxNormal: 0,
      sampleCount: 0,
      confidence: "low",
      status: "learning",
    };
  }

  const average = readings.reduce((sum, v) => sum + v, 0) / n;
  const variance = readings.reduce((sum, v) => sum + (v - average) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  // Normal operating range: average +/- 1.5 standard deviations (with a
  // small floor so near-zero-variance machines still get a sane band).
  const spread = Math.max(stdDev * 1.5, average * 0.05);
  const minNormal = Math.max(0, average - spread);
  const maxNormal = average + spread;

  const coefficientOfVariation = average > 0 ? stdDev / average : 1;
  const confidence = getConfidence(n, coefficientOfVariation, sampleRequirement);
  const status: "learning" | "established" = n >= sampleRequirement ? "established" : "learning";

  return {
    averageCurrent: round(average),
    stdDev: round(stdDev),
    minNormal: round(minNormal),
    maxNormal: round(maxNormal),
    sampleCount: n,
    confidence,
    status,
  };
}

function getConfidence(
  sampleCount: number,
  coefficientOfVariation: number,
  sampleRequirement: number
): ConfidenceLevel {
  // Confidence is a function of BOTH how much data we have and how
  // consistent (low-noise) that data is. Lots of noisy data still only
  // earns "medium".
  const dataRatio = sampleCount / sampleRequirement;

  if (dataRatio >= 1 && coefficientOfVariation < 0.12) return "high";
  if (dataRatio >= 0.5 && coefficientOfVariation < 0.25) return "medium";
  return "low";
}

function round(n: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
