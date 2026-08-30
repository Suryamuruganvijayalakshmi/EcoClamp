// Anomaly detection engine (Layer 1 + 2 of the AI Analytics Architecture).
//
// Layer 1: statistical baseline deviation analysis.
// Layer 2: rule-based anomaly classification (duration + frequency aware).
// Layer 3 (Isolation Forest / Random Forest classification) is a documented
// roadmap item -- see AI_MODEL_STATUS below -- and is intentionally NOT
// simulated as "trained," because no labelled real industrial fault data
// exists yet. Overstating this would misrepresent the system.

import type { SeverityLevel } from "@/lib/types";

export interface AnomalyResult {
  deviationPct: number;
  severity: SeverityLevel;
  explanation: string;
}

/** Thresholds are intentionally simple percentages so they stay auditable. */
export const DEVIATION_THRESHOLDS = {
  // How far below baseline counts as "not consuming the baseline current" --
  // kept small (just enough to absorb ordinary sensor/reading noise right at
  // baseline) since ANY real shortfall below baseline should read as idle,
  // not just a large one.
  idle: 3, // %
  watch: 15, // %
  warning: 35,
  critical: 60,
};

export function analyzeDeviation(current: number, baseline: number): AnomalyResult {
  if (baseline <= 0) {
    return {
      deviationPct: 0,
      severity: "normal",
      explanation:
        "Baseline not yet established for this machine. Deviation analysis will begin once enough readings are collected.",
    };
  }

  const deviationPct = ((current - baseline) / baseline) * 100;
  const absDeviation = Math.abs(deviationPct);
  const direction = deviationPct >= 0 ? "above" : "below";

  // Only HIGH current (above baseline) is treated as a fault-risk escalation
  // (watch -> warning -> critical). Low current (below baseline) means the
  // machine is drawing less than its normal operating load -- that's an
  // idle condition, not a fault, so it gets its own non-escalating state
  // regardless of how far below baseline it drops.
  let severity: SeverityLevel = "normal";
  if (direction === "below") {
    if (absDeviation >= DEVIATION_THRESHOLDS.idle) severity = "idle";
  } else {
    if (absDeviation >= DEVIATION_THRESHOLDS.critical) severity = "critical";
    else if (absDeviation >= DEVIATION_THRESHOLDS.warning) severity = "warning";
    else if (absDeviation >= DEVIATION_THRESHOLDS.watch) severity = "watch";
  }

  const explanation = explain(severity, direction, absDeviation);

  return { deviationPct: round(deviationPct), severity, explanation };
}

function explain(severity: SeverityLevel, direction: "above" | "below", absDeviation: number): string {
  switch (severity) {
    case "critical":
      return `Current consumption is significantly ${direction} the established operating baseline (${round(
        absDeviation
      )}% deviation). This pattern typically indicates a serious operating condition.`;
    case "warning":
      return `Current consumption is ${direction} the normal operating range (${round(
        absDeviation
      )}% deviation). Sustained deviation of this size usually warrants inspection.`;
    case "watch":
      return `Current consumption is slightly ${direction} baseline (${round(
        absDeviation
      )}% deviation). This may be normal load variation -- continuing to monitor.`;
    case "idle":
      return `Current consumption is ${round(
        absDeviation
      )}% below the established baseline. The machine appears to be powered on but idle / not under normal load, rather than experiencing a fault.`;
    default:
      return "Current consumption is within the established normal operating range.";
  }
}

export interface EventWindow {
  recordedAt: string;
  currentAmps: number;
  severity: SeverityLevel;
}

export interface DetectedEvent {
  startTime: string;
  endTime: string | null;
  peakCurrent: number;
  durationMinutes: number;
  returnedToNormal: boolean;
}

/**
 * Scans a chronological window of readings (already scored with severity)
 * and identifies the current "abnormal increase" event, if any is active
 * or recently resolved. Powers the Event Timeline (section 16).
 */
