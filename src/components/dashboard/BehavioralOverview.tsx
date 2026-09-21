"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, BrainCircuit, CheckCircle2, Factory, Gauge, Radio, Settings2, ShieldCheck, TriangleAlert, Zap } from "lucide-react";
import { useDashboard } from "@/lib/supabase/DashboardProvider";
import { useFleetSnapshots } from "@/lib/hooks/useFleetSnapshots";
import { useReadings } from "@/lib/hooks/useReadings";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { formatNumber, timeAgo } from "@/lib/utils";
import type { MachineSnapshot } from "@/lib/engine/snapshot";

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  const points = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${38 - ((value - min) / range) * 32}`).join(" ");
  return <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-14 w-full" aria-hidden="true"><polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>;
}

function statusCopy(snapshot: MachineSnapshot) {
  if (!snapshot.isOnline) return { label: "Offline", color: "var(--ink-muted)", icon: Radio };
  if (snapshot.severity === "critical" || snapshot.severity === "warning") return { label: "Needs attention", color: "var(--status-critical)", icon: TriangleAlert };
  if (snapshot.severity === "watch") return { label: "Watch closely", color: "var(--status-warning)", icon: TriangleAlert };
  return { label: "Healthy", color: "var(--status-good)", icon: CheckCircle2 };
}

export function BehavioralOverview() {
  const { profile, factory, machines, loading: dashboardLoading } = useDashboard();
  const { snapshots, loading: snapshotsLoading } = useFleetSnapshots(machines, factory?.id);
  const [selectedMachineId, setSelectedMachineId] = useState("");
  const machineId = selectedMachineId && machines.some((machine) => machine.id === selectedMachineId) ? selectedMachineId : machines[0]?.id;
  const machine = machines.find((item) => item.id === machineId);
  const snapshot = snapshots.find((item) => item.machine.id === machineId) as MachineSnapshot | undefined;
  const { readings, loading: readingsLoading } = useReadings(machineId, "1h", 120);
  const history = useMemo(() => readings.slice(-18).map((reading) => reading.current_amps), [readings]);

  if (dashboardLoading || snapshotsLoading || (machineId && readingsLoading && readings.length === 0)) return <LoadingState label="Loading your machine overview..." />;
  if (!machine || !snapshot) return <EmptyState icon={Factory} title="Your overview is ready" description="Add a machine and connect an EcoClamp device to see live health, current, and predictions here." action={<Link href="/dashboard/machines" className="text-sm font-medium text-[var(--brand-strong)]">Add a machine</Link>} />;

  const status = statusCopy(snapshot);
  const StatusIcon = status.icon;
  const current = snapshot.latest?.current_amps ?? 0;
  const baseline = snapshot.baseline.averageCurrent;
  const deviation = snapshot.deviationPct;
  const forecast = snapshot.forecast;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand-strong)]">Factory overview</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Good morning{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}.</h1><p className="mt-2 text-sm text-[var(--ink-secondary)]">Here is the clearest picture of what your machine is doing right now.</p></div>
        <select value={machine.id} onChange={(event) => setSelectedMachineId(event.target.value)} className="border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm font-medium outline-none">{machines.map((item) => <option key={item.id} value={item.id}>{item.machine_name} ({item.machine_code})</option>)}</select>
      </div>

      <div className="flex flex-wrap items-center gap-3 border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-xs text-[var(--ink-secondary)]"><StatusIcon className="size-4" style={{ color: status.color }} /><span className="font-semibold" style={{ color: status.color }}>{status.label}</span><span>{machine.machine_name} · {machine.machine_code}</span><span className="ml-auto">{snapshot.latest?.recorded_at ? `Updated ${timeAgo(snapshot.latest.recorded_at)}` : "Waiting for a reading"}</span></div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="border border-[var(--border)] bg-[var(--surface)] p-5"><div className="flex items-center justify-between text-xs text-[var(--ink-muted)]"><span>Current now</span><Zap className="size-4 text-[var(--series-1)]" /></div><p className="mt-3 text-3xl font-semibold">{formatNumber(current, 2)} <span className="text-sm font-normal text-[var(--ink-muted)]">A</span></p><p className="mt-1 text-xs text-[var(--ink-muted)]">Live electrical load</p></div>
        <div className="border border-[var(--border)] bg-[var(--surface)] p-5"><div className="flex items-center justify-between text-xs text-[var(--ink-muted)]"><span>Compared with normal</span><Activity className="size-4 text-[var(--status-warning)]" /></div><p className="mt-3 text-3xl font-semibold" style={{ color: Math.abs(deviation) > 15 ? "var(--status-critical)" : "var(--ink-primary)" }}>{deviation >= 0 ? "+" : ""}{formatNumber(deviation, 1)}<span className="text-sm font-normal">%</span></p><p className="mt-1 text-xs text-[var(--ink-muted)]">Learned baseline: {formatNumber(baseline, 2)} A</p></div>
        <div className="border border-[var(--border)] bg-[var(--surface)] p-5"><div className="flex items-center justify-between text-xs text-[var(--ink-muted)]"><span>Machine health</span><ShieldCheck className="size-4 text-[var(--status-good)]" /></div><p className="mt-3 text-3xl font-semibold">{snapshot.health.score}<span className="text-sm font-normal text-[var(--ink-muted)]"> / 100</span></p><div className="mt-3 h-2 bg-[var(--border)]"><div className="h-full bg-[var(--status-good)]" style={{ width: `${snapshot.health.score}%` }} /></div></div>
        <div className="border border-[var(--border)] bg-[var(--surface)] p-5"><div className="flex items-center justify-between text-xs text-[var(--ink-muted)]"><span>Energy today</span><Gauge className="size-4 text-[var(--brand)]" /></div><p className="mt-3 text-3xl font-semibold">{formatNumber(snapshot.estimatedEnergyTodayKwh, 1)} <span className="text-sm font-normal text-[var(--ink-muted)]">kWh</span></p><p className="mt-1 text-xs text-[var(--ink-muted)]">Estimated from current</p></div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="border border-[var(--border)] bg-[var(--surface)] p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Last hour</p><h2 className="mt-1 text-xl font-semibold">Current behavior</h2><p className="mt-1 text-xs text-[var(--ink-secondary)]">Actual current over time, so you can spot a change quickly.</p></div><Link href="/dashboard/live" className="text-xs font-medium text-[var(--brand-strong)]">Open live view <ArrowRight className="ml-1 inline size-3" /></Link></div>{history.length > 1 ? <div className="mt-5"><Sparkline values={history} color="var(--series-1)" /></div> : <p className="mt-6 text-sm text-[var(--ink-muted)]">Collecting readings to draw the machine trend.</p>}<div className="mt-3 flex justify-between text-[11px] text-[var(--ink-muted)]"><span>Older readings</span><span>Now</span></div></div>
        <div className="border border-[var(--border)] bg-[var(--surface)] p-5"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-strong)]"><BrainCircuit className="size-4" /> Next signal</div><h2 className="mt-2 text-xl font-semibold">{forecast ? `Likely ${forecast.trend} load` : "Learning your machine"}</h2><p className="mt-3 text-sm leading-relaxed text-[var(--ink-secondary)]">{forecast ? `In the next hour, current is expected around ${formatNumber(forecast.next60min.expectedCurrent, 2)} A. The model confidence is ${forecast.confidence}.` : "More readings are needed before EcoClamp can estimate the next hour."}</p><Link href="/dashboard/ai" className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-[var(--brand-strong)]">See predictions <ArrowRight className="size-4" /></Link></div>
      </section>

      <section className="grid gap-4 md:grid-cols-3"><Link href="/dashboard/live" className="border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-[var(--brand)]"><Zap className="size-5 text-[var(--brand)]" /><p className="mt-3 text-sm font-semibold">Monitor live energy</p><p className="mt-1 text-xs text-[var(--ink-muted)]">See current, baseline, and reset learning.</p></Link><Link href="/dashboard/ai" className="border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-[var(--brand)]"><BrainCircuit className="size-5 text-[var(--brand)]" /><p className="mt-3 text-sm font-semibold">Understand what may happen next</p><p className="mt-1 text-xs text-[var(--ink-muted)]">Review overload, drift, maintenance, and forecasts.</p></Link><Link href="/dashboard/settings" className="border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-[var(--brand)]"><Settings2 className="size-5 text-[var(--brand)]" /><p className="mt-3 text-sm font-semibold">Tune the setup</p><p className="mt-1 text-xs text-[var(--ink-muted)]">Manage machines, devices, and assumptions.</p></Link></section>
    </div>
  );
}
