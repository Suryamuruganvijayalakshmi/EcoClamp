"use client";

import Link from "next/link";
import {
  Factory,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Gauge,
  Zap,
  FlaskConical,
  ShieldAlert,
  Leaf,
  ArrowRight,
} from "lucide-react";
import { useDashboard } from "@/lib/supabase/DashboardProvider";
import { useFleetSnapshots } from "@/lib/hooks/useFleetSnapshots";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingState, EmptyState } from "@/components/ui/States";
import { MachineStatusBadge, SeverityBadge } from "@/components/dashboard/StatusBadge";
import { computeConservationScore } from "@/lib/engine/conservation";
import { formatNumber, timeAgo } from "@/lib/utils";

export default function OverviewPage() {
  const { profile, factory, machines, loading: dashLoading } = useDashboard();
  const { snapshots, loading: snapshotsLoading } = useFleetSnapshots(machines, factory?.id);

  const loading = dashLoading || snapshotsLoading;

  const online = snapshots.filter((s) => s.isOnline).length;
  // "idle" (low current, below baseline) is folded in here alongside
  // "watch" -- neither is a fault condition, both are non-alarming states.
  const normal = snapshots.filter(
    (s) => s.hasData && (s.severity === "normal" || s.severity === "watch" || s.severity === "idle")
  ).length;
  const warning = snapshots.filter((s) => s.severity === "warning").length;
  const critical = snapshots.filter((s) => s.severity === "critical").length;
  const currentTotalLoadKw = snapshots.filter((s) => s.isOnline).reduce((sum, s) => sum + s.estimatedPowerKw, 0);
  const estimatedEnergyToday = snapshots.reduce((sum, s) => sum + s.estimatedEnergyTodayKwh, 0);
  const attentionMachines = snapshots.filter((s) =>
    ["attention", "poor", "critical"].includes(s.health.status)
  ).length;
  // Only HIGH-current (warning/critical) severities count as a "waste
  // event" here -- idle machines are a different, lower-priority pattern
  // already tracked separately by the conservation engine's idle accounting.
  const potentialWasteEvents = snapshots.filter((s) => s.severity === "warning" || s.severity === "critical").length;

  const conservation = computeConservationScore({
    abnormalEventCount: snapshots.filter((s) => s.severity === "warning" || s.severity === "critical").length,
    idleEventCount: 0,
    repeatedWasteEventCount: 0,
    improvedAfterAction: false,
  });

  const liveCount = snapshots.filter((s) => s.source === "live").length;
  const simCount = snapshots.filter((s) => s.source === "simulation").length;

  if (loading) return <LoadingState label="Loading fleet overview…" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            {factory?.company_name} · {factory?.district}, {factory?.state}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {liveCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--status-good)_35%,transparent)] bg-[color-mix(in_srgb,var(--status-good)_10%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--status-good)]">
              <Radio className="size-3.5" /> {liveCount} machine{liveCount === 1 ? "" : "s"} on LIVE data
            </span>
          )}
          {simCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--series-5)_40%,transparent)] bg-[color-mix(in_srgb,var(--series-5)_10%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--series-5)]">
              <FlaskConical className="size-3.5" /> {simCount} on DEMO SIMULATION
            </span>
          )}
        </div>
      </div>

      {machines.length === 0 ? (
        <EmptyState
          icon={Factory}
          title="No machines yet"
          description="Add your first machine and connect an EcoClamp device to start seeing live analytics."
          action={
            <Link href="/dashboard/machines">
              <Button size="sm" className="gap-1.5">
                Add a machine <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Total Machines" value={machines.length} icon={Factory} />
            <StatCard label="Machines Online" value={online} icon={Radio} tone={online > 0 ? "good" : "neutral"} />
            <StatCard label="Normal" value={normal} icon={CheckCircle2} tone="good" />
            <StatCard label="Warning" value={warning} icon={AlertTriangle} tone="warning" />
            <StatCard label="Critical" value={critical} icon={ShieldAlert} tone="critical" />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard
              label="Current Total Load"
              value={formatNumber(currentTotalLoadKw, 2)}
              unit="kW (est.)"
              icon={Zap}
              tone="brand"
            />
            <StatCard
              label="Estimated Energy Today"
              value={formatNumber(estimatedEnergyToday, 1)}
              unit="Units (kWh, est.)"
              icon={Gauge}
            />
            <StatCard
              label="Potential Waste Events"
              value={potentialWasteEvents}
              icon={AlertTriangle}
              tone={potentialWasteEvents > 0 ? "warning" : "neutral"}
            />
            <StatCard
              label="Machines Requiring Attention"
              value={attentionMachines}
              icon={ShieldAlert}
              tone={attentionMachines > 0 ? "warning" : "neutral"}
            />
            <StatCard
              label="Resource Conservation Score"
              value={conservation.score}
              unit="/ 100"
              icon={Leaf}
              tone={conservation.score >= 70 ? "good" : conservation.score >= 50 ? "warning" : "critical"}
              sublabel={conservation.label}
            />
          </div>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Fleet Status</CardTitle>
                <p className="mt-0.5 text-xs text-[var(--ink-muted)]">Latest reading per machine</p>
              </div>
              <Link href="/dashboard/machines">
                <Button size="sm" variant="outline">
                  Manage machines
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-[var(--border)] overflow-x-auto">
                {snapshots.map((s) => (
                  <Link
                    key={s.machine.id}
                    href={`/dashboard/machines/${s.machine.id}`}
                    className="flex min-w-max items-center justify-between gap-6 px-5 py-3.5 transition-colors hover:bg-[var(--border)]/40"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`size-2 rounded-full ${s.isOnline ? "bg-[var(--status-good)] pulse-dot" : "bg-[var(--ink-muted)]"}`}
                      />
                      <div>
                        <p className="text-sm font-medium">{s.machine.machine_name}</p>
                        <p className="text-xs text-[var(--ink-muted)]">{s.machine.machine_code} · {s.machine.department || "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-right">
                        <p className="font-medium">{s.hasData ? `${formatNumber(s.latest!.current_amps, 2)} A` : "—"}</p>
                        <p className="text-xs text-[var(--ink-muted)]">
                          {s.hasData ? timeAgo(s.latest!.recorded_at) : "no data"}
                        </p>
                      </div>
                      <MachineStatusBadge status={s.health.status} />
                      <SeverityBadge severity={s.severity} />
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
