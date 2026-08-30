"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { History as HistoryIcon, Factory } from "lucide-react";
import { useDashboard } from "@/lib/supabase/DashboardProvider";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { LoadingState, EmptyState } from "@/components/ui/States";
import { InlineSourceTag } from "@/components/dashboard/DataSourceBanner";
import { formatNumber } from "@/lib/utils";
import { format } from "date-fns";
import type { EnergyReading, AutomationEvent } from "@/lib/types";

const PAGE_SIZE = 50;

export default function HistoryPage() {
  const { machines, factory, loading: dashLoading } = useDashboard();
  const [machineId, setMachineId] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "live" | "simulation">("all");
  const [readings, setReadings] = useState<EnergyReading[]>([]);
  const [events, setEvents] = useState<AutomationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!machineId && machines.length > 0) setMachineId(machines[0].id);
  }, [machines, machineId]);

  useEffect(() => {
    setPage(0);
  }, [machineId, sourceFilter]);

  useEffect(() => {
    if (!machineId) return;
    (async () => {
      setLoading(true);
      const supabase = createClient();
      let query = supabase
        .from("energy_readings")
        .select("*")
        .eq("machine_id", machineId)
        .order("recorded_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (sourceFilter !== "all") query = query.eq("source", sourceFilter);
      const { data } = await query;
      setReadings((data as EnergyReading[]) || []);

      if (factory) {
        const { data: autoEvents } = await supabase
          .from("automation_events")
          .select("*")
          .eq("factory_id", factory.id)
          .eq("machine_id", machineId)
          .order("created_at", { ascending: false })
          .limit(10);
        setEvents((autoEvents as AutomationEvent[]) || []);
      }
      setLoading(false);
    })();
  }, [machineId, sourceFilter, page, factory]);

  if (dashLoading) return <LoadingState label="Loading…" />;
  if (machines.length === 0) {
    return (
      <EmptyState icon={Factory} title="No machines yet" description="Add a machine to see history." action={
        <Link href="/dashboard/machines" className="text-sm font-medium text-[var(--brand-strong)]">Add a machine</Link>
      } />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">History</h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">Historical readings and response log.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={machineId} onChange={(e) => setMachineId(e.target.value)} className="w-52">
            {machines.map((m) => <option key={m.id} value={m.id}>{m.machine_name} ({m.machine_code})</option>)}
          </Select>
          <Select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as "all" | "live" | "simulation")} className="w-36">
            <option value="all">All sources</option>
            <option value="live">Live only</option>
            <option value="simulation">Simulation only</option>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><HistoryIcon className="size-4 text-[var(--brand)]" /> Readings</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <LoadingState label="Loading readings…" />
          ) : readings.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-[var(--ink-muted)]">No readings found for this filter.</p>
          ) : (
            <div className="max-h-[480px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--surface)] text-xs text-[var(--ink-muted)]">
                  <tr>
                    <th className="px-5 py-2 text-left font-medium">Time</th>
                    <th className="px-5 py-2 text-left font-medium">Current</th>
                    <th className="px-5 py-2 text-left font-medium">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {readings.map((r) => (
                    <tr key={r.id}>
                      <td className="px-5 py-2 text-[var(--ink-secondary)]">{format(new Date(r.recorded_at), "MMM d, hh:mm:ss a")}</td>
                      <td className="px-5 py-2 font-medium">{formatNumber(r.current_amps, 2)} A</td>
                      <td className="px-5 py-2"><InlineSourceTag source={r.source} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Newer</Button>
            <span className="text-xs text-[var(--ink-muted)]">Page {page + 1}</span>
            <Button size="sm" variant="outline" disabled={readings.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>Older</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Human Response Log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {events.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-[var(--ink-muted)]">No responses logged yet for this machine.</p>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {events.map((e) => (
                <div key={e.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="capitalize">{e.action.replaceAll("_", " ")}</span>
                  <span className="text-xs text-[var(--ink-muted)]">{format(new Date(e.created_at), "MMM d, hh:mm:ss a")}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
