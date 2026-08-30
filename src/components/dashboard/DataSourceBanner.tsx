import { FlaskConical, Radio } from "lucide-react";
import type { DataSource } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Every screen that shows readings/analytics must make it unmistakable
 * whether the data is real (section 2, 🟢 LIVE DEVICE DATA) or generated
 * (section 27, DEMO SIMULATION MODE — GENERATED DATA). This is the single
 * shared component so the labelling can never drift between pages.
 */
export function DataSourceBanner({ source, className }: { source: DataSource; className?: string }) {
  if (source === "live") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--status-good)_35%,transparent)] bg-[color-mix(in_srgb,var(--status-good)_10%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--status-good)]",
          className
        )}
      >
        <span className="relative flex size-2">
          <span className="pulse-dot absolute inline-flex size-2 rounded-full bg-[var(--status-good)]" />
        </span>
        <Radio className="size-3.5" />
        LIVE DEVICE DATA
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--series-5)_40%,transparent)] bg-[color-mix(in_srgb,var(--series-5)_10%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--series-5)]",
        className
      )}
    >
      <FlaskConical className="size-3.5" />
      DEMO SIMULATION MODE — GENERATED DATA
    </div>
  );
}

export function InlineSourceTag({ source }: { source: DataSource }) {
  return source === "live" ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--status-good)]">
      <Radio className="size-3" /> live
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--series-5)]">
      <FlaskConical className="size-3" /> simulation
    </span>
  );
}
