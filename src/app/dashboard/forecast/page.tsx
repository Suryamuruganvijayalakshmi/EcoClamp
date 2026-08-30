"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Factory, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useDashboard } from "@/lib/supabase/DashboardProvider";
import { useReadings } from "@/lib/hooks/useReadings";
import { forecastTrend } from "@/lib/engine/forecast";
import { ForecastChart, type ForecastChartPoint } from "@/components/charts/ForecastChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { LoadingState, EmptyState } from "@/components/ui/States";
import { ConfidenceBadge } from "@/components/dashboard/StatusBadge";
import { formatNumber } from "@/lib/utils";

export default function ForecastPage() {
  const { machines, loading: dashLoading } = useDashboard();
  const [machineId, setMachineId] = useState("");

  useEffect(() => {
    if (!machineId && machines.length > 0) setMachineId(machines[0].id);
  }, [machines, machineId]);

  const { readings, loading } = useReadings(machineId, "1h", 300);

  const forecast = useMemo(() => {
    if (readings.length < 3) return null;
    return forecastTrend(readings.map((r) => ({ recordedAt: r.recorded_at, currentAmps: r.current_amps })));
  }, [readings]);

  const chartData: ForecastChartPoint[] = useMemo(() => {
    if (readings.length === 0) return [];
    const historical: ForecastChartPoint[] = readings.map((r) => ({
      time: new Date(r.recorded_at).getTime(),
      historical: r.current_amps,
    }));
    if (!forecast) return historical;

    const lastTime = historical[historical.length - 1].time;
    const bridge: ForecastChartPoint = { time: lastTime, historical: readings[readings.length - 1].current_amps, forecast: readings[readings.length - 1].current_amps };
    const future: ForecastChartPoint[] = [15, 30, 45, 60].map((mins) => ({
      time: lastTime + mins * 60000,
      forecast:
        mins === 15
          ? forecast.next15min.expectedCurrent
          : mins === 60
          ? forecast.next60min.expectedCurrent
          : forecast.next15min.expectedCurrent +
            ((forecast.next60min.expectedCurrent - forecast.next15min.expectedCurrent) * (mins - 15)) / 45,
    }));

    return [...historical.slice(0, -1), bridge, ...future];
  }, [readings, forecast]);

  const TrendIcon = forecast?.trend === "increasing" ? TrendingUp : forecast?.trend === "decreasing" ? TrendingDown : Minus;

  if (dashLoading) return <LoadingState label="Loading…" />;
  if (machines.length === 0) {
    return (
      <EmptyState icon={Factory} title="No machines yet" description="Add a machine to see forecasts." action={
        <Link href="/dashboard/machines" className="text-sm font-medium text-[var(--brand-strong)]">Add a machine</Link>
      } />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Forecast</h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">Short-term consumption trend, extrapolated from recent readings.</p>
        </div>
        <Select value={machineId} onChange={(e) => setMachineId(e.target.value)} className="w-52">
          {machines.map((m) => <option key={m.id} value={m.id}>{m.machine_name} ({m.machine_code})</option>)}
        </Select>
      </div>

      {loading ? (
        <LoadingState label="Forecasting…" />
      ) : !forecast ? (
        <EmptyState icon={TrendingUp} title="Not enough data yet" description="At least a few minutes of readings are needed before a trend can be estimated." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <p className="text-xs font-medium text-[var(--ink-muted)]">Expected Current Trend</p>
              <p className="mt-2 flex items-center gap-1.5 text-xl font-semibold capitalize">
                <TrendIcon className="size-5 text-[var(--brand)]" /> {forecast.trend}
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-medium text-[var(--ink-muted)]">Estimated Range (next hour)</p>
              <p className="mt-2 text-xl font-semibold">{formatNumber(forecast.estimatedRangeLow, 2)}–{formatNumber(forecast.estimatedRangeHigh, 2)} A</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-medium text-[var(--ink-muted)]">Confidence</p>
              <div className="mt-2"><ConfidenceBadge confidence={forecast.confidence} className="text-sm" /></div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="p-4 text-center">
              <p className="text-xs text-[var(--ink-muted)]">Next 15 minutes</p>
              <p className="mt-1 text-lg font-semibold">{formatNumber(forecast.next15min.expectedCurrent, 2)} A</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-xs text-[var(--ink-muted)]">Next hour</p>
              <p className="mt-1 text-lg font-semibold">{formatNumber(forecast.next60min.expectedCurrent, 2)} A</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-xs text-[var(--ink-muted)]">Next 24 hours</p>
              <p className="mt-1 text-lg font-semibold">{formatNumber(forecast.next24h.expectedCurrent, 2)} A</p>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Historical + Forecast</CardTitle>
            </CardHeader>
            <CardContent>
              <ForecastChart data={chartData} nowTime={new Date(readings[readings.length - 1]?.recorded_at).getTime()} />
              <p className="mt-3 text-xs text-[var(--ink-muted)]">
                This is a statistical trend extrapolation from recent readings, not a trained time-series model.
                Confidence reflects both how much recent data exists and how consistent it is — it is never claimed
                as certainty.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
