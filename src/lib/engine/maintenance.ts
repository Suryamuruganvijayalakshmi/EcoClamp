// Maintenance recommendation engine (section 17) -- three honest tiers.
// Never claims a specific component has failed; only recommends inspection
// depth based on observed pattern severity/persistence.

import type { MaintenanceTier, SeverityLevel } from "@/lib/types";

export interface MaintenanceInput {
  severity: SeverityLevel;
  sustainedMinutes: number;
  anomalyCountLast24h: number;
}

export interface MaintenanceResult {
  tier: MaintenanceTier;
  label: string;
  recommendation: string;
}

export function recommendMaintenance(input: MaintenanceInput): MaintenanceResult {
  const { severity, sustainedMinutes, anomalyCountLast24h } = input;

  if (severity === "critical" && (sustainedMinutes >= 15 || anomalyCountLast24h >= 3)) {
    return {
      tier: "urgent_inspection",
      label: "🔴 URGENT INSPECTION",
      recommendation:
        "A large sustained deviation or multiple critical events have occurred. Inspect the machine promptly according to site safety procedures.",
    };
  }

  if (severity === "warning" || severity === "critical" || (severity === "watch" && anomalyCountLast24h >= 4)) {
    return {
      tier: "service_recommended",
      label: "🟡 SERVICE RECOMMENDED",
      recommendation:
        "Repeated or sustained abnormal patterns have occurred. Schedule a maintenance inspection.",
    };
  }

  return {
    tier: "general_checkup",
    label: "🟢 GENERAL CHECKUP",
    recommendation:
      "Small or temporary abnormal patterns occurred. Check machine load and operating conditions during the next scheduled inspection.",
  };
}
