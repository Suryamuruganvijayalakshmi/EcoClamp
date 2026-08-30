"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { format } from "date-fns";

export interface BarPoint {
  day: number; // epoch ms (start of day)
  value: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: number;
  unit?: string;
}

function CustomTooltip({ active, payload, label, unit }: TooltipProps) {
  if (!active || !payload?.length || label == null) return null;
  return (
    <div className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 py-2 text-xs shadow-[var(--shadow-md)]">
      <p className="font-medium text-[var(--ink-primary)]">{format(new Date(label), "MMM d")}</p>
      <p className="mt-0.5 text-[var(--series-1)]">{payload[0].value.toFixed(3)} {unit}</p>
    </div>
  );
}

export function BarMetricChart({ data, unit = "", height = 240 }: { data: BarPoint[]; unit?: string; height?: number }) {
  const maxVal = Math.max(...data.map((d) => d.value), 0.0001);
  const minVal = Math.min(...data.map((d) => d.value), 0);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--gridline)" vertical={false} />
        <XAxis dataKey="day" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(v) => format(new Date(v), "MMM d")} stroke="var(--axis)" tick={{ fill: "var(--ink-muted)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--border-strong)" }} />
        <YAxis stroke="var(--axis)" tick={{ fill: "var(--ink-muted)", fontSize: 11 }} tickLine={false} axisLine={false} width={56} />
        <Tooltip content={<CustomTooltip unit={unit} />} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.value === maxVal ? "var(--status-critical)" : d.value === minVal ? "var(--status-good)" : "var(--series-1)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
