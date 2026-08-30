// Machine Health Score engine.
// Produces a transparent 0-100 "operational health indicator" -- explicitly
// NOT a certified mechanical diagnosis (section 14).

import type { ConfidenceLevel, MachineStatus, SeverityLevel } from "@/lib/types";

export interface HealthInputs {
  latestDeviationPct: number;
  anomalyCountLastHour: number;
  sustainedAnomalyMinutes: number; // longest ongoing/recent anomaly duration
  trend: "increasing" | "decreasing" | "stable";
  dataConfidence: ConfidenceLevel;
}

export interface HealthResult {
  score: number;
  status: MachineStatus;
  reasons: string[];
}

export function computeHealthScore(inputs: HealthInputs): HealthResult {
  let score = 100;
  const reasons: string[] = [];

  // Only a HIGH current reading (above baseline) is treated as a fault-risk
  // signal for health scoring. Low current (below baseline) means the
  // machine is idle, not faulty, so it doesn't penalize health here -- it's
  // reported separately as an "idle" severity/status, not folded into this
  // score the way an overcurrent event is.
  const absDeviation = Math.max(0, inputs.latestDeviationPct);
  if (absDeviation >= 60) {
    score -= 40;
    reasons.push(`Sustained high-deviation event detected (${round(absDeviation)}% above baseline)`);
  } else if (absDeviation >= 35) {
    score -= 25;
    reasons.push(`Current deviation above warning threshold (${round(absDeviation)}% above baseline)`);
  } else if (absDeviation >= 15) {
    score -= 10;
    reasons.push(`Minor deviation above baseline observed (${round(absDeviation)}%)`);
  }

  if (inputs.anomalyCountLastHour > 0) {
    const penalty = Math.min(25, inputs.anomalyCountLastHour * 6);
    score -= penalty;
    reasons.push(
      `${inputs.anomalyCountLastHour} abnormal event${inputs.anomalyCountLastHour === 1 ? "" : "s"} detected in the last hour`
    );
  }

  if (inputs.sustainedAnomalyMinutes >= 30) {
    score -= 15;
    reasons.push(`Abnormal current sustained for ${inputs.sustainedAnomalyMinutes} minutes`);
  } else if (inputs.sustainedAnomalyMinutes >= 10) {
    score -= 8;
    reasons.push(`Abnormal current sustained for ${inputs.sustainedAnomalyMinutes} minutes`);
  }

  if (inputs.trend === "increasing") {
    score -= 8;
    reasons.push("Current trend is increasing");
  } else if (inputs.trend === "decreasing" && absDeviation > 15) {
    reasons.push("Current trend is decreasing toward baseline");
    score += 3;
  }

  if (inputs.dataConfidence === "low") {
    score -= 5;
    reasons.push("Data confidence is low -- score may shift as more readings arrive");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  if (reasons.length === 0) {
    reasons.push("Operating within established baseline with no recent anomalies");
  }

  return { score, status: statusFromScore(score), reasons };
}

export function statusFromScore(score: number): MachineStatus {
  if (score >= 90) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "attention";
  if (score >= 30) return "poor";
  return "critical";
}

export const STATUS_LABEL: Record<MachineStatus, string> = {
  excellent: "EXCELLENT 🟢",
  good: "GOOD 🟢",
  attention: "ATTENTION 🟡",
  poor: "POOR 🟠",
  critical: "CRITICAL 🔴",
  offline: "OFFLINE ⚪",
};

export const SEVERITY_LABEL: Record<SeverityLevel, string> = {
  normal: "NORMAL 🟢",
  idle: "IDLE 💤",
  watch: "WATCH 🟡",
  warning: "WARNING 🟠",
  critical: "CRITICAL 🔴",
};

function round(n: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
