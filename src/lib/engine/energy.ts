// Energy calculation engine.
// Everything here is derived from CURRENT ONLY (the CT sensor measures
// amps, not power directly), so every output is explicitly labelled
// ESTIMATED with its assumptions shown (section 18-19).

import type { PhaseType } from "@/lib/types";

export const DEFAULT_VOLTAGE_ASSUMPTION = 230; // V, single-phase India LV standard
export const DEFAULT_VOLTAGE_ASSUMPTION_3PHASE = 415; // V line-to-line, India LV standard
export const DEFAULT_POWER_FACTOR_ASSUMPTION = 0.9;

export interface EnergyAssumptions {
  voltage: number;
  powerFactor: number;
  phaseType: PhaseType;
}

/** Estimated real power in kW from a single current reading. */
export function estimatePowerKw(currentAmps: number, assumptions: EnergyAssumptions): number {
  const { voltage, powerFactor, phaseType } = assumptions;
  let watts: number;
  if (phaseType === "three") {
    watts = Math.sqrt(3) * voltage * currentAmps * powerFactor;
  } else {
    watts = voltage * currentAmps * powerFactor;
  }
  return round(watts / 1000, 3);
}

/** Estimated energy (kWh == "Units" in India) for a duration at a given average current. */
export function estimateEnergyKwh(
  avgCurrentAmps: number,
  hours: number,
  assumptions: EnergyAssumptions
): number {
  const powerKw = estimatePowerKw(avgCurrentAmps, assumptions);
  return round(powerKw * hours, 3);
}

/**
 * Integrates a series of (current, durationHours) samples into total kWh.
 * Use this instead of avg*totalHours when reading intervals are uneven.
 */
export function integrateEnergyKwh(
  samples: { currentAmps: number; durationHours: number }[],
  assumptions: EnergyAssumptions
): number {
  const total = samples.reduce((sum, s) => sum + estimatePowerKw(s.currentAmps, assumptions) * s.durationHours, 0);
  return round(total, 3);
}

export function defaultAssumptions(phaseType: PhaseType = "single"): EnergyAssumptions {
  return {
    voltage: phaseType === "three" ? DEFAULT_VOLTAGE_ASSUMPTION_3PHASE : DEFAULT_VOLTAGE_ASSUMPTION,
    powerFactor: DEFAULT_POWER_FACTOR_ASSUMPTION,
    phaseType,
  };
}

export interface TimedCurrentReading {
  recorded_at: string;
  current_amps: number;
}

/** Buckets a chronological reading series into hourly estimated-kWh totals for trend charts. */
export function bucketEnergyByHour(
  readingsAsc: TimedCurrentReading[],
  assumptions: EnergyAssumptions
): { bucketStart: number; kwh: number }[] {
  if (readingsAsc.length === 0) return [];

  const buckets = new Map<number, number>();
  for (let i = 0; i < readingsAsc.length; i++) {
    const r = readingsAsc[i];
    const t = new Date(r.recorded_at).getTime();
    const prevT = i === 0 ? t : new Date(readingsAsc[i - 1].recorded_at).getTime();
    const durationHours = i === 0 ? 0 : (t - prevT) / 3_600_000;
    const bucketKey = Math.floor(t / 3_600_000) * 3_600_000;
    const kwh = estimatePowerKw(r.current_amps, assumptions) * durationHours;
    buckets.set(bucketKey, (buckets.get(bucketKey) || 0) + kwh);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([bucketStart, kwh]) => ({ bucketStart, kwh: round(kwh, 3) }));
}

function round(n: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