export function detectCurrentEvent(window: EventWindow[]): DetectedEvent | null {
  if (window.length === 0) return null;

  // Find first "escalated" reading (watch/warning/critical -- a HIGH-current
  // event) scanning from the most recent point backwards until we hit a
  // "normal" or "idle" reading (the event boundary). Idle counts as a
  // boundary, not part of the event: low current is a different, non-fault
  // condition, not a continuation of an abnormal-increase event.
  let peak = -Infinity;
  let startIdx = -1;
  let endIdx = -1;

  for (let i = window.length - 1; i >= 0; i--) {
    const w = window[i];
    if (w.severity === "normal" || w.severity === "idle") {
      if (startIdx !== -1) break; // we've walked past the start of the event
      continue;
    }
    if (endIdx === -1) endIdx = i;
    startIdx = i;
    if (w.currentAmps > peak) peak = w.currentAmps;
  }

  if (startIdx === -1) return null;

  const start = window[startIdx];
  const last = window[window.length - 1];
  const lastSeverity = window[window.length - 1].severity;
  const isOngoing = lastSeverity !== "normal" && lastSeverity !== "idle";
  const end = isOngoing ? null : window[Math.min(endIdx + 1, window.length - 1)];

  const startTime = new Date(start.recordedAt).getTime();
  const endTime = end ? new Date(end.recordedAt).getTime() : new Date(last.recordedAt).getTime();
  const durationMinutes = Math.max(0, Math.round((endTime - startTime) / 60000));

  return {
    startTime: start.recordedAt,
    endTime: end ? end.recordedAt : null,
    peakCurrent: round(peak),
    durationMinutes,
    returnedToNormal: !isOngoing,
  };
}

function round(n: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

export interface TimelineEntry {
  time: string;
  currentAmps: number;
  severity: SeverityLevel;
  label: string;
}

/**
 * Builds the human-readable "Event Timeline" (section 16): one entry per
 * severity transition, not one per raw reading, so the timeline reads as a
 * story ("Normal -> increasing -> warning crossed -> sustained") rather
 * than a noisy log.
 */
export function buildEventTimeline(window: EventWindow[], maxEntries = 8): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  let lastSeverity: SeverityLevel | null = null;

  for (const w of window) {
    if (w.severity !== lastSeverity) {
      entries.push({
        time: w.recordedAt,
        currentAmps: w.currentAmps,
        severity: w.severity,
        label: transitionLabel(w.severity, lastSeverity),
      });
      lastSeverity = w.severity;
    }
  }

  return entries.slice(-maxEntries);
}

function transitionLabel(severity: SeverityLevel, from: SeverityLevel | null): string {
  if (from === null) return severity === "normal" ? "Normal operation" : "Monitoring started mid-event";
  switch (severity) {
    case "normal":
      return from === "idle" ? "Resumed normal load" : "Returned to normal operation";
    case "idle":
      return "Machine went idle (low current)";
    case "watch":
      return "Current increasing";
    case "warning":
      return "Warning threshold crossed";
    case "critical":
      return "Sustained abnormal consumption";
  }
}

export const AI_MODEL_STATUS = {
  layer1: "Active -- statistical baseline analysis (mean/std-dev, per machine).",
  layer2: "Active -- rule-based anomaly classification (deviation %, duration, frequency). Used as a warm-up fallback for a machine's first 20 readings, before Layer 3 has enough history to train on.",
  layer3:
    "Active -- Isolation Forest (unsupervised anomaly detection, Liu/Ting/Zhou 2008), trained fresh on " +
    "each machine's own accumulated current readings (current level + rate of change) once it has at " +
    "least 20 readings. It learns that machine's own normal operating pattern and scores how isolated " +
    "a reading is from it -- it is NOT trained on labelled real-world fault examples (none exist for " +
    "this project) and a high score is not a diagnosis of any specific failure, same as every other " +
    "layer here.",
};
