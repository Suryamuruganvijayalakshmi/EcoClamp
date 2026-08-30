"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Gauge, Activity, BadgeCheck, Waves } from "lucide-react";
import { useDashboard } from "@/lib/supabase/DashboardProvider";
import { useReadings } from "@/lib/hooks/useReadings";
import { useBaseline } from "@/lib/hooks/useBaseline";
import { CurrentChart } from "@/components/charts/CurrentChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { LoadingState, EmptyState } from "@/components/ui/States";
import { DataSourceBanner } from "@/components/dashboard/DataSourceBanner";
import { MachineStatusBadge, SeverityBadge, ConfidenceBadge, MaintenanceTierBadge, PowerQualityBadge } from "@/components/dashboard/StatusBadge";
import { EventTimeline } from "@/components/dashboard/EventTimeline";
import { computeMachineSnapshot } from "@/lib/engine/snapshot";
import { buildEventTimeline } from "@/lib/engine/anomaly";
import { classifyMachineWindow } from "@/lib/engine/mlAnomaly";
import { computePowerQualitySnapshot } from "@/lib/engine/powerQuality";
import { formatNumber } from "@/lib/utils";

export default function MachineDetailPage() {
  const params = useParams<{ id: string }>();
  const machineId = params.id;
  const { machines, loading: dashLoading } = useDashboard();
  const machine = machines.find((m) => m.id === machineId);

  const { readings, loading: readingsLoading } = useReadings(machineId, "1h", 500);
  const { baseline, loading: baselineLoading } = useBaseline(machineId, machine?.baseline_sample_requirement, machine?.baseline_reset_at);

  const snapshot = useMemo(() => {
    if (!machine) return null;
    return computeMachineSnapshot(
      machine,
      [...readings].reverse().map((r) => ({ current_amps: r.current_amps, recorded_at: r.recorded_at, source: r.source }))
    );
  }, [machine, readings]);

  const timeline = useMemo(() => {
    if (!snapshot || !baseline) return [];
    const window = classifyMachineWindow(readings, baseline, machineId).severityWindow;
    return buildEventTimeline(window);
  }, [readings, baseline, snapshot, machineId]);

  const powerQuality = useMemo(
    () =>
      computePowerQualitySnapshot(
        readings.map((r) => ({
          crestFactor: r.onboard_crest_factor,
          frequencyHz: r.onboard_frequency_hz,
          recordedAt: r.recorded_at,
        }))
      ),
    [readings]
  );

  if (dashLoading) return <LoadingState label="Loading machine…" />;
  if (!machine) {
    return (
      <EmptyState title="Machine not found" description="It may have been deleted." action={
        <Link href="/dashboard/machines" className="text-sm font-medium text-[var(--brand-strong)]">Back to Machines</Link>
      } />
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/machines" className="inline-flex items-center gap-1.5 text-sm text-[var(--ink-muted)] hover:text-[var(--ink-primary)]">
        <ArrowLeft className="size-3.5" /> Back to Machines
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{machine.machine_name}</h1>
            {snapshot && <MachineStatusBadge status={snapshot.health.status} />}
          </div>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            {machine.machine_code} · {machine.machine_type} · {machine.department || "No department"}
          </p>
        </div>
        {snapshot?.source && <DataSourceBanner source={snapshot.source} />}
      </div>

      {readingsLoading ? (
        <LoadingState label="Loading readings…" />
      ) : readings.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No readings yet"
          description="Connect an EcoClamp device or start a demo simulation scenario from Live Energy to see data here."
          action={<Link href="/dashboard/live" className="text-sm font-medium text-[var(--brand-strong)]">Go to Live Energy</Link>}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card className="p-5">
              <p className="text-xs font-medium text-[var(--ink-muted)]">Current Reading</p>
              <p className="mt-2 text-2xl font-semibold">{formatNumber(snapshot!.latest?.current_amps || 0, 2)} <span className="text-sm font-normal text-[var(--ink-muted)]">A</span></p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-medium text-[var(--ink-muted)]">Baseline</p>
              <p className="mt-2 text-2xl font-semibold">{formatNumber(baseline?.averageCurrent || 0, 2)} <span className="text-sm font-normal text-[var(--ink-muted)]">A</span></p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-medium text-[var(--ink-muted)]">Status</p>
              <div className="mt-2"><SeverityBadge severity={snapshot!.severity} /></div>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-medium text-[var(--ink-muted)]">Deviation</p>
              <p className="mt-2 text-2xl font-semibold">{snapshot!.deviationPct > 0 ? "+" : ""}{formatNumber(snapshot!.deviationPct, 1)}%</p>
            </Card>
          </div>

          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                Layer 3 · Isolation Forest anomaly detection
              </p>
              <span className={`text-xs font-medium ${snapshot!.mlModelTrained ? "text-[var(--status-good)]" : "text-[var(--ink-muted)]"}`}>
                {snapshot!.mlModelTrained
                  ? `Trained on ${snapshot!.mlModelSampleCount} readings from this machine`
                  : `Warming up (${snapshot!.mlModelSampleCount}/20 readings)`}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              {snapshot!.mlScore != null && (
                <span className="text-2xl font-semibold">
                  {formatNumber(snapshot!.mlScore, 2)} <span className="text-xs font-normal text-[var(--ink-muted)]">anomaly score</span>
                </span>
              )}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[var(--ink-secondary)]">{snapshot!.explanation}</p>
          </Card>

          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                <Waves className="size-3.5 text-[var(--brand)]" /> Power Quality
              </p>
              <PowerQualityBadge status={powerQuality.overallStatus} />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-[var(--border)] p-3">
                <p className="text-xs text-[var(--ink-muted)]">Crest Factor</p>
                <p className="mt-1 text-lg font-semibold">
                  {powerQuality.crestFactor.latest != null ? formatNumber(powerQuality.crestFactor.latest, 2) : "—"}
                </p>
                <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                  {powerQuality.crestFactor.baselineAvg != null
                    ? `Machine baseline: ${formatNumber(powerQuality.crestFactor.baselineAvg, 2)} · clean-sine reference: ~${formatNumber(
                        powerQuality.crestFactor.referenceValue,
                        2
                      )}`
                    : `Clean-sine reference: ~${formatNumber(powerQuality.crestFactor.referenceValue, 2)}`}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border)] p-3">
                <p className="text-xs text-[var(--ink-muted)]">Frequency</p>
                <p className="mt-1 text-lg font-semibold">
                  {powerQuality.frequency.latest != null ? `${formatNumber(powerQuality.frequency.latest, 2)} Hz` : "—"}
                </p>
                <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                  {powerQuality.frequency.baselineAvg != null
                    ? `Machine baseline: ${formatNumber(powerQuality.frequency.baselineAvg, 2)} Hz · grid nominal: ~${formatNumber(
                        powerQuality.frequency.referenceValue,
                        0
                      )} Hz`
                    : `Grid nominal: ~${formatNumber(powerQuality.frequency.referenceValue, 0)} Hz`}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[var(--ink-secondary)]">{powerQuality.explanation}</p>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Live Current — Last Hour</CardTitle>
            </CardHeader>
            <CardContent>
              <CurrentChart readings={readings} baselineAvg={baseline?.averageCurrent} minNormal={baseline?.minNormal} maxNormal={baseline?.maxNormal} />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle className="flex items-center gap-2"><Gauge className="size-4 text-[var(--brand)]" /> Machine Learning Baseline</CardTitle>
                  <p className="mt-0.5 text-xs text-[var(--ink-muted)]">Learned from {baseline?.sampleCount ?? 0} readings</p>
                </div>
                {baseline && <ConfidenceBadge confidence={baseline.confidence} />}
              </CardHeader>
              <CardContent>
                {baselineLoading || !baseline ? (
                  <LoadingState label="Learning baseline…" />
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg bg-[var(--border)]/40 px-3 py-2 text-sm">
                      <span className="text-[var(--ink-muted)]">Baseline Average</span>
                      <span className="font-semibold">{formatNumber(baseline.averageCurrent, 2)} A</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-[var(--border)]/40 px-3 py-2 text-sm">
                      <span className="text-[var(--ink-muted)]">Normal Range</span>
                      <span className="font-semibold">{formatNumber(baseline.minNormal, 2)} A – {formatNumber(baseline.maxNormal, 2)} A</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-[var(--border)]/40 px-3 py-2 text-sm">
                      <span className="text-[var(--ink-muted)]">Standard Deviation</span>
                      <span className="font-semibold">{formatNumber(baseline.stdDev, 2)} A</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-[var(--border)]/40 px-3 py-2 text-sm">
                      <span className="text-[var(--ink-muted)]">Baseline Status</span>
                      <span className="inline-flex items-center gap-1 font-semibold">
                        {baseline.status === "established" ? (
                          <><BadgeCheck className="size-3.5 text-[var(--status-good)]" /> ESTABLISHED</>
                        ) : (
                          <>LEARNING ({baseline.sampleCount}/{machine.baseline_sample_requirement})</>
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Activity className="size-4 text-[var(--brand)]" /> Machine Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-full border-4" style={{ borderColor: "var(--brand)" }}>
                    <span className="text-xl font-bold">{snapshot!.health.score}</span>
                  </div>
                  <div>
                    <MachineStatusBadge status={snapshot!.health.status} />
                    <p className="mt-1 text-xs text-[var(--ink-muted)]">Operational health indicator — not a certified mechanical diagnosis.</p>
                  </div>
                </div>
                <p className="mt-3 text-xs font-medium text-[var(--ink-muted)]">Why did the score change?</p>
                <ul className="mt-1 space-y-1">
                  {snapshot!.health.reasons.map((r, i) => (
                    <li key={i} className="text-xs text-[var(--ink-secondary)]">• {r}</li>
                  ))}
                </ul>
                <div className="mt-4 border-t border-[var(--border)] pt-3">
                  <MaintenanceTierBadge tier={snapshot!.maintenance.tier} />
                  <p className="mt-1.5 text-xs text-[var(--ink-secondary)]">{snapshot!.maintenance.recommendation}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Event Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <EventTimeline entries={timeline} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
