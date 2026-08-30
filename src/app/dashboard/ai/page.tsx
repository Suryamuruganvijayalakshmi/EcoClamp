"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brain, Layers, ArrowRight } from "lucide-react";
import { useDashboard } from "@/lib/supabase/DashboardProvider";
import { useFleetSnapshots } from "@/lib/hooks/useFleetSnapshots";
import { createClient } from "@/lib/supabase/client";
import { AI_MODEL_STATUS } from "@/lib/engine/anomaly";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { LoadingState, EmptyState } from "@/components/ui/States";
import { MachineStatusBadge, MaintenanceTierBadge, ConfidenceBadge } from "@/components/dashboard/StatusBadge";
import { InlineSourceTag } from "@/components/dashboard/DataSourceBanner";
import { formatNumber } from "@/lib/utils";
import type { ProductionRecord } from "@/lib/types";

export default function AiIntelligencePage() {
  const { machines, factory, loading: dashLoading } = useDashboard();
  const { snapshots, loading } = useFleetSnapshots(machines, factory?.id);
  const [todaysProduction, setTodaysProduction] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!factory) return;
    (async () => {
      const supabase = createClient();
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("production_records")
        .select("*")
        .eq("factory_id", factory.id)
        .gte("recorded_at", startOfToday.toISOString());
      const totals: Record<string, number> = {};
      for (const rec of (data as ProductionRecord[]) || []) {
        totals[rec.machine_id] = (totals[rec.machine_id] || 0) + rec.quantity;
      }
      setTodaysProduction(totals);
    })();
  }, [factory]);

  if (dashLoading || loading) return <LoadingState label="Running AI analysis…" />;

  if (machines.length === 0) {
    return (
      <EmptyState icon={Brain} title="No machines yet" description="Add a machine to see AI intelligence." action={
        <Link href="/dashboard/machines" className="text-sm font-medium text-[var(--brand-strong)]">Add a machine</Link>
      } />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Intelligence</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">Command center — every layer&apos;s status, and per-machine analysis.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Layers className="size-4 text-[var(--brand)]" /> AI Analytics Architecture</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-[var(--border)] p-3">
            <p className="text-xs font-semibold text-[var(--status-good)]">LAYER 1 · STATISTICAL BASELINE</p>
            <p className="mt-1 text-xs text-[var(--ink-secondary)]">{AI_MODEL_STATUS.layer1}</p>
          </div>
          <div className="rounded-lg border border-[var(--border)] p-3">
            <p className="text-xs font-semibold text-[var(--status-good)]">LAYER 2 · ANOMALY DETECTION</p>
            <p className="mt-1 text-xs text-[var(--ink-secondary)]">{AI_MODEL_STATUS.layer2}</p>
          </div>
          <div className="rounded-lg border border-[var(--border)] p-3">
            <p className="text-xs font-semibold text-[var(--status-good)]">LAYER 3 · ISOLATION FOREST</p>
            <p className="mt-1 text-xs text-[var(--ink-secondary)]">{AI_MODEL_STATUS.layer3}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {snapshots.map((s) => {
          const producedToday = todaysProduction[s.machine.id];
          const intensity = producedToday && producedToday > 0 ? s.estimatedEnergyTodayKwh / producedToday : null;

          return (
            <Card key={s.machine.id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">{s.machine.machine_code}</p>
                  <p className="text-base font-semibold">{s.machine.machine_name}</p>
                </div>
                <MachineStatusBadge status={s.health.status} />
              </div>

              {!s.hasData ? (
                <p className="mt-4 text-sm text-[var(--ink-muted)]">No readings yet for this machine.</p>
              ) : (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-[var(--ink-muted)]">Health</p>
                      <p className="font-semibold">{s.health.score} / 100</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--ink-muted)]">Current</p>
                      <p className="font-semibold">{formatNumber(s.latest!.current_amps, 2)} A</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--ink-muted)]">Baseline</p>
                      <p className="font-semibold">{formatNumber(s.baseline.averageCurrent, 2)} A</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--ink-muted)]">Deviation</p>
                      <p className="font-semibold">{s.deviationPct > 0 ? "+" : ""}{formatNumber(s.deviationPct, 1)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--ink-muted)]">Anomaly Score</p>
                      <p className="font-semibold">{s.mlScore != null ? formatNumber(s.mlScore, 2) : `Warming up (${s.mlModelSampleCount}/20)`}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--ink-muted)]">Potential Avoidable</p>
                      <p className="font-semibold">{formatNumber(s.conservation.potentialAvoidableKwh, 2)} kWh</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--ink-muted)]">Energy Intensity</p>
                      <p className="font-semibold">{intensity != null ? `${formatNumber(intensity, 3)} kWh/unit` : "No production data"}</p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-[var(--ink-secondary)]">{s.explanation}</p>

                  {s.forecast && (
                    <p className="mt-2 text-xs text-[var(--ink-muted)]">
                      Forecast: {s.forecast.trend === "increasing" ? "Elevated consumption likely to continue in the short term." : s.forecast.trend === "decreasing" ? "Consumption trending back toward baseline." : "Stable consumption expected to continue."}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <MaintenanceTierBadge tier={s.maintenance.tier} />
                      <ConfidenceBadge confidence={s.baseline.confidence} />
                      {s.source && <InlineSourceTag source={s.source} />}
                    </div>
                    <Link href={`/dashboard/machines/${s.machine.id}`} className="flex items-center gap-1 text-xs font-medium text-[var(--brand-strong)] hover:underline">
                      Details <ArrowRight className="size-3" />
                    </Link>
                  </div>
                </>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
