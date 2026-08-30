// Power Quality insight engine (new).
//
// Why this exists: the ESP32 firmware already computes crest factor and
// mains frequency on-device from the raw current waveform, on every single
// reading (see firmware/ecoclamp_esp32.ino), and sends them alongside
// current_amps to /api/ingest -- but until now the app only ever STORED
// them (onboard_crest_factor / onboard_frequency_hz in energy_readings),
// it never interpreted or displayed them. This module closes that gap.
//
// What these two signals can and can't tell you:
// - Crest factor (peak / RMS) is ~1.414 (sqrt(2)) for a clean, undistorted
//   sine wave. A load's crest factor rising well above ITS OWN normal
//   baseline can indicate waveform distortion -- harmonics, a failing motor
//   winding, or an unstable connection. It is a signal worth a look, not a
//   certified fault diagnosis -- same honesty scoping as every other layer
//   in this project (see AI_MODEL_STATUS in anomaly.ts).
// - Frequency should track the local grid closely (50 Hz in India). A
//   sustained drift usually says more about the power SOURCE (an unstable
//   generator or, in a hotspot-powered demo rig, the inverter) than about
//   the machine -- but a sudden shift lining up with a current anomaly is
//   still useful corroborating evidence, not proof of anything on its own.
//
// Consistent with the rest of this project's design: quality is judged
// against THIS MACHINE'S OWN learned history (not one fixed universal
// threshold), the same baseline-learning philosophy used for current.
// This is deliberately kept separate from the core severity engine
// (anomaly.ts / mlAnomaly.ts) -- it's advisory context, not folded into
// health/severity scoring, matching the schema comment that onboard
// diagnostics are "never treated as an authoritative diagnosis."

export interface PowerQualityReading {
  crestFactor: number | null; // onboard_crest_factor
  frequencyHz: number | null; // onboard_frequency_hz
  recordedAt: string;
}

export type QualityStatus = "unavailable" | "learning" | "stable" | "watch" | "concern";

export interface PowerQualitySignal {
  status: QualityStatus;
  latest: number | null;
  baselineAvg: number | null;
  deviationPct: number | null; // vs this machine's own learned baseline
  referenceValue: number; // the theoretical/nominal reference point, for context
  sampleCount: number;
}

export interface PowerQualitySnapshot {
  overallStatus: QualityStatus;
  crestFactor: PowerQualitySignal;
  frequency: PowerQualitySignal;
  explanation: string;
}

export const MIN_SAMPLES_FOR_QUALITY = 10;
const IDEAL_CREST_FACTOR = 1.414; // sqrt(2) -- pure sine wave reference
const NOMINAL_FREQUENCY_HZ = 50; // India grid nominal

const WATCH_PCT = 8;
const CONCERN_PCT = 18;

const STATUS_RANK: Record<QualityStatus, number> = {
  unavailable: 0,
  learning: 1,
  stable: 2,
  watch: 3,
  concern: 4,
};
const RANK_STATUS: QualityStatus[] = ["unavailable", "learning", "stable", "watch", "concern"];

function classifyByDeviation(deviationPct: number): QualityStatus {
  const abs = Math.abs(deviationPct);
  if (abs >= CONCERN_PCT) return "concern";
  if (abs >= WATCH_PCT) return "watch";
  return "stable";
}

function computeSignal(values: number[], referenceValue: number): PowerQualitySignal {
  const n = values.length;
  if (n === 0) {
    return { status: "unavailable", latest: null, baselineAvg: null, deviationPct: null, referenceValue, sampleCount: 0 };
  }
  if (n < MIN_SAMPLES_FOR_QUALITY) {
    return {
      status: "learning",
      latest: round(values[n - 1]),
      baselineAvg: null,
      deviationPct: null,
      referenceValue,
      sampleCount: n,
    };
  }

  const avg = values.reduce((s, v) => s + v, 0) / n;
  const latest = values[n - 1];
  const deviationPct = avg > 0 ? ((latest - avg) / avg) * 100 : 0;

  return {
    status: classifyByDeviation(deviationPct),
    latest: round(latest),
    baselineAvg: round(avg),
    deviationPct: round(deviationPct),
    referenceValue,
    sampleCount: n,
  };
}

function explain(
  overall: QualityStatus,
  crestFactor: PowerQualitySignal,
  frequency: PowerQualitySignal
): string {
  if (overall === "unavailable") {
    return "This machine's firmware isn't reporting crest factor or frequency yet -- power-quality insight needs the onboard ESP32 diagnostics fields, which aren't present for this data (e.g. simulation data, or older firmware).";
  }
  if (overall === "learning") {
    const need = Math.max(0, MIN_SAMPLES_FOR_QUALITY - Math.min(crestFactor.sampleCount, crestFactor.sampleCount || frequency.sampleCount));
    return `Learning this machine's normal power-quality pattern (needs ${MIN_SAMPLES_FOR_QUALITY} readings with onboard diagnostics, has ${Math.max(crestFactor.sampleCount, frequency.sampleCount)} so far). No insight yet -- ${need > 0 ? `${need} more to go.` : "almost there."}`;
  }

  const parts: string[] = [];
  if (crestFactor.status === "concern" || crestFactor.status === "watch") {
    parts.push(
      `crest factor is ${crestFactor.deviationPct! >= 0 ? "up" : "down"} ${Math.abs(crestFactor.deviationPct!).toFixed(1)}% from this machine's own baseline (${crestFactor.baselineAvg} vs a clean-sine reference of ~${IDEAL_CREST_FACTOR}) -- worth a look for waveform distortion (harmonics, winding wear, a loose connection), though this alone isn't a diagnosis`
    );
  }
  if (frequency.status === "concern" || frequency.status === "watch") {
    parts.push(
      `frequency has drifted ${Math.abs(frequency.deviationPct!).toFixed(1)}% from this machine's own recent average (${frequency.baselineAvg} Hz, grid nominal ~${NOMINAL_FREQUENCY_HZ} Hz) -- more often a sign of an unstable power source than the machine itself`
    );
  }

  if (parts.length === 0) {
    return `Crest factor and frequency are both consistent with this machine's own established pattern -- no waveform-distortion or supply-instability signal right now.`;
  }
  return `Power-quality signal: ${parts.join("; ")}.`;
}

export function computePowerQualitySnapshot(readingsAsc: PowerQualityReading[]): PowerQualitySnapshot {
  const crestValues = readingsAsc.map((r) => r.crestFactor).filter((v): v is number => v != null && v > 0);
  const freqValues = readingsAsc.map((r) => r.frequencyHz).filter((v): v is number => v != null && v > 0);

  const crestFactor = computeSignal(crestValues, IDEAL_CREST_FACTOR);
  const frequency = computeSignal(freqValues, NOMINAL_FREQUENCY_HZ);

  const overallRank = Math.max(STATUS_RANK[crestFactor.status], STATUS_RANK[frequency.status]);
  const overallStatus = RANK_STATUS[overallRank];

  return {
    overallStatus,
    crestFactor,
    frequency,
    explanation: explain(overallStatus, crestFactor, frequency),
  };
}

function round(n: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
