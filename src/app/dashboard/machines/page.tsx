"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Cpu, Factory, ArrowRight } from "lucide-react";
import { useDashboard } from "@/lib/supabase/DashboardProvider";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input, Select } from "@/components/ui/Input";
import { EmptyState, LoadingState } from "@/components/ui/States";
import type { Machine, PhaseType } from "@/lib/types";

const MACHINE_TYPES = [
  "Industrial Motor", "CNC Machine", "Compressor", "Pump", "Conveyor", "Chiller / HVAC",
  "Injection Molding Machine", "Furnace / Oven", "Welding Equipment", "Packaging Machine", "Other",
];

type FormState = {
  machine_name: string;
  machine_code: string;
  machine_type: string;
  department: string;
  production_line: string;
  rated_current: string;
  rated_voltage: string;
  rated_power: string;
  phase_type: PhaseType;
  power_factor_assumption: string;
  expected_operating_schedule: string;
  production_output_unit: string;
  connected_device_id: string;
  baseline_sample_requirement: string;
};

const EMPTY_FORM: FormState = {
  machine_name: "",
  machine_code: "",
  machine_type: MACHINE_TYPES[0],
  department: "",
  production_line: "",
  rated_current: "",
  rated_voltage: "415",
  rated_power: "",
  phase_type: "three",
  power_factor_assumption: "0.9",
  expected_operating_schedule: "",
  production_output_unit: "units",
  connected_device_id: "",
  baseline_sample_requirement: "30",
};

