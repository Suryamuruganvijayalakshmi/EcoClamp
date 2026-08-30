"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { format } from "date-fns";

export interface ForecastChartPoint {
  time: number;
  historical?: number;
  forecast?: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: { dataKey: string; value: number }[];
  label?: number;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length || label == null) return null;
  const hist = payload.find((p) => p.dataKey === "historical")?.value;
  const fc = payload.find((p) => p.dataKey === "forecast")?.value;
  return (
    <div className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 py-2 text-xs shadow-[var(--shadow-md)]">
      <p className="font-medium text-[var(--ink-primary)]">{format(new Date(label), "HH:mm")}</p>
      {hist != null && <p className="mt-0.5 text-[var(--series-1)]">Historical: {hist.toFixed(2)} A</p>}
      {fc != null && <p className="mt-0.5 text-[var(--series-5)]">Forecast: {fc.toFixed(2)} A</p>}
    </div>
  );
}

export function ForecastChart({ data, nowTime, height = 300 }: { data: ForecastChartPoint[]; nowTime: number; height?: number }) {
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
        <YAxis unit=" A" stroke="var(--axis)" tick={{ fill: "var(--ink-muted)", fontSize: 11 }} tickLine={false} axisLine={false} width={52} />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine x={nowTime} stroke="var(--border-strong)" strokeDasharray="3 3" label={{ value: "Now", position: "insideTop", fill: "var(--ink-muted)", fontSize: 10 }} />
        <Line type="monotone" dataKey="historical" stroke="var(--series-1)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
        <Line type="monotone" dataKey="forecast" stroke="var(--series-5)" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}
