"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Square, Zap, Factory, RotateCcw } from "lucide-react";
import { useDashboard } from "@/lib/supabase/DashboardProvider";
import { useReadings, type TimeRange } from "@/lib/hooks/useReadings";
import { useBaseline } from "@/lib/hooks/useBaseline";
import { useSimulation } from "@/lib/hooks/useSimulation";
import { CurrentChart } from "@/components/charts/CurrentChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { LoadingState, EmptyState } from "@/components/ui/States";
import { DataSourceBanner } from "@/components/dashboard/DataSourceBanner";
import { SeverityBadge } from "@/components/dashboard/StatusBadge";
import { classifyMachineWindow } from "@/lib/engine/mlAnomaly";
import { SIMULATION_SCENARIOS, SCENARIO_LABELS, type SimulationScenario } from "@/lib/types";
import { SCENARIO_DESCRIPTIONS } from "@/lib/engine/simulate";
import { formatNumber, timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "5m", label: "Last 5 minutes" },
  { value: "30m", label: "Last 30 minutes" },
  { value: "1h", label: "Last hour" },
  { value: "today", label: "Today" },
  { value: "30d", label: "Historical (30d)" },
];

export default function LiveEnergyPage() {
  const { machines, factory, loading: dashLoading } = useDashboard();
  const [machineId, setMachineId] = useState<string>("");
  const [range, setRange] = useState<TimeRange>("30m");
  const [resetModalOpen, setResetModalOpen] = useState(false);

  useEffect(() => {
    if (!machineId && machines.length > 0) setMachineId(machines[0].id);
  }, [machines, machineId]);

  const machine = machines.find((m) => m.id === machineId);
  const { readings, loading: readingsLoading } = useReadings(machineId, range);
  const { baseline, resetBaseline, resetting } = useBaseline(
    machineId,
    machine?.baseline_sample_requirement,
    machine?.baseline_reset_at
  );
  const { session, startScenario, stopScenario } = useSimulation(machineId, baseline?.averageCurrent || 0, factory?.id);

  async function handleResetBaseline() {
    await resetBaseline();
    setResetModalOpen(false);
  }

  const latest = readings[readings.length - 1];
  const severity =
    latest && baseline
      ? classifyMachineWindow(readings, baseline, machineId).latest.severity
      : ("normal" as const);

  if (dashLoading) return <LoadingState label="Loading…" />;

  if (machines.length === 0) {
    return (
      <EmptyState
        icon={Factory}
        title="No machines yet"
        description="Add a machine first, then come back here to view live current data or run a demo simulation."
        action={<Link href="/dashboard/machines" className="text-sm font-medium text-[var(--brand-strong)]">Add a machine</Link>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Live Energy</h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">Real-time machine-level current monitoring.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={machineId} onChange={(e) => setMachineId(e.target.value)} className="w-52">
            {machines.map((m) => <option key={m.id} value={m.id}>{m.machine_name} ({m.machine_code})</option>)}
          </Select>
          <Select value={range} onChange={(e) => setRange(e.target.value as TimeRange)} className="w-44">
            {RANGE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </div>
      </div>

      {session?.active && <DataSourceBanner source="simulation" />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-medium text-[var(--ink-muted)]">Current Reading</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--series-1)]">
            {latest ? formatNumber(latest.current_amps, 2) : "—"} <span className="text-sm font-normal text-[var(--ink-muted)]">A</span>
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium text-[var(--ink-muted)]">Baseline</p>
            {machine && (
              <button
                onClick={() => setResetModalOpen(true)}
                title="Reset learned baseline"
                className="flex items-center gap-1 text-[11px] font-medium text-[var(--ink-muted)] hover:text-[var(--brand-strong)]"
              >
                <RotateCcw className="size-3" /> Reset
              </button>
            )}
          </div>
          <p className="mt-2 text-3xl font-semibold text-[var(--series-3)]">
            {baseline ? formatNumber(baseline.averageCurrent, 2) : "—"} <span className="text-sm font-normal text-[var(--ink-muted)]">A</span>
          </p>
          <p className="mt-1 text-[11px] text-[var(--ink-muted)]">
            {machine?.baseline_reset_at
              ? `Learning since reset ${timeAgo(machine.baseline_reset_at)}`
              : baseline
              ? `From ${baseline.sampleCount} reading${baseline.sampleCount === 1 ? "" : "s"}`
              : ""}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-[var(--ink-muted)]">Status</p>
          <div className="mt-2"><SeverityBadge severity={severity} className="text-sm" /></div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current vs Time</CardTitle>
          {latest && <span className="text-xs text-[var(--ink-muted)]">source: {latest.source}</span>}
        </CardHeader>
        <CardContent>
          {readingsLoading ? (
            <LoadingState label="Loading readings…" />
          ) : readings.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="No readings in this window"
              description="Connect an EcoClamp device or start a demo simulation scenario below."
            />
          ) : (
            <CurrentChart readings={readings} baselineAvg={baseline?.averageCurrent} minNormal={baseline?.minNormal} maxNormal={baseline?.maxNormal} height={340} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>AI Demo Simulation</CardTitle>
            <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
              No real historical data yet? Generate a realistic scenario to see how the analytics respond.
            </p>
          </div>
          {session?.active && (
            <Button size="sm" variant="danger" onClick={stopScenario} className="gap-1.5">
              <Square className="size-3.5" /> Stop simulation
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {SIMULATION_SCENARIOS.map((scenario) => (
              <button
                key={scenario}
                onClick={() => startScenario(scenario as SimulationScenario)}
                className={cn(
                  "rounded-xl border p-3.5 text-left transition-colors",
                  session?.active && session.scenario === scenario
                    ? "border-[var(--brand)] bg-[var(--brand-soft)]"
                    : "border-[var(--border-strong)] hover:bg-[var(--border)]/50"
                )}
              >
                <p className="text-sm font-medium">{SCENARIO_LABELS[scenario as SimulationScenario]}</p>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">{SCENARIO_DESCRIPTIONS[scenario as SimulationScenario]}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Modal
        open={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title="Reset learned baseline?"
        description={machine ? `For ${machine.machine_name} (${machine.machine_code})` : undefined}
      >
        <p className="text-sm text-[var(--ink-secondary)]">
          The AI will stop counting readings from before now toward this machine&apos;s learned normal range, and
          start re-learning its baseline from scratch. Nothing is deleted -- older readings stay in its history for
          analytics and reporting, they just won&apos;t shape what &quot;normal&quot; means anymore.
        </p>
        <p className="mt-2 text-sm text-[var(--ink-secondary)]">
          Do this after a real change in how the machine operates (different tooling, a repair, a new production
          setup) -- otherwise the baseline will just re-learn the same pattern it already had.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setResetModalOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleResetBaseline} loading={resetting}>Reset baseline</Button>
        </div>
      </Modal>
    </div>
  );
}
