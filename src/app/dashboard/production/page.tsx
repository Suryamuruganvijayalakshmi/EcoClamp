"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Package } from "lucide-react";
import { useDashboard } from "@/lib/supabase/DashboardProvider";
import { createClient } from "@/lib/supabase/client";
import { bucketEnergyByHour, defaultAssumptions } from "@/lib/engine/energy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input, Select } from "@/components/ui/Input";
import { LoadingState, EmptyState } from "@/components/ui/States";
import { BarMetricChart, type BarPoint } from "@/components/charts/BarMetricChart";
import { formatNumber } from "@/lib/utils";
import { format } from "date-fns";
import type { ProductionRecord, EnergyReading } from "@/lib/types";

export default function ProductionPage() {
  const { machines, factory, loading: dashLoading } = useDashboard();
  const [machineId, setMachineId] = useState("");
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [readings, setReadings] = useState<EnergyReading[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ batch: "", quantity: "", unit: "units", operating_hours: "", date: format(new Date(), "yyyy-MM-dd") });

  useEffect(() => {
    if (!machineId && machines.length > 0) setMachineId(machines[0].id);
  }, [machines, machineId]);

  useEffect(() => {
    const machine = machines.find((m) => m.id === machineId);
    if (machine) setForm((f) => ({ ...f, unit: machine.production_output_unit || "units" }));
  }, [machineId, machines]);

  async function loadData() {
    if (!machineId || !factory) return;
    setLoadingData(true);
    const supabase = createClient();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [{ data: prod }, { data: reads }] = await Promise.all([
      supabase.from("production_records").select("*").eq("machine_id", machineId).gte("recorded_at", since.toISOString()).order("recorded_at", { ascending: false }),
      supabase.from("energy_readings").select("*").eq("machine_id", machineId).gte("recorded_at", since.toISOString()).order("recorded_at", { ascending: true }).limit(5000),
    ]);
    setRecords((prod as ProductionRecord[]) || []);
    setReadings((reads as EnergyReading[]) || []);
    setLoadingData(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineId, factory]);

  const machine = machines.find((m) => m.id === machineId);

  const dailyIntensity = useMemo(() => {
    if (!machine || readings.length === 0 || records.length === 0) return [];
    const assumptions = { ...defaultAssumptions(machine.phase_type), powerFactor: machine.power_factor_assumption };
    const hourlyBuckets = bucketEnergyByHour(readings, assumptions);

    const energyByDay = new Map<number, number>();
    for (const b of hourlyBuckets) {
      const dayKey = new Date(b.bucketStart).setHours(0, 0, 0, 0);
      energyByDay.set(dayKey, (energyByDay.get(dayKey) || 0) + b.kwh);
    }

    const qtyByDay = new Map<number, number>();
    for (const r of records) {
      const dayKey = new Date(r.recorded_at).setHours(0, 0, 0, 0);
      qtyByDay.set(dayKey, (qtyByDay.get(dayKey) || 0) + r.quantity);
    }

    const points: BarPoint[] = [];
    for (const [day, qty] of qtyByDay.entries()) {
      const energy = energyByDay.get(day) || 0;
      if (qty > 0) points.push({ day, value: energy / qty });
    }
    return points.sort((a, b) => a.day - b.day);
  }, [readings, records, machine]);

  const best = dailyIntensity.length ? dailyIntensity.reduce((a, b) => (b.value < a.value ? b : a)) : null;
  const worst = dailyIntensity.length ? dailyIntensity.reduce((a, b) => (b.value > a.value ? b : a)) : null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!factory || !machineId) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("production_records").insert({
      factory_id: factory.id,
      machine_id: machineId,
      batch: form.batch || null,
      quantity: Number(form.quantity) || 0,
      unit: form.unit,
      operating_hours: Number(form.operating_hours) || 0,
      recorded_at: new Date(form.date).toISOString(),
    });
    setSaving(false);
    setModalOpen(false);
    setForm((f) => ({ ...f, batch: "", quantity: "", operating_hours: "" }));
    await loadData();
  }

  if (dashLoading) return <LoadingState label="Loading…" />;
  if (machines.length === 0) {
    return (
      <EmptyState icon={Package} title="No machines yet" description="Add a machine to log production output." action={
        <Link href="/dashboard/machines" className="text-sm font-medium text-[var(--brand-strong)]">Add a machine</Link>
      } />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Production &amp; Yield</h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">Operator-entered output — never inferred from current alone.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={machineId} onChange={(e) => setMachineId(e.target.value)} className="w-52">
            {machines.map((m) => <option key={m.id} value={m.id}>{m.machine_name} ({m.machine_code})</option>)}
          </Select>
          <Button onClick={() => setModalOpen(true)} className="gap-1.5"><Plus className="size-4" /> Log Production</Button>
        </div>
      </div>

      {loadingData ? (
        <LoadingState label="Loading production data…" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card className="p-5">
              <p className="text-xs font-medium text-[var(--ink-muted)]">Best Operating Period</p>
              {best ? (
                <>
                  <p className="mt-2 text-xl font-semibold text-[var(--status-good)]">{formatNumber(best.value, 3)} kWh/unit</p>
                  <p className="text-xs text-[var(--ink-muted)]">{format(new Date(best.day), "MMM d, yyyy")}</p>
                </>
              ) : <p className="mt-2 text-sm text-[var(--ink-muted)]">Not enough data yet</p>}
            </Card>
            <Card className="p-5">
              <p className="text-xs font-medium text-[var(--ink-muted)]">Worst Operating Period</p>
              {worst ? (
                <>
                  <p className="mt-2 text-xl font-semibold text-[var(--status-critical)]">{formatNumber(worst.value, 3)} kWh/unit</p>
                  <p className="text-xs text-[var(--ink-muted)]">{format(new Date(worst.day), "MMM d, yyyy")}</p>
                </>
              ) : <p className="mt-2 text-sm text-[var(--ink-muted)]">Not enough data yet</p>}
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Energy Intensity Trend (kWh per unit produced)</CardTitle>
            </CardHeader>
            <CardContent>
              {dailyIntensity.length === 0 ? (
                <EmptyState title="No production + energy overlap yet" description="Log production entries for days with recorded current readings to see this trend." />
              ) : (
                <BarMetricChart data={dailyIntensity} unit="kWh/unit" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Production Records</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {records.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-[var(--ink-muted)]">No production logged yet for this machine.</p>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {records.map((r) => (
                    <div key={r.id} className="flex items-center justify-between px-5 py-3 text-sm">
                      <div>
                        <p className="font-medium">{r.quantity} {r.unit}{r.batch ? ` · Batch ${r.batch}` : ""}</p>
                        <p className="text-xs text-[var(--ink-muted)]">{r.operating_hours}h operating · {format(new Date(r.recorded_at), "MMM d, yyyy")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log Production" description={machine?.machine_name}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Production Quantity" htmlFor="quantity">
              <Input id="quantity" type="number" step="0.01" required value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
            </FormField>
            <FormField label="Unit" htmlFor="unit">
              <Input id="unit" required value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
            </FormField>
            <FormField label="Operating Hours" htmlFor="operating_hours">
              <Input id="operating_hours" type="number" step="0.1" required value={form.operating_hours} onChange={(e) => setForm((f) => ({ ...f, operating_hours: e.target.value }))} />
            </FormField>
            <FormField label="Date" htmlFor="date">
              <Input id="date" type="date" required value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </FormField>
            <FormField label="Batch (optional)" htmlFor="batch">
              <Input id="batch" value={form.batch} onChange={(e) => setForm((f) => ({ ...f, batch: e.target.value }))} />
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
