"use client";

import Link from "next/link";
import { Leaf } from "lucide-react";
import { useDashboard } from "@/lib/supabase/DashboardProvider";
import { useFleetSnapshots } from "@/lib/hooks/useFleetSnapshots";
import { computeConservationScore } from "@/lib/engine/conservation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { LoadingState, EmptyState } from "@/components/ui/States";
import { InlineSourceTag } from "@/components/dashboard/DataSourceBanner";
import { formatNumber } from "@/lib/utils";

export default function ConservationPage() {
  const { machines, factory, loading: dashLoading } = useDashboard();
  const { snapshots, loading } = useFleetSnapshots(machines, factory?.id, 24 * 7);

  if (dashLoading || loading) return <LoadingState label="Analyzing resource conservation…" />;

  if (machines.length === 0) {
    return (
      <EmptyState icon={Leaf} title="No machines yet" description="Add a machine to see conservation insights." action={
        <Link href="/dashboard/machines" className="text-sm font-medium text-[var(--brand-strong)]">Add a machine</Link>
      } />
    );
  }

  const totalAvoidable = snapshots.reduce((s, x) => s + x.conservation.potentialAvoidableKwh, 0);
  const totalAbnormalEvents = snapshots.reduce((s, x) => s + x.conservation.abnormalEventCount, 0);
  const totalIdleEvents = snapshots.reduce((s, x) => s + x.conservation.idleEventCount, 0);

  const score = computeConservationScore({
    abnormalEventCount: totalAbnormalEvents,
    idleEventCount: totalIdleEvents,
    repeatedWasteEventCount: snapshots.filter((s) => s.conservation.abnormalEventCount >= 3).length,
    improvedAfterAction: false,
  });

  const ranked = [...snapshots].sort((a, b) => b.conservation.potentialAvoidableKwh - a.conservation.potentialAvoidableKwh);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Resource Conservation</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Potential avoidable energy from abnormal and idle-consumption periods — never presented as guaranteed savings.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Resource Conservation Score" value={score.score} unit="/ 100" icon={Leaf} tone={score.score >= 70 ? "good" : score.score >= 50 ? "warning" : "critical"} sublabel={score.label} />
        <StatCard label="Potential Avoidable Energy (7d)" value={formatNumber(totalAvoidable, 1)} unit="Units (kWh)" />
        <StatCard label="Abnormal Waste Events" value={totalAbnormalEvents} tone={totalAbnormalEvents > 0 ? "warning" : "neutral"} />
        <StatCard label="Idle Consumption Events" value={totalIdleEvents} tone={totalIdleEvents > 0 ? "warning" : "neutral"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contributing Factors</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5">
            {score.factors.map((f, i) => (
              <li key={i} className="text-sm text-[var(--ink-secondary)]">• {f}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Potential Avoidable Energy by Machine (7 days)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-[var(--border)]">
            {ranked.map((s) => (
              <Link
                key={s.machine.id}
                href={`/dashboard/machines/${s.machine.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-[var(--border)]/40"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{s.machine.machine_name}</p>
                    {s.source && <InlineSourceTag source={s.source} />}
                  </div>
                  <p className="text-xs text-[var(--ink-muted)]">
                    {s.conservation.abnormalEventCount} abnormal · {s.conservation.idleEventCount} idle events
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-[var(--ink-muted)]">POTENTIAL AVOIDABLE ENERGY</p>
                  <p className="text-lg font-semibold text-[var(--status-warning)]">
                    {formatNumber(s.conservation.potentialAvoidableKwh, 2)} <span className="text-xs font-normal text-[var(--ink-muted)]">Units</span>
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-[var(--ink-muted)]">
        &quot;Potential Avoidable Energy&quot; estimates what could have been saved during identified abnormal or idle
        periods — it is not a guarantee of savings. After an operator takes corrective action, compare measured
        before/after periods to see an <strong>Observed Reduction</strong>.
      </p>
    </div>
  );
}
