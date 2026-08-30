// AI Demo Simulation generator (section 27).
// Produces a single synthetic current reading for a given scenario and
// elapsed time. Every value produced here MUST be persisted with
// source = "simulation" -- never mixed with live device data.

import type { SimulationScenario } from "@/lib/types";

export interface SimulateParams {
  scenario: SimulationScenario;
  baselineCurrent: number; // machine's learned/rated baseline to simulate around
  elapsedSeconds: number; // time since scenario was started
}

/** Small deterministic-ish pseudo-noise so the graph looks organic without being chaotic. */
function noise(seed: number, amplitude: number): number {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return (v - Math.floor(v) - 0.5) * 2 * amplitude;
}

export function generateSimulatedCurrent(params: SimulateParams): number {
  const { scenario, baselineCurrent, elapsedSeconds } = params;
  const base = baselineCurrent > 0 ? baselineCurrent : 4;
  const t = elapsedSeconds;

  let value: number;

  switch (scenario) {
    case "normal_operation": {
      value = base + noise(t, base * 0.06);
      break;
    }
    case "high_energy_consumption": {
      // Ramps up over ~5 minutes to ~50% above baseline, then holds.
      const rampProgress = Math.min(1, t / 300);
      value = base * (1 + 0.5 * rampProgress) + noise(t, base * 0.05);
      break;
    }
    case "sustained_abnormal_event": {
      // Spikes quickly to ~75-90% above baseline and stays there.
      const rampProgress = Math.min(1, t / 90);
      value = base * (1 + 0.8 * rampProgress) + noise(t, base * 0.08);
      break;
    }
    case "idle_consumption": {
      // Low but continuous current (machine "on" but not doing work).
      value = base * 0.22 + noise(t, base * 0.03);
      break;
    }
    case "gradual_degradation": {
      // Slow creep upward over a long simulated window (~30 min to +40%).
      const rampProgress = Math.min(1, t / 1800);
      value = base * (1 + 0.4 * rampProgress) + noise(t, base * 0.05);
      break;
    }
    default:
      value = base;
  }

  return Math.max(0, Math.round(value * 100) / 100);
}

export const SCENARIO_DESCRIPTIONS: Record<SimulationScenario, string> = {
  normal_operation: "Generates values around the machine's baseline current.",
  high_energy_consumption: "Generates a steady ramp to elevated current over several minutes.",
  sustained_abnormal_event: "Generates a rapid spike to high current, sustained over time.",
  idle_consumption: "Generates low but continuous current, as during unproductive idle time.",
  gradual_degradation: "Generates slowly increasing current over a longer simulated period.",
};
