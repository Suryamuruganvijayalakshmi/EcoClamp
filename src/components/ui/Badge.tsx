import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type BadgeTone = "good" | "warning" | "serious" | "critical" | "neutral" | "brand";

const toneClasses: Record<BadgeTone, string> = {
  good: "bg-[color-mix(in_srgb,var(--status-good)_14%,transparent)] text-[var(--status-good)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--status-good)_35%,transparent)]",
  warning:
    "bg-[color-mix(in_srgb,var(--status-warning)_18%,transparent)] text-[#8a5a00] dark:text-[var(--status-warning)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--status-warning)_45%,transparent)]",
  serious:
    "bg-[color-mix(in_srgb,var(--status-serious)_16%,transparent)] text-[#a1441c] dark:text-[var(--status-serious)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--status-serious)_40%,transparent)]",
  critical:
    "bg-[color-mix(in_srgb,var(--status-critical)_14%,transparent)] text-[var(--status-critical)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--status-critical)_35%,transparent)]",
  neutral: "bg-[var(--border)] text-[var(--ink-secondary)] ring-1 ring-inset ring-[var(--border-strong)]",
  brand:
    "bg-[var(--brand-soft)] text-[var(--brand-strong)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--brand)_35%,transparent)]",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
