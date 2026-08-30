"use client";

import Link from "next/link";
import { Wrench, ArrowRight } from "lucide-react";
import { useDashboard } from "@/lib/supabase/DashboardProvider";
import { useFleetSnapshots } from "@/lib/hooks/useFleetSnapshots";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { LoadingState, EmptyState } from "@/components/ui/States";
import { MaintenanceTierBadge } from "@/components/dashboard/StatusBadge";
import { InlineSourceTag } from "@/components/dashboard/DataSourceBanner";
import type { MaintenanceTier } from "@/lib/types";

const TIER_ORDER: MaintenanceTier[] = ["urgent_inspection", "service_recommended", "general_checkup"];
const TIER_TITLE: Record<MaintenanceTier, string> = {
  urgent_inspection: "🔴 Urgent Inspection",
  service_recommended: "🟡 Service Recommended",
  general_checkup: "🟢 General Checkup",
};
const TIER_HELP: Record<MaintenanceTier, string> = {
  urgent_inspection: "Large sustained deviation or multiple critical events. Inspect promptly per site safety procedures.",
  service_recommended: "Repeated or sustained abnormal patterns. Schedule a maintenance inspection.",
  general_checkup: "Small or temporary abnormal patterns. Check during the next scheduled inspection.",
};

export default function MaintenancePage() {
  const { machines, factory, loading: dashLoading } = useDashboard();
  const { snapshots, loading } = useFleetSnapshots(machines, factory?.id);

  if (dashLoading || loading) return <LoadingState label="Evaluating maintenance recommendations…" />;

  if (machines.length === 0) {
    return (
      <EmptyState icon={Wrench} title="No machines yet" description="Add a machine to receive maintenance recommendations." action={
        <Link href="/dashboard/machines" className="text-sm font-medium text-[var(--brand-strong)]">Add a machine</Link>
      } />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Maintenance</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Transparent, tiered guidance — never a claim that a specific component has failed.
        </p>
      </div>

      {TIER_ORDER.map((tier) => {
        const inTier = snapshots.filter((s) => s.maintenance.tier === tier && s.hasData);
        return (
          <Card key={tier}>
            <CardHeader>
              <div>
                <CardTitle>{TIER_TITLE[tier]}</CardTitle>
                <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{TIER_HELP[tier]}</p>
              </div>
              <span className="text-sm font-semibold text-[var(--ink-muted)]">{inTier.length}</span>
            </CardHeader>
            <CardContent className="p-0">
              {inTier.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-[var(--ink-muted)]">No machines in this tier right now.</p>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {inTier.map((s) => (
                    <Link
                      key={s.machine.id}
                      href={`/dashboard/machines/${s.machine.id}`}
                      className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-[var(--border)]/40"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{s.machine.machine_name}</p>
                          {s.source && <InlineSourceTag source={s.source} />}
                        </div>
                        <p className="text-xs text-[var(--ink-muted)]">{s.machine.machine_code} · {s.machine.department || "—"}</p>
                        <p className="mt-1 text-xs text-[var(--ink-secondary)]">{s.maintenance.recommendation}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <MaintenanceTierBadge tier={s.maintenance.tier} />
                        <ArrowRight className="size-4 text-[var(--ink-muted)]" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
