"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { format } from "date-fns";

export interface EnergyBucket {
  bucketStart: number; // epoch ms
  kwh: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: number;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length || label == null) return null;
  return (
    <div className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 py-2 text-xs shadow-[var(--shadow-md)]">
      <p className="font-medium text-[var(--ink-primary)]">{format(new Date(label), "MMM d, HH:mm")}</p>
      <p className="mt-0.5 text-[var(--series-1)]">{payload[0].value.toFixed(2)} kWh (est.)</p>
    </div>
  );
}

export function EnergyTrendChart({ data, height = 260 }: { data: EnergyBucket[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="energyFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--gridline)" vertical={false} />
        <XAxis
          dataKey="bucketStart"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(v) => format(new Date(v), "HH:mm")}
          stroke="var(--axis)"
          tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: "var(--border-strong)" }}
        />
        <YAxis unit=" kWh" stroke="var(--axis)" tick={{ fill: "var(--ink-muted)", fontSize: 11 }} tickLine={false} axisLine={false} width={64} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="kwh" stroke="var(--series-1)" strokeWidth={2} fill="url(#energyFill)" isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
