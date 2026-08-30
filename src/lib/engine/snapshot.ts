// Combines every engine layer into one per-machine snapshot — the single
// source of truth consumed by Overview, AI Intelligence, Machine detail,
// and Alerts generation, so every page agrees on the same numbers.

import { computeBaseline, DEFAULT_BASELINE_SAMPLE_REQUIREMENT, type BaselineResult } from "./baseline";
import { detectCurrentEvent, type DetectedEvent } from "./anomaly";
import { classifyMachineWindow } from "./mlAnomaly";
import { computeHealthScore, type HealthResult } from "./health";
import { estimatePowerKw, integrateEnergyKwh, defaultAssumptions } from "./energy";
import { forecastTrend, type ForecastResult } from "./forecast";
import { recommendMaintenance, type MaintenanceResult } from "./maintenance";
import { computeMachineConservation, type ConservationBreakdown } from "./conservation";
import type { DataSource, Machine, SeverityLevel } from "@/lib/types";

export interface ReadingLike {
  current_amps: number;
  recorded_at: string;
  source: DataSource;
}

export interface MachineSnapshot {
  machine: Machine;
  hasData: boolean;
  latest: ReadingLike | null;
  source: DataSource | null;
  isOnline: boolean;
  baseline: BaselineResult;
  deviationPct: number;
  severity: SeverityLevel;
  explanation: string;
  mlScore: number | null;
  mlModelTrained: boolean;
  mlModelSampleCount: number;
  health: HealthResult;
  event: DetectedEvent | null;
  forecast: ForecastResult | null;
  maintenance: MaintenanceResult;
  estimatedPowerKw: number;
  estimatedEnergyTodayKwh: number;
  anomalyCountLastHour: number;
  anomalyCountLast24h: number;
  conservation: ConservationBreakdown;
}

const ONLINE_WINDOW_MS = 5 * 60 * 1000; // no reading in 5 min => offline

export function computeMachineSnapshot(machine: Machine, allReadingsDesc: ReadingLike[]): MachineSnapshot {
  // readingsDesc: most-recent-first, at least covering the last ~24h ideally
  //
  // If the operator reset this machine's baseline (Live Energy page), ignore
  // every reading recorded before that point -- for baseline, anomaly
  // detection, health, forecast, everything. This is what "reset" means:
  // the AI re-learns the machine's normal behavior from scratch, without
  // deleting any historical readings from the database.
  const readingsDesc = machine.baseline_reset_at
    ? allReadingsDesc.filter((r) => new Date(r.recorded_at).getTime() >= new Date(machine.baseline_reset_at!).getTime())
    : allReadingsDesc;
  const readingsAsc = [...readingsDesc].reverse();
  const latest = readingsDesc[0] || null;
  const hasData = readingsAsc.length > 0;

  const sampleRequirement = machine.baseline_sample_requirement || DEFAULT_BASELINE_SAMPLE_REQUIREMENT;
  const baseline = computeBaseline(
    readingsAsc.map((r) => r.current_amps),
    sampleRequirement
  );

  const currentValue = latest?.current_amps ?? 0;

  // Layer 3: one Isolation Forest fit per snapshot recompute, trained on
  // this machine's own reading history, scoring every point in the window
  // in the same pass (see mlAnomaly.ts). Falls back to the simple
  // statistical-deviation rule for a machine's first 20 readings.
  const ml = classifyMachineWindow(readingsAsc, baseline, machine.id);
  const { deviationPct, severity, explanation, mlScore } = ml.latest;
  const severityWindow = ml.severityWindow;

  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  // "idle" (low current, below baseline) is deliberately excluded here -- it
  // is not a fault/anomaly, just a different operating mode, so it should
  // not count against health score or trigger maintenance recommendations
  // the way a genuine high-current anomaly does.
  const isAnomalous = (severity: SeverityLevel) => severity !== "normal" && severity !== "idle";
  const anomalyCountLastHour = severityWindow.filter(
    (w) => isAnomalous(w.severity) && new Date(w.recordedAt).getTime() >= oneHourAgo
  ).length;
  const anomalyCountLast24h = severityWindow.filter(
    (w) => isAnomalous(w.severity) && new Date(w.recordedAt).getTime() >= oneDayAgo
  ).length;

  const event = detectCurrentEvent(severityWindow.slice(-120));

  const trend: "increasing" | "decreasing" | "stable" = (() => {
    if (readingsAsc.length < 5) return "stable";
    const recent = readingsAsc.slice(-10);
    const firstHalf = recent.slice(0, Math.ceil(recent.length / 2));
    const secondHalf = recent.slice(Math.ceil(recent.length / 2));
    const avg = (arr: ReadingLike[]) => arr.reduce((s, r) => s + r.current_amps, 0) / arr.length;
    const diff = avg(secondHalf) - avg(firstHalf);
    if (Math.abs(diff) < baseline.averageCurrent * 0.03) return "stable";
    return diff > 0 ? "increasing" : "decreasing";
  })();

  const health = computeHealthScore({
    latestDeviationPct: deviationPct,
    anomalyCountLastHour,
    sustainedAnomalyMinutes: event?.durationMinutes ?? 0,
    trend,
    dataConfidence: baseline.confidence,
  });

  const maintenance = recommendMaintenance({
    severity,
    sustainedMinutes: event?.durationMinutes ?? 0,
    anomalyCountLast24h,
  });

  const forecast = forecastTrend(
    readingsAsc.slice(-60).map((r) => ({ recordedAt: r.recorded_at, currentAmps: r.current_amps }))
  );

  const assumptions = defaultAssumptions(machine.phase_type);
  const estimatedPowerKw = estimatePowerKw(currentValue, {
    ...assumptions,
    powerFactor: machine.power_factor_assumption || assumptions.powerFactor,
  });

  const isOnline = !!latest && now - new Date(latest.recorded_at).getTime() <= ONLINE_WINDOW_MS;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todaysReadings = readingsAsc.filter((r) => new Date(r.recorded_at).getTime() >= startOfToday.getTime());
  const todaySamples = todaysReadings.map((r, i) => {
    const prevTime = i === 0 ? startOfToday.getTime() : new Date(todaysReadings[i - 1].recorded_at).getTime();
    const durationHours = Math.max(0, (new Date(r.recorded_at).getTime() - prevTime) / 3_600_000);
    return { currentAmps: r.current_amps, durationHours };
  });
  const estimatedEnergyTodayKwh = integrateEnergyKwh(todaySamples, {
    ...assumptions,
    powerFactor: machine.power_factor_assumption || assumptions.powerFactor,
  });

  const conservation = computeMachineConservation(readingsAsc, baseline.averageCurrent, {
    ...assumptions,
    powerFactor: machine.power_factor_assumption || assumptions.powerFactor,
  });

  return {
    machine,
    hasData,
    latest,
    source: latest?.source ?? null,
    isOnline,
    baseline,
    deviationPct,
    severity: hasData ? severity : "normal",
    explanation,
    mlScore,
    mlModelTrained: ml.modelTrained,
    mlModelSampleCount: ml.modelSampleCount,
    health,
    event,
    forecast,
    maintenance,
    estimatedPowerKw,
    estimatedEnergyTodayKwh,
    anomalyCountLastHour,
    anomalyCountLast24h,
    conservation,
  };
}
