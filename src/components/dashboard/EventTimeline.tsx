import { format } from "date-fns";
import type { TimelineEntry } from "@/lib/engine/anomaly";
import { SeverityBadge } from "./StatusBadge";
import { EmptyState } from "@/components/ui/States";
import { History } from "lucide-react";

export function EventTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState icon={History} title="No events yet" description="Timeline will populate as readings arrive." />;
  }

  return (
    <ol className="space-y-0">
      {entries.map((entry, i) => (
        <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
          {i < entries.length - 1 && (
            <span className="absolute top-3 left-[7px] h-full w-px bg-[var(--border-strong)]" />
          )}
          <span
            className="relative z-10 mt-1 size-3.5 shrink-0 rounded-full ring-4 ring-[var(--surface)]"
            style={{
              background:
                entry.severity === "normal"
                  ? "var(--status-good)"
                  : entry.severity === "idle"
                  ? "var(--ink-muted)"
                  : entry.severity === "watch"
                  ? "var(--status-warning)"
                  : entry.severity === "warning"
                  ? "var(--status-serious)"
                  : "var(--status-critical)",
            }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium text-[var(--ink-muted)]">{format(new Date(entry.time), "hh:mm:ss a")}</p>
              <SeverityBadge severity={entry.severity} />
            </div>
            <p className="mt-0.5 text-sm font-medium">{entry.label}</p>
            <p className="text-xs text-[var(--ink-muted)]">Current: {entry.currentAmps.toFixed(2)} A</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
