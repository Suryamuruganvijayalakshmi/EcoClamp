"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  Check,
  CircleDot,
  Gauge,
  History,
  Radio,
  ShieldCheck,
  TimerReset,
  Zap,
} from "lucide-react";
import { useDashboard } from "@/lib/supabase/DashboardProvider";
import { useFleetSnapshots } from "@/lib/hooks/useFleetSnapshots";
import { useReadings } from "@/lib/hooks/useReadings";
import { LoadingState, EmptyState } from "@/components/ui/States";
import { formatNumber, timeAgo } from "@/lib/utils";
import type { MachineSnapshot } from "@/lib/engine/snapshot";

function signed(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function driftLabel(score: number) {
  if (score < 10) return "STABLE";
  if (score < 20) return "MILD DRIFT";
  if (score < 35) return "SIGNIFICANT DRIFT";
  return "CRITICAL DRIFT";
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${38 - ((value - min) / range) * 32}`).join(" ");
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-12 w-full overflow-visible" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function MetricBar({ label, value, delta, color, history }: { label: string; value: string; delta: number; color: string; history: number[] }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold">{label}</span>
        <span style={{ color }}>{signed(delta)}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-2 flex-1 bg-[var(--border)]"><div className="h-full transition-all duration-500" style={{ width: `${Math.min(100, Math.max(4, Math.abs(delta) * 2))}%`, background: color }} /></div>
        <span className="w-24 text-right text-xs font-semibold">{value}</span>
      </div>
      <div className="mt-1"><Sparkline values={history} color={color} /></div>
    </div>
  );
}

function EmptyBehaviorState() {
  return (
    <EmptyState
      icon={Radio}
      title="Your behavioral model is ready"
      description="Add a machine and connect an EcoClamp device to start learning its normal operating fingerprint."
    />
  );
}

export function BehavioralOverview() {
  const { profile, factory, machines, loading: dashboardLoading } = useDashboard();
  const { snapshots, loading: snapshotsLoading } = useFleetSnapshots(machines, factory?.id);
  const [selectedMachineId, setSelectedMachineId] = useState<string | undefined>();
  const machineId = selectedMachineId && machines.some((machine) => machine.id === selectedMachineId)
    ? selectedMachineId
    : machines[0]?.id;
  const machine = machines.find((item) => item.id === machineId);
  const snapshot = snapshots.find((item) => item.machine.id === machineId) as MachineSnapshot | undefined;
  const { readings, loading: readingsLoading } = useReadings(machineId, "1h", 120);

  const model = useMemo(() => {
    const latest = readings[readings.length - 1];
    const baseline = snapshot?.baseline.averageCurrent || latest?.current_amps || 0;
    const current = latest?.current_amps || snapshot?.latest?.current_amps || 0;
    const drift = snapshot?.deviationPct || 0;
    const history = readings.slice(-18).map((reading) => reading.current_amps);
    const fallbackHistory = Array.from({ length: 18 }, (_, index) => baseline * (1 + Math.sin(index * 0.7) * 0.02));
    return {
      current,
      baseline,
      drift,
      health: snapshot?.health.score || 0,
      risk: Math.min(100, Math.max(0, Math.round(Math.abs(drift) * 1.8 + (snapshot?.anomalyCountLastHour || 0) * 2))),
      history: history.length > 1 ? history : fallbackHistory,
      source: latest?.source || snapshot?.source,
      timestamp: latest?.recorded_at || snapshot?.latest?.recorded_at,
    };
  }, [readings, snapshot]);

  if (dashboardLoading || snapshotsLoading || (machineId && readingsLoading && readings.length === 0)) {
    return <LoadingState label="Loading your live behavioral model..." />;
  }

  if (!machine || !snapshot) return <EmptyBehaviorState />;

  const currentDelta = model.baseline ? ((model.current - model.baseline) / model.baseline) * 100 : 0;
  const sourceLabel = model.source === "live" ? "LIVE DEVICE DATA" : "SIMULATION DATA";
  const riskColor = model.risk >= 60 ? "var(--status-serious)" : model.risk >= 30 ? "var(--status-warning)" : "var(--status-good)";
  const signalRows = [
    { label: "Current draw", value: `${formatNumber(model.current, 2)} A`, delta: currentDelta, color: "var(--series-1)" },
    { label: "Behavioral drift", value: `${formatNumber(model.drift, 1)}%`, delta: model.drift, color: "var(--status-serious)" },
    { label: "Power estimate", value: `${formatNumber(snapshot.estimatedPowerKw, 2)} kW`, delta: currentDelta, color: "var(--status-warning)" },
    { label: "Energy today", value: `${formatNumber(snapshot.estimatedEnergyTodayKwh, 1)} kWh`, delta: 0, color: "var(--status-good)" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-strong)]"><CircleDot className="size-3.5" /> Live machine behavioral model</div>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">How is this machine behaving today?</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--ink-secondary)]">EcoClamp compares the current operating window with this customer machine&apos;s learned fingerprint, then traces the evidence behind every drift signal.</p>
        </div>
        <label className="w-full border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-sm)] lg:w-72">
          <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Customer machine</span>
          <select value={machine.id} onChange={(event) => setSelectedMachineId(event.target.value)} className="mt-1 w-full bg-transparent text-sm font-semibold outline-none">
            {machines.map((item) => <option key={item.id} value={item.id}>{item.machine_name}</option>)}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-[var(--ink-muted)]">
        <span className="border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 py-1">{machine.machine_code}</span>
        <span className="border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 py-1">{machine.machine_type}</span>
        <span className="border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 py-1">Fingerprint: {snapshot.baseline.sampleCount} samples</span>
        <span className="ml-auto flex items-center gap-1.5"><Radio className={`size-3.5 ${snapshot.isOnline ? "text-[var(--status-good)] pulse-dot" : "text-[var(--ink-muted)]"}`} /> {snapshot.isOnline ? sourceLabel : "DEVICE OFFLINE"}{model.timestamp ? ` · ${timeAgo(model.timestamp)}` : ""}</span>
      </div>

      <section className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]"><Activity className="size-4 text-[var(--brand)]" /> Behavioral drift</div>
              <div className="mt-3 flex items-end gap-3"><span className="text-6xl font-semibold tracking-[-0.05em]">{formatNumber(model.drift, 1)}%</span><span className="mb-2 border border-[color-mix(in_srgb,var(--status-serious)_35%,transparent)] bg-[color-mix(in_srgb,var(--status-serious)_10%,transparent)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--status-serious)]">{driftLabel(model.drift)}</span></div>
              <p className="mt-2 max-w-md text-sm text-[var(--ink-secondary)]">Deviation from this machine&apos;s learned behavioral fingerprint, not a universal threshold.</p>
            </div>
            <div className="text-right text-[11px] text-[var(--ink-muted)]"><div className="font-semibold text-[var(--ink-secondary)]">MODEL CONFIDENCE</div><div className="mt-1">{snapshot.baseline.confidence.toUpperCase()}</div><div>{snapshot.mlModelTrained ? "Isolation Forest trained" : "Warming up model"}</div></div>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-[0.8fr_1.2fr]">
            <div className="relative flex min-h-48 items-center justify-center border border-[var(--border)] bg-[var(--page)]"><div className="absolute inset-8 rounded-full border border-dashed border-[var(--border-strong)]" /><div className="absolute inset-14 rounded-full border border-[var(--brand)]/30" /><div className="relative flex size-24 flex-col items-center justify-center rounded-full border-2 border-[var(--status-serious)] bg-[var(--surface)] shadow-[0_0_0_12px_color-mix(in_srgb,var(--status-serious)_8%,transparent)]"><span className="text-2xl font-semibold">{formatNumber(model.drift, 1)}%</span><span className="text-[9px] uppercase tracking-widest text-[var(--ink-muted)]">drift</span></div><span className="absolute left-4 top-4 text-[10px] font-bold uppercase tracking-wider text-[var(--series-1)]">Electrical</span><span className="absolute right-4 top-4 text-[10px] font-bold uppercase tracking-wider text-[var(--status-serious)]">Behavior</span><span className="absolute bottom-4 left-4 text-[10px] font-bold uppercase tracking-wider text-[var(--status-warning)]">Energy</span><span className="absolute bottom-4 right-4 text-[10px] font-bold uppercase tracking-wider text-[var(--status-good)]">Device</span></div>
            <div><div className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Contributing signals</div><div className="space-y-4">{signalRows.map((row) => <MetricBar key={row.label} label={row.label} value={row.value} delta={row.delta} color={row.color} history={model.history} />)}</div></div>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
          <div className="border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Machine health index</span><ShieldCheck className="size-4 text-[var(--brand)]" /></div><div className="mt-4 flex items-end gap-2"><span className="text-5xl font-semibold">{model.health}</span><span className="mb-2 text-sm text-[var(--ink-muted)]">/ 100</span></div><div className="mt-4 h-2 bg-[var(--border)]"><div className="h-full bg-[var(--brand)] transition-all duration-500" style={{ width: `${model.health}%` }} /></div><p className="mt-3 text-xs leading-relaxed text-[var(--ink-muted)]">Directional product metric derived from current behavior and learned confidence.</p></div>
          <div className="border border-[var(--ink-primary)] bg-[var(--ink-primary)] p-5 text-[var(--page)] shadow-[var(--shadow-sm)]"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--page)]/60">Degradation risk</span><BrainCircuit className="size-4" style={{ color: riskColor }} /></div><div className="mt-4 flex items-end gap-2"><span className="text-5xl font-semibold" style={{ color: riskColor }}>{model.risk}%</span><span className="mb-2 text-sm text-[var(--page)]/60">model-derived</span></div><p className="mt-4 text-sm leading-relaxed text-[var(--page)]/75">{snapshot.maintenance.recommendation}</p><div className="mt-5 flex items-center gap-2 border-t border-white/15 pt-3 text-[11px] text-[var(--page)]/60"><Zap className="size-3.5" /> Server-side engine · customer scoped</div></div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] sm:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Machine behavior map</div><h2 className="mt-2 text-xl font-semibold">Current window vs learned fingerprint</h2></div><div className="flex items-center gap-2 text-[11px] text-[var(--ink-muted)]"><span className="size-2 rounded-full bg-[var(--brand)]" /> Current <span className="ml-2 size-2 rounded-full bg-[var(--border-strong)]" /> Fingerprint</div></div><div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5">{signalRows.map((row) => <div key={row.label}><div className="flex items-center justify-between text-xs"><span className="font-semibold">{row.label}</span><span style={{ color: row.color }}>{signed(row.delta)}</span></div><div className="mt-2 flex items-center gap-2"><div className="h-2 flex-1 bg-[var(--border)]"><div className="h-full" style={{ width: `${Math.min(100, Math.max(8, Math.abs(row.delta) * 2))}%`, background: row.color }} /></div><span className="w-24 text-right text-xs font-semibold">{row.value}</span></div></div>)}</div></div>
        <div className="border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] sm:p-7"><div className="flex items-center justify-between"><div><div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Machine digital fingerprint</div><h2 className="mt-2 text-xl font-semibold">{machine.machine_name.toUpperCase()}</h2></div><Gauge className="size-8 text-[var(--brand)]" /></div><div className="mt-6 space-y-5">{[["Electrical stability", Math.max(0, 100 - Math.abs(currentDelta)), "var(--series-1)"], ["Behavioral stability", Math.max(0, 100 - Math.abs(model.drift)), "var(--status-serious)"], ["Data confidence", snapshot.baseline.confidence === "high" ? 92 : snapshot.baseline.confidence === "medium" ? 64 : 32, "var(--status-good)"]].map(([label, value, color]) => <div key={String(label)}><div className="mb-1.5 flex justify-between text-xs"><span className="text-[var(--ink-secondary)]">{label}</span><span className="font-semibold">{Math.round(Number(value))}%</span></div><div className="flex gap-1">{Array.from({ length: 10 }, (_, index) => <span key={index} className="h-2 flex-1" style={{ background: index < Math.round(Number(value) / 10) ? String(color) : "var(--border)" }} />)}</div></div>)}</div><div className="mt-7 flex items-end justify-between border-t border-[var(--border)] pt-5"><div><div className="text-[11px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">Overall similarity</div><div className="mt-1 text-3xl font-semibold">{formatNumber(Math.max(0, 100 - Math.abs(model.drift)), 1)}%</div></div><div className="text-right text-xs text-[var(--ink-muted)]"><History className="ml-auto mb-1 size-4" />{snapshot.baseline.sampleCount} learned samples<br />updated {model.timestamp ? timeAgo(model.timestamp) : "not yet"}</div></div></div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr_0.85fr]">
        <div className="border border-[var(--border)] bg-[var(--surface)] p-5"><div className="flex items-center justify-between"><div><div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">What changed?</div><h2 className="mt-2 text-lg font-semibold">Current window / healthy window</h2></div><TimerReset className="size-5 text-[var(--brand)]" /></div><div className="mt-5 space-y-3">{[["Current draw", model.current, model.baseline, "A", currentDelta], ["Power estimate", snapshot.estimatedPowerKw, 0, "kW", currentDelta], ["Energy today", snapshot.estimatedEnergyTodayKwh, 0, "kWh", 0]].map(([label, current, healthy, unit, delta]) => <div key={String(label)} className="flex items-center justify-between border-b border-[var(--border)] pb-3 text-sm"><span className="text-[var(--ink-secondary)]">{label}</span><span className="font-mono text-xs text-[var(--ink-muted)]">{formatNumber(Number(current), 2)} {unit} <ArrowRight className="mx-1 inline size-3" /> {Number(healthy) ? `${formatNumber(Number(healthy), 2)} ${unit}` : "derived"}</span><span className="w-14 text-right font-semibold" style={{ color: Number(delta) > 5 ? "var(--status-serious)" : "var(--status-good)" }}>{signed(Number(delta))}</span></div>)}</div></div>
        <div className="border border-[var(--border)] bg-[var(--surface)] p-5"><div className="flex items-center justify-between"><div><div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Behavior evolution</div><h2 className="mt-2 text-lg font-semibold">Drift trajectory</h2></div><span className="text-[11px] font-medium text-[var(--brand-strong)]">last {readings.length} readings</span></div><div className="mt-5 h-28 border-b border-l border-[var(--border)] bg-[linear-gradient(to_bottom,transparent_49%,var(--border)_50%,transparent_51%)] p-3"><Sparkline values={model.history} color="var(--status-serious)" /></div><div className="mt-3 flex justify-between text-[10px] uppercase tracking-wider text-[var(--ink-muted)]"><span>earlier</span><span>now</span></div></div>
        <div className="border border-[var(--border)] bg-[var(--surface)] p-5"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand-strong)]"><BrainCircuit className="size-4" /> AI investigation brief</div><h2 className="mt-3 text-xl font-semibold">Evidence before action</h2><p className="mt-3 text-sm leading-relaxed text-[var(--ink-secondary)]">{snapshot.explanation}</p><div className="mt-5 flex items-center gap-2 border-t border-[var(--border)] pt-4 text-xs text-[var(--ink-muted)]"><Check className="size-3.5 text-[var(--status-good)]" /> No automated failure claim</div></div>
      </section>

      <p className="text-center text-xs text-[var(--ink-muted)]">{profile?.full_name ? `${profile.full_name}'s ` : "Your "}dashboard is connected to {factory?.company_name || "your factory"} through Supabase realtime.</p>
    </div>
  );
}