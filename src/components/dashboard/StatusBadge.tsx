import { Badge } from "@/components/ui/Badge";
import type { MachineStatus, SeverityLevel, MaintenanceTier, ConfidenceLevel, DataSource } from "@/lib/types";
import type { QualityStatus } from "@/lib/engine/powerQuality";

const statusTone: Record<MachineStatus, "good" | "warning" | "serious" | "critical" | "neutral"> = {
  excellent: "good",
  good: "good",
  attention: "warning",
  poor: "serious",
  critical: "critical",
  offline: "neutral",
};

const statusText: Record<MachineStatus, string> = {
  excellent: "EXCELLENT",
  good: "GOOD",
  attention: "ATTENTION",
  poor: "POOR",
  critical: "CRITICAL",
  offline: "OFFLINE",
};

const statusEmoji: Record<MachineStatus, string> = {
  excellent: "🟢",
  good: "🟢",
  attention: "🟡",
  poor: "🟠",
  critical: "🔴",
  offline: "⚪",
};

export function MachineStatusBadge({ status, className }: { status: MachineStatus; className?: string }) {
  return (
    <Badge tone={statusTone[status]} className={className}>
      {statusEmoji[status]} {statusText[status]}
    </Badge>
  );
}

const severityTone: Record<SeverityLevel, "good" | "warning" | "serious" | "critical" | "neutral"> = {
  normal: "good",
  idle: "neutral",
  watch: "warning",
  warning: "serious",
  critical: "critical",
};

const severityText: Record<SeverityLevel, string> = {
  normal: "NORMAL",
  idle: "IDLE",
  watch: "WATCH",
  warning: "WARNING",
  critical: "CRITICAL",
};

const severityEmoji: Record<SeverityLevel, string> = {
  normal: "🟢",
  idle: "💤",
  watch: "🟡",
  warning: "🟠",
  critical: "🔴",
};

export function SeverityBadge({ severity, className }: { severity: SeverityLevel; className?: string }) {
  return (
    <Badge tone={severityTone[severity]} className={className}>
      {severityEmoji[severity]} {severityText[severity]}
    </Badge>
  );
}

const tierTone: Record<MaintenanceTier, "good" | "warning" | "critical"> = {
  general_checkup: "good",
  service_recommended: "warning",
  urgent_inspection: "critical",
};

const tierText: Record<MaintenanceTier, string> = {
  general_checkup: "🟢 GENERAL CHECKUP",
  service_recommended: "🟡 SERVICE RECOMMENDED",
  urgent_inspection: "🔴 URGENT INSPECTION",
};

export function MaintenanceTierBadge({ tier, className }: { tier: MaintenanceTier; className?: string }) {
  return (
    <Badge tone={tierTone[tier]} className={className}>
      {tierText[tier]}
    </Badge>
  );
}

const confidenceTone: Record<ConfidenceLevel, "good" | "warning" | "neutral"> = {
  high: "good",
  medium: "warning",
  low: "neutral",
};

export function ConfidenceBadge({ confidence, className }: { confidence: ConfidenceLevel; className?: string }) {
  return (
    <Badge tone={confidenceTone[confidence]} className={className}>
      Confidence: {confidence[0].toUpperCase() + confidence.slice(1)}
    </Badge>
  );
}

export function SourceBadge({ source, className }: { source: DataSource; className?: string }) {
  return (
    <Badge tone={source === "live" ? "good" : "brand"} className={className}>
      {source === "live" ? "🟢 LIVE" : "🟣 SIMULATION"}
    </Badge>
  );
}

const qualityTone: Record<QualityStatus, "good" | "warning" | "serious" | "neutral"> = {
  unavailable: "neutral",
  learning: "neutral",
  stable: "good",
  watch: "warning",
  concern: "serious",
};

const qualityText: Record<QualityStatus, string> = {
  unavailable: "NO DATA",
  learning: "LEARNING",
  stable: "STABLE",
  watch: "WATCH",
  concern: "CONCERN",
};

const qualityEmoji: Record<QualityStatus, string> = {
  unavailable: "⚪",
  learning: "🔵",
  stable: "🟢",
  watch: "🟡",
  concern: "🟠",
};

export function PowerQualityBadge({ status, className }: { status: QualityStatus; className?: string }) {
  return (
    <Badge tone={qualityTone[status]} className={className}>
      {qualityEmoji[status]} {qualityText[status]}
    </Badge>
  );
}