export default function MachinesPage() {
  const { machines, devices, factory, loading, refreshMachines, refreshDevices } = useDashboard();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Machine | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Machine | null>(null);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(m: Machine) {
    setEditing(m);
    setForm({
      machine_name: m.machine_name,
      machine_code: m.machine_code,
      machine_type: m.machine_type,
      department: m.department || "",
      production_line: m.production_line || "",
      rated_current: String(m.rated_current ?? ""),
      rated_voltage: String(m.rated_voltage ?? ""),
      rated_power: m.rated_power != null ? String(m.rated_power) : "",
      phase_type: m.phase_type,
      power_factor_assumption: String(m.power_factor_assumption ?? 0.9),
      expected_operating_schedule: m.expected_operating_schedule || "",
      production_output_unit: m.production_output_unit || "units",
      connected_device_id: m.connected_device_id || "",
      baseline_sample_requirement: String(m.baseline_sample_requirement ?? 30),
    });
    setError(null);
    setModalOpen(true);
  }

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!factory) return;
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const payload = {
      factory_id: factory.id,
      machine_name: form.machine_name,
      machine_code: form.machine_code,
      machine_type: form.machine_type,
      department: form.department || null,
      production_line: form.production_line || null,
      rated_current: Number(form.rated_current) || 0,
      rated_voltage: Number(form.rated_voltage) || 0,
      rated_power: form.rated_power ? Number(form.rated_power) : null,
      phase_type: form.phase_type,
      power_factor_assumption: Number(form.power_factor_assumption) || 0.9,
      expected_operating_schedule: form.expected_operating_schedule || null,
      production_output_unit: form.production_output_unit || null,
      connected_device_id: form.connected_device_id || null,
      baseline_sample_requirement: Number(form.baseline_sample_requirement) || 30,
    };

    const { error } = editing
      ? await supabase.from("machines").update(payload).eq("id", editing.id)
      : await supabase.from("machines").insert(payload);

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setModalOpen(false);
    await Promise.all([refreshMachines(), refreshDevices()]);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const supabase = createClient();
    await supabase.from("machines").delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);
    await refreshMachines();
  }

  const availableDevices = devices.filter((d) => !d.machine_id || d.machine_id === editing?.connected_device_id);

  if (loading) return <LoadingState label="Loading machines…" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Machines</h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">Register and configure machines to monitor.</p>
        </div>
        <Button onClick={openAdd} className="gap-1.5">
          <Plus className="size-4" /> Add Machine
        </Button>
      </div>

      {machines.length === 0 ? (
        <EmptyState
          icon={Factory}
          title="No machines registered"
          description="Add your first machine, then connect an EcoClamp device to it."
          action={<Button size="sm" onClick={openAdd}>Add Machine</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {machines.map((m) => {
            const device = devices.find((d) => d.id === m.connected_device_id);
            return (
              <Card key={m.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold">{m.machine_name}</p>
                    <p className="text-xs text-[var(--ink-muted)]">{m.machine_code} · {m.machine_type}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(m)} className="rounded-lg p-1.5 text-[var(--ink-muted)] hover:bg-[var(--border)] hover:text-[var(--ink-primary)]">
                      <Pencil className="size-4" />
                    </button>
                    <button onClick={() => setDeleteTarget(m)} className="rounded-lg p-1.5 text-[var(--ink-muted)] hover:bg-[color-mix(in_srgb,var(--status-critical)_12%,transparent)] hover:text-[var(--status-critical)]">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-y-2 text-xs">
                  <dt className="text-[var(--ink-muted)]">Department</dt>
                  <dd className="text-right font-medium">{m.department || "—"}</dd>
                  <dt className="text-[var(--ink-muted)]">Production Line</dt>
                  <dd className="text-right font-medium">{m.production_line || "—"}</dd>
                  <dt className="text-[var(--ink-muted)]">Rated Current</dt>
                  <dd className="text-right font-medium">{m.rated_current} A</dd>
                  <dt className="text-[var(--ink-muted)]">Rated Voltage</dt>
                  <dd className="text-right font-medium">{m.rated_voltage} V ({m.phase_type === "three" ? "3-phase" : "1-phase"})</dd>
                </dl>

                <div className="mt-4 flex items-center gap-2 rounded-lg bg-[var(--border)]/50 px-3 py-2 text-xs">
                  <Cpu className="size-3.5 text-[var(--ink-muted)]" />
                  {device ? (
                    <span className="font-medium">{device.device_name} ({device.device_code})</span>
                  ) : (
                    <span className="text-[var(--ink-muted)]">No EcoClamp device connected</span>
                  )}
                </div>

                <Link
                  href={`/dashboard/machines/${m.id}`}
                  className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-strong)] py-2 text-xs font-medium text-[var(--ink-secondary)] hover:bg-[var(--border)]"
                >
                  View details <ArrowRight className="size-3.5" />
                </Link>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Machine" : "Add Machine"}
        description="Configure the machine EcoClamp will monitor."
        wide
      >
        <form onSubmit={handleSave} className="space-y-4">
          {error && <p className="rounded-lg bg-[color-mix(in_srgb,var(--status-critical)_10%,transparent)] p-3 text-xs text-[var(--status-critical)]">{error}</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Machine Name" htmlFor="machine_name">
              <Input id="machine_name" required value={form.machine_name} onChange={(e) => update("machine_name", e.target.value)} placeholder="CNC Machine 01" />
            </FormField>
            <FormField label="Machine ID" htmlFor="machine_code" hint="e.g. M-001">
              <Input id="machine_code" required value={form.machine_code} onChange={(e) => update("machine_code", e.target.value)} placeholder="M-001" />
            </FormField>
            <FormField label="Machine Type" htmlFor="machine_type">
              <Select id="machine_type" value={form.machine_type} onChange={(e) => update("machine_type", e.target.value)}>
                {MACHINE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </FormField>
            <FormField label="Department" htmlFor="department">
              <Input id="department" value={form.department} onChange={(e) => update("department", e.target.value)} placeholder="Machining" />
            </FormField>
            <FormField label="Production Line" htmlFor="production_line">
              <Input id="production_line" value={form.production_line} onChange={(e) => update("production_line", e.target.value)} placeholder="Line A" />
            </FormField>
            <FormField label="Production Output Unit" htmlFor="production_output_unit" hint="e.g. units, kg, meters">
              <Input id="production_output_unit" value={form.production_output_unit} onChange={(e) => update("production_output_unit", e.target.value)} placeholder="units" />
            </FormField>
            <FormField label="Rated Current (A)" htmlFor="rated_current">
              <Input id="rated_current" type="number" step="0.01" required value={form.rated_current} onChange={(e) => update("rated_current", e.target.value)} placeholder="10" />
            </FormField>
            <FormField label="Rated Voltage (V)" htmlFor="rated_voltage">
              <Input id="rated_voltage" type="number" step="1" required value={form.rated_voltage} onChange={(e) => update("rated_voltage", e.target.value)} />
            </FormField>
            <FormField label="Phase Type" htmlFor="phase_type" hint="Three-phase machines use √3 × V × I formula">
              <Select id="phase_type" value={form.phase_type} onChange={(e) => update("phase_type", e.target.value as PhaseType)}>
                <option value="single">Single-phase</option>
                <option value="three">Three-phase</option>
              </Select>
            </FormField>
            <FormField label="Rated Power (kW, optional)" htmlFor="rated_power">
              <Input id="rated_power" type="number" step="0.01" value={form.rated_power} onChange={(e) => update("rated_power", e.target.value)} placeholder="Auto-estimated if blank" />
            </FormField>
            <FormField label="Power Factor Assumption" htmlFor="power_factor_assumption">
              <Input id="power_factor_assumption" type="number" step="0.01" min="0.1" max="1" value={form.power_factor_assumption} onChange={(e) => update("power_factor_assumption", e.target.value)} />
            </FormField>
            <FormField label="Baseline Sample Requirement" htmlFor="baseline_sample_requirement" hint="Readings needed before baseline is 'established'">
              <Input id="baseline_sample_requirement" type="number" min="5" value={form.baseline_sample_requirement} onChange={(e) => update("baseline_sample_requirement", e.target.value)} />
            </FormField>
            <FormField label="Expected Operating Schedule" htmlFor="expected_operating_schedule">
              <Input id="expected_operating_schedule" value={form.expected_operating_schedule} onChange={(e) => update("expected_operating_schedule", e.target.value)} placeholder="Mon–Sat, 9 AM – 6 PM" />
            </FormField>
            <FormField label="Connected Device" htmlFor="connected_device_id">
              <Select id="connected_device_id" value={form.connected_device_id} onChange={(e) => update("connected_device_id", e.target.value)}>
                <option value="">Not connected</option>
                {availableDevices.map((d) => (
                  <option key={d.id} value={d.id}>{d.device_name} ({d.device_code})</option>
                ))}
              </Select>
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? "Save changes" : "Add machine"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete machine?" description="This permanently removes the machine and its historical data.">
        <p className="text-sm text-[var(--ink-secondary)]">
          Are you sure you want to delete <strong>{deleteTarget?.machine_name}</strong>? This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
