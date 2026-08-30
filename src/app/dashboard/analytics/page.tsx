"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Factory, BarChart3 } from "lucide-react";
import { useDashboard } from "@/lib/supabase/DashboardProvider";
import { useReadings, type TimeRange } from "@/lib/hooks/useReadings";
import { useBaseline } from "@/lib/hooks/useBaseline";
import { CurrentChart } from "@/components/charts/CurrentChart";
import { EnergyTrendChart } from "@/components/charts/EnergyTrendChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { LoadingState, EmptyState } from "@/components/ui/States";
import { bucketEnergyByHour, defaultAssumptions } from "@/lib/engine/energy";
import { formatNumber } from "@/lib/utils";

const RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

export default function AnalyticsPage() {
  const { machines, loading: dashLoading } = useDashboard();
  const [machineId, setMachineId] = useState("");
  const [range, setRange] = useState<TimeRange>("today");

  useEffect(() => {
    if (!machineId && machines.length > 0) setMachineId(machines[0].id);
  }, [machines, machineId]);

  const machine = machines.find((m) => m.id === machineId);
  const { readings, loading } = useReadings(machineId, range, 3000);
  const { baseline } = useBaseline(machineId, machine?.baseline_sample_requirement);

  const energyBuckets = useMemo(() => {
    if (!machine) return [];
    const assumptions = { ...defaultAssumptions(machine.phase_type), powerFactor: machine.power_factor_assumption };
    return bucketEnergyByHour(readings, assumptions);
  }, [readings, machine]);

  const totalKwh = energyBuckets.reduce((s, b) => s + b.kwh, 0);
  const avgCurrent = readings.length ? readings.reduce((s, r) => s + r.current_amps, 0) / readings.length : 0;
  const peakCurrent = readings.length ? Math.max(...readings.map((r) => r.current_amps)) : 0;

  if (dashLoading) return <LoadingState label="Loading…" />;
  if (machines.length === 0) {
    return (
      <EmptyState icon={Factory} title="No machines yet" description="Add a machine to see analytics." action={
        <Link href="/dashboard/machines" className="text-sm font-medium text-[var(--brand-strong)]">Add a machine</Link>
      } />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">Historical current and energy trends per machine.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={machineId} onChange={(e) => setMachineId(e.target.value)} className="w-52">
            {machines.map((m) => <option key={m.id} value={m.id}>{m.machine_name} ({m.machine_code})</option>)}
          </Select>
          <Select value={range} onChange={(e) => setRange(e.target.value as TimeRange)} className="w-40">
            {RANGE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Crunching analytics…" />
      ) : readings.length === 0 ? (
        <EmptyState icon={BarChart3} title="No readings in this window" description="Try a wider range, or start a demo simulation from Live Energy." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card className="p-5">
              <p className="text-xs font-medium text-[var(--ink-muted)]">Average Current</p>
              <p className="mt-2 text-xl font-semibold">{formatNumber(avgCurrent, 2)} A</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-medium text-[var(--ink-muted)]">Peak Current</p>
              <p className="mt-2 text-xl font-semibold">{formatNumber(peakCurrent, 2)} A</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-medium text-[var(--ink-muted)]">Baseline</p>
              <p className="mt-2 text-xl font-semibold">{baseline ? formatNumber(baseline.averageCurrent, 2) : "—"} A</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-medium text-[var(--ink-muted)]">Estimated Energy (window)</p>
              <p className="mt-2 text-xl font-semibold">{formatNumber(totalKwh, 2)} kWh</p>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Actual vs Normal Range</CardTitle>
            </CardHeader>
            <CardContent>
              <CurrentChart readings={readings} baselineAvg={baseline?.averageCurrent} minNormal={baseline?.minNormal} maxNormal={baseline?.maxNormal} height={300} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Energy Trend (kWh, estimated)</CardTitle>
            </CardHeader>
            <CardContent>
              <EnergyTrendChart data={energyBuckets} />
              <p className="mt-2 text-xs text-[var(--ink-muted)]">
                Estimated from current only — voltage {machine?.rated_voltage}V, power factor {machine?.power_factor_assumption}, {machine?.phase_type === "three" ? "three-phase" : "single-phase"} formula.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
