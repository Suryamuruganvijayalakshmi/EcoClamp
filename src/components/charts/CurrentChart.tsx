"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { format } from "date-fns";
import type { EnergyReading } from "@/lib/types";

export interface ChartPoint {
  time: number; // epoch ms
  current: number;
  source: "live" | "simulation";
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
  label?: number;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length || label == null) return null;
  const point: ChartPoint = payload[0].payload;
  return (
    <div className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 py-2 text-xs shadow-[var(--shadow-md)]">
      <p className="font-medium text-[var(--ink-primary)]">{format(new Date(label), "HH:mm:ss")}</p>
      <p className="mt-0.5 text-[var(--series-1)]">{point.current.toFixed(2)} A</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--ink-muted)]">{point.source}</p>
    </div>
  );
}

export function CurrentChart({
  readings,
  baselineAvg,
  minNormal,
  maxNormal,
  height = 280,
}: {
  readings: EnergyReading[];
  baselineAvg?: number;
  minNormal?: number;
  maxNormal?: number;
  height?: number;
}) {
  const data: ChartPoint[] = readings.map((r) => ({
    time: new Date(r.recorded_at).getTime(),
    current: r.current_amps,
    source: r.source,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--gridline)" vertical={false} />
        <XAxis
          dataKey="time"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(v) => format(new Date(v), "HH:mm")}
          stroke="var(--axis)"
          tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: "var(--border-strong)" }}
        />
        <YAxis
          unit=" A"
          stroke="var(--axis)"
          tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <Tooltip content={<CustomTooltip />} />
        {minNormal != null && maxNormal != null && (
          <ReferenceArea y1={minNormal} y2={maxNormal} fill="var(--series-3)" fillOpacity={0.08} strokeOpacity={0} />
        )}
        {baselineAvg != null && baselineAvg > 0 && (
          <ReferenceLine
            y={baselineAvg}
            stroke="var(--series-3)"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{ value: "Baseline", position: "insideTopRight", fill: "var(--series-3)", fontSize: 11 }}
          />
        )}
        <Line
          type="monotone"
          dataKey="current"
          stroke="var(--series-1)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
