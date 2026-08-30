"use client";

import Link from "next/link";
import { Bell, CheckCircle2, Square, Eye, TimerReset, Zap } from "lucide-react";
import { useDashboard } from "@/lib/supabase/DashboardProvider";
import { useFleetSnapshots } from "@/lib/hooks/useFleetSnapshots";
import { useAlertsEngine } from "@/lib/hooks/useAlerts";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingState, EmptyState } from "@/components/ui/States";
import { SeverityBadge, MaintenanceTierBadge } from "@/components/dashboard/StatusBadge";
import { InlineSourceTag } from "@/components/dashboard/DataSourceBanner";
import { Badge } from "@/components/ui/Badge";
import { formatNumber } from "@/lib/utils";
import { format } from "date-fns";

const STATUS_LABEL: Record<string, string> = {
  open: "OPEN",
  acknowledged: "ACKNOWLEDGED",
  resolved: "RESOLVED",
  auto_action: "AUTO-ACTIONED",
};

export default function AlertsPage() {
  const { machines, factory, loading: dashLoading } = useDashboard();
  const { snapshots, loading: snapshotsLoading } = useFleetSnapshots(machines, factory?.id);
  const { alerts, loading, acknowledge, stopAction, secondsRemaining } = useAlertsEngine(snapshots, factory?.id);

  if (dashLoading || snapshotsLoading || loading) return <LoadingState label="Loading alerts…" />;

  const openAlerts = alerts.filter((a) => a.status === "open" || a.status === "acknowledged");
  const pastAlerts = alerts.filter((a) => a.status === "resolved" || a.status === "auto_action");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Human-supervised response — every alert opens a 30-second window before a configured prototype action.
        </p>
      </div>

      {openAlerts.length === 0 ? (
        <EmptyState icon={Bell} title="No active alerts" description="You're all caught up. New alerts appear here the moment a machine crosses into warning or critical." />
      ) : (
        <div className="space-y-4">
          {openAlerts.map((alert) => {
            const machine = machines.find((m) => m.id === alert.machine_id);
            const remaining = secondsRemaining(alert);
            return (
              <Card
                key={alert.id}
                className={
                  alert.severity === "critical"
                    ? "border-[color-mix(in_srgb,var(--status-critical)_45%,transparent)]"
                    : "border-[color-mix(in_srgb,var(--status-serious)_40%,transparent)]"
                }
              >
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex-1 min-w-[220px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{alert.title}</p>
                        <SeverityBadge severity={alert.severity} />
                        <Badge tone={alert.status === "open" ? "critical" : "warning"}>{STATUS_LABEL[alert.status]}</Badge>
                        <InlineSourceTag source={alert.source} />
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-4">
                        <div><dt className="text-[var(--ink-muted)]">Current</dt><dd className="font-medium">{formatNumber(alert.current_amps, 2)} A</dd></div>
                        <div><dt className="text-[var(--ink-muted)]">Baseline</dt><dd className="font-medium">{formatNumber(alert.baseline_amps, 2)} A</dd></div>
                        <div><dt className="text-[var(--ink-muted)]">Deviation</dt><dd className="font-medium">{formatNumber(alert.deviation_pct, 1)}%</dd></div>
                        <div><dt className="text-[var(--ink-muted)]">Started</dt><dd className="font-medium">{format(new Date(alert.created_at), "hh:mm:ss a")}</dd></div>
                      </dl>
                      <div className="mt-2">
                        <MaintenanceTierBadge tier={alert.recommendation} />
                      </div>
                    </div>

                    {remaining != null && (
                      <div className="flex shrink-0 flex-col items-center gap-1 rounded-xl border border-[var(--border-strong)] px-4 py-2 text-center">
                        <TimerReset className="size-4 text-[var(--status-critical)]" />
                        <p className="text-lg font-bold tabular-nums text-[var(--status-critical)]">{remaining}s</p>
                        <p className="text-[10px] text-[var(--ink-muted)]">response window</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
                    {alert.status === "open" && (
                      <Button size="sm" variant="outline" onClick={() => acknowledge(alert.id)} className="gap-1.5">
                        <CheckCircle2 className="size-3.5" /> Acknowledge &amp; keep running
                      </Button>
                    )}
                    {(alert.status === "open" || alert.status === "acknowledged") && (
                      <Button size="sm" variant="danger" onClick={() => stopAction(alert.id)} className="gap-1.5">
                        <Square className="size-3.5" /> Stop / Safe Action
                      </Button>
                    )}
                    {machine && (
                      <Link href={`/dashboard/machines/${machine.id}`}>
                        <Button size="sm" variant="ghost" className="gap-1.5"><Eye className="size-3.5" /> View machine</Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {pastAlerts.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-5 py-3">
              <Zap className="size-4 text-[var(--ink-muted)]" />
              <p className="text-sm font-semibold">Alert History</p>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {pastAlerts.slice(0, 20).map((alert) => (
                <div key={alert.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium">{alert.title}</p>
                    <p className="text-xs text-[var(--ink-muted)]">{format(new Date(alert.created_at), "MMM d, hh:mm a")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={alert.severity} />
                    <Badge tone="neutral">{STATUS_LABEL[alert.status]}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-[var(--ink-muted)]">
        <strong>PROTOTYPE AUTOMATION:</strong> if nobody responds within the window, the alert is marked
        auto-actioned for demonstration purposes only. This architecture is designed to support safe industrial
        contactor/interlock integration in future deployments — it does not directly operate mains equipment today.
      </p>
    </div>
  );
}
