// Resource conservation engine (sections 20-21).
// Computes "Potential Avoidable Energy" (never "guaranteed saved energy")
// and a 0-100 Resource Conservation Score from observed waste patterns.

import { estimatePowerKw, type EnergyAssumptions } from "./energy";
import { DEVIATION_THRESHOLDS } from "./anomaly";

export interface ConservationBreakdown {
  abnormalKwh: number;
  idleKwh: number;
  potentialAvoidableKwh: number;
  abnormalEventCount: number;
  idleEventCount: number;
}

type Classification = "abnormal" | "idle" | "normal";

/**
 * Walks a chronological reading series and classifies each interval as
 * abnormal (well above baseline -- likely a fault/inefficiency), idle
 * (drawing some current but far below normal operating load -- machine
 * "on" but not doing productive work), or normal. Adjacent same-class
 * intervals are merged into a single "event" for counting purposes.
 */
export function computeMachineConservation(
  readingsAsc: { current_amps: number; recorded_at: string }[],
  baselineAvg: number,
  assumptions: EnergyAssumptions
): ConservationBreakdown {
  let abnormalKwh = 0;
  let idleKwh = 0;
  let abnormalEventCount = 0;
  let idleEventCount = 0;
  let lastClass: Classification | null = null;

  const baselinePowerKw = baselineAvg > 0 ? estimatePowerKw(baselineAvg, assumptions) : 0;

  for (let i = 1; i < readingsAsc.length; i++) {
    const prev = readingsAsc[i - 1];
    const curr = readingsAsc[i];
    const durationHours = (new Date(curr.recorded_at).getTime() - new Date(prev.recorded_at).getTime()) / 3_600_000;
    if (durationHours <= 0 || durationHours > 1) continue; // skip gaps > 1h (sensor offline, not a real interval)

    if (baselineAvg <= 0) continue;
    const ratio = curr.current_amps / baselineAvg;
    const deviationPct = Math.abs(((curr.current_amps - baselineAvg) / baselineAvg) * 100);

    let cls: Classification = "normal";
    if (deviationPct >= DEVIATION_THRESHOLDS.warning) cls = "abnormal";
    else if (ratio > 0.05 && ratio < 0.35) cls = "idle";

    if (cls === "abnormal") {
      const excessKw = Math.max(0, estimatePowerKw(curr.current_amps, assumptions) - baselinePowerKw);
      abnormalKwh += excessKw * durationHours;
      if (lastClass !== "abnormal") abnormalEventCount++;
    } else if (cls === "idle") {
      idleKwh += estimatePowerKw(curr.current_amps, assumptions) * durationHours;
      if (lastClass !== "idle") idleEventCount++;
    }
    lastClass = cls;
  }

  return {
    abnormalKwh: round(abnormalKwh, 3),
    idleKwh: round(idleKwh, 3),
    potentialAvoidableKwh: round(abnormalKwh + idleKwh, 3),
    abnormalEventCount,
    idleEventCount,
  };
}

export interface WasteEvent {
  excessPowerKw: number; // power above baseline-equivalent power
  durationHours: number;
}

export function potentialAvoidableEnergyKwh(events: WasteEvent[]): number {
  const total = events.reduce((sum, e) => sum + Math.max(0, e.excessPowerKw) * e.durationHours, 0);
  return round(total, 2);
}

export interface ConservationScoreInput {
  abnormalEventCount: number; // in scoring window (e.g. last 7 days)
  idleEventCount: number;
  repeatedWasteEventCount: number; // same machine, recurring
  improvedAfterAction: boolean; // observed reduction recorded after an operator action
}

export interface ConservationScoreResult {
  score: number;
  label: string;
  factors: string[];
}

export function computeConservationScore(input: ConservationScoreInput): ConservationScoreResult {
  let score = 100;
  const factors: string[] = [];

  if (input.abnormalEventCount > 0) {
    const penalty = Math.min(35, input.abnormalEventCount * 5);
    score -= penalty;
    factors.push(`${input.abnormalEventCount} abnormal consumption event(s) this period`);
  }

  if (input.idleEventCount > 0) {
    const penalty = Math.min(20, input.idleEventCount * 4);
    score -= penalty;
    factors.push(`${input.idleEventCount} idle-consumption event(s) detected`);
  }

  if (input.repeatedWasteEventCount > 0) {
    const penalty = Math.min(20, input.repeatedWasteEventCount * 7);
    score -= penalty;
    factors.push(`${input.repeatedWasteEventCount} recurring waste pattern(s) on the same machine(s)`);
  }

  if (input.improvedAfterAction) {
    score += 10;
    factors.push("Measured reduction observed after operator action");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  if (factors.length === 0) {
    factors.push("No significant waste events recorded this period");
  }

  return { score, label: scoreLabel(score), factors };
}

function scoreLabel(score: number): string {
  if (score >= 85) return "EXCELLENT 🌱";
  if (score >= 70) return "GOOD 🌱";
  if (score >= 50) return "FAIR 🟡";
  return "NEEDS ATTENTION 🟠";
}

function round(n: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
