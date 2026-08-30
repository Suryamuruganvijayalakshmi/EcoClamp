import { Loader2, Inbox, AlertTriangle, type LucideIcon } from "lucide-react";
import { Button } from "./Button";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--ink-muted)]">
      <Loader2 className="size-6 animate-spin text-[var(--brand)]" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--border-strong)] py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-[var(--border)]">
        <Icon className="size-5 text-[var(--ink-muted)]" />
      </div>
      <div>
        <p className="text-sm font-medium text-[var(--ink-primary)]">{title}</p>
        {description && <p className="mt-1 max-w-sm text-xs text-[var(--ink-muted)]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--status-critical)_30%,transparent)] bg-[color-mix(in_srgb,var(--status-critical)_6%,transparent)] py-16 text-center">
      <AlertTriangle className="size-6 text-[var(--status-critical)]" />
      <div>
        <p className="text-sm font-medium text-[var(--ink-primary)]">{title}</p>
        {description && <p className="mt-1 max-w-sm text-xs text-[var(--ink-muted)]">{description}</p>}
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-[var(--border)] ${className}`} />;
}
