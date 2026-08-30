// Short-term trend forecasting engine (section 15).
// Uses simple linear regression over recent readings -- honest about being
// a trend extrapolation, not a trained time-series model, and confidence
// is explicitly tied to how much consistent recent data exists.

import type { ConfidenceLevel } from "@/lib/types";

export interface ForecastPoint {
  minutesAhead: number;
  expectedCurrent: number;
}

export interface ForecastResult {
  trend: "increasing" | "decreasing" | "stable";
  slopePerMinute: number;
  next15min: ForecastPoint;
  next60min: ForecastPoint;
  next24h: ForecastPoint;
  estimatedRangeLow: number;
  estimatedRangeHigh: number;
  confidence: ConfidenceLevel;
}

export interface TimedReading {
  recordedAt: string;
  currentAmps: number;
}

export function forecastTrend(readings: TimedReading[]): ForecastResult | null {
  if (readings.length < 3) return null;

  const sorted = [...readings].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );
  const t0 = new Date(sorted[0].recordedAt).getTime();

  // x = minutes since first reading, y = current
  const points = sorted.map((r) => ({
    x: (new Date(r.recordedAt).getTime() - t0) / 60000,
    y: r.currentAmps,
  }));

  const { slope, intercept, rSquared } = linearRegression(points);

  const lastX = points[points.length - 1].x;
  const lastY = points[points.length - 1].y;

  const project = (minutesAhead: number): number => {
    const value = slope * (lastX + minutesAhead) + intercept;
    return round(Math.max(0, value));
  };

  const trend: ForecastResult["trend"] =
    Math.abs(slope) < 0.005 * Math.max(1, lastY) ? "stable" : slope > 0 ? "increasing" : "decreasing";

  const noise = stdDevOfResiduals(points, slope, intercept);
  const band = Math.max(noise * 1.2, lastY * 0.05);

  const next60 = project(60);
  const rangeLow = round(Math.max(0, next60 - band));
  const rangeHigh = round(next60 + band);

  const confidence = getForecastConfidence(points.length, rSquared);

  return {
    trend,
    slopePerMinute: round(slope, 4),
    next15min: { minutesAhead: 15, expectedCurrent: project(15) },
    next60min: { minutesAhead: 60, expectedCurrent: project(60) },
    next24h: { minutesAhead: 1440, expectedCurrent: project(1440) },
    estimatedRangeLow: rangeLow,
    estimatedRangeHigh: rangeHigh,
    confidence,
  };
}

function linearRegression(points: { x: number; y: number }[]) {
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);

  const denominator = n * sumXX - sumX * sumX;
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  const meanY = sumY / n;
  const ssTot = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
  const ssRes = points.reduce((s, p) => s + (p.y - (slope * p.x + intercept)) ** 2, 0);
  const rSquared = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

  return { slope, intercept, rSquared };
}

function stdDevOfResiduals(points: { x: number; y: number }[], slope: number, intercept: number): number {
  const residuals = points.map((p) => p.y - (slope * p.x + intercept));
  const mean = residuals.reduce((s, r) => s + r, 0) / residuals.length;
  const variance = residuals.reduce((s, r) => s + (r - mean) ** 2, 0) / residuals.length;
  return Math.sqrt(variance);
}

function getForecastConfidence(sampleCount: number, rSquared: number): ConfidenceLevel {
  if (sampleCount >= 40 && rSquared >= 0.6) return "high";
  if (sampleCount >= 15 && rSquared >= 0.3) return "medium";
  return "low";
}

function round(n: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
