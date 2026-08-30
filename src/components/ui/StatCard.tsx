import { Card } from "./Card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  tone = "neutral",
  sublabel,
  className,
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon?: LucideIcon;
  tone?: "neutral" | "good" | "warning" | "critical" | "brand";
  sublabel?: string;
  className?: string;
}) {
  const toneColor =
    tone === "good"
      ? "var(--status-good)"
      : tone === "warning"
      ? "var(--status-warning)"
      : tone === "critical"
      ? "var(--status-critical)"
      : tone === "brand"
      ? "var(--brand)"
      : "var(--ink-primary)";

  return (
    <Card className={cn("p-5 fade-in-up", className)}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[var(--ink-muted)]">{label}</p>
        {Icon && (
          <div
            className="flex size-8 items-center justify-center rounded-lg"
            style={{ background: `color-mix(in srgb, ${toneColor} 14%, transparent)` }}
          >
            <Icon className="size-4" style={{ color: toneColor }} />
          </div>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tracking-tight" style={{ color: toneColor }}>
          {value}
        </span>
        {unit && <span className="text-sm text-[var(--ink-muted)]">{unit}</span>}
      </div>
      {sublabel && <p className="mt-1 text-xs text-[var(--ink-muted)]">{sublabel}</p>}
    </Card>
  );
}
