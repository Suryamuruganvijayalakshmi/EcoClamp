"use client";

import { useState } from "react";
import { Plus, Cpu, Copy, Check, Trash2, Pencil, Wifi, WifiOff } from "lucide-react";
import { useDashboard } from "@/lib/supabase/DashboardProvider";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { timeAgo } from "@/lib/utils";
import type { Device } from "@/lib/types";

export default function DevicesPage() {
  const { devices, machines, factory, loading, refreshDevices, refreshMachines } = useDashboard();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [deviceCode, setDeviceCode] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [machineId, setMachineId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function openAdd() {
    setEditing(null);
    setDeviceCode("");
    setDeviceName("");
    setMachineId("");
    setError(null);
    setModalOpen(true);
  }

  function openEdit(d: Device) {
    setEditing(d);
    setDeviceCode(d.device_code);
    setDeviceName(d.device_name);
    setMachineId(d.machine_id || "");
    setError(null);
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!factory) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();

    if (editing) {
      const { error } = await supabase
        .from("devices")
        .update({ device_code: deviceCode, device_name: deviceName, machine_id: machineId || null })
        .eq("id", editing.id);
      if (error) { setError(error.message); setSaving(false); return; }
      if (machineId) await supabase.from("machines").update({ connected_device_id: editing.id }).eq("id", machineId);
    } else {
      const { data, error } = await supabase
        .from("devices")
        .insert({ factory_id: factory.id, device_code: deviceCode, device_name: deviceName, machine_id: machineId || null })
        .select()
        .single();
      if (error) { setError(error.message); setSaving(false); return; }
      if (machineId && data) await supabase.from("machines").update({ connected_device_id: data.id }).eq("id", machineId);
    }

    setSaving(false);
    setModalOpen(false);
    await Promise.all([refreshDevices(), refreshMachines()]);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const supabase = createClient();
    await supabase.from("devices").delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);
    await Promise.all([refreshDevices(), refreshMachines()]);
  }

  function copyKey(id: string, key: string) {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  if (loading) return <LoadingState label="Loading devices…" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">EcoClamp Devices</h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">Physical ESP32 + CT sensor units and their pairing.</p>
        </div>
        <Button onClick={openAdd} className="gap-1.5">
          <Plus className="size-4" /> Connect EcoClamp
        </Button>
      </div>

      {devices.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title="No devices connected"
          description="Register an EcoClamp device to start receiving live current readings from your ESP32 hardware."
          action={<Button size="sm" onClick={openAdd}>Connect EcoClamp</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {devices.map((d) => {
            const machine = machines.find((m) => m.id === d.machine_id);
            const online = d.status === "connected" && d.last_seen_at && Date.now() - new Date(d.last_seen_at).getTime() < 5 * 60 * 1000;
            return (
              <Card key={d.id} className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                      <Cpu className="size-4.5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{d.device_name}</p>
                      <p className="text-xs text-[var(--ink-muted)]">{d.device_code}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(d)} className="rounded-lg p-1.5 text-[var(--ink-muted)] hover:bg-[var(--border)]"><Pencil className="size-4" /></button>
                    <button onClick={() => setDeleteTarget(d)} className="rounded-lg p-1.5 text-[var(--ink-muted)] hover:bg-[color-mix(in_srgb,var(--status-critical)_12%,transparent)] hover:text-[var(--status-critical)]"><Trash2 className="size-4" /></button>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  {online ? (
                    <Badge tone="good"><Wifi className="size-3" /> Connected</Badge>
                  ) : (
                    <Badge tone="neutral"><WifiOff className="size-3" /> {d.status === "never_seen" ? "Never seen" : "Disconnected"}</Badge>
                  )}
                  {d.last_seen_at && <span className="text-xs text-[var(--ink-muted)]">Last seen {timeAgo(d.last_seen_at)}</span>}
                </div>

                <p className="mt-3 text-xs text-[var(--ink-muted)]">
                  Paired machine: <span className="font-medium text-[var(--ink-secondary)]">{machine ? machine.machine_name : "Unassigned"}</span>
                </p>

                <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-[var(--border)]/40 px-3 py-2">
                  <code className="truncate text-[11px] text-[var(--ink-muted)]">{d.api_key}</code>
                  <button onClick={() => copyKey(d.id, d.api_key)} className="shrink-0 text-[var(--ink-muted)] hover:text-[var(--ink-primary)]">
                    {copiedId === d.id ? <Check className="size-3.5 text-[var(--status-good)]" /> : <Copy className="size-3.5" />}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Ingesting live readings from your ESP32</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--ink-secondary)]">
            Have the ESP32 POST each CT current reading to your ingestion endpoint with the device&apos;s API key.
            Every reading sent here is stored with <code>source = &quot;live&quot;</code>.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-[var(--ink-primary)] p-4 text-[11px] leading-relaxed text-[var(--page)]">
{`POST /api/ingest
X-Ingest-Key: <ECOCLAMP_INGEST_SHARED_SECRET>
X-Device-Key: <device api_key>
Content-Type: application/json

{
  "machine_id": "M-001",
  "device_id": "EC-001",
  "current": 3.82,
  "timestamp": "2026-08-29T10:15:00Z"
}`}
          </pre>
          <p className="mt-2 text-xs text-[var(--ink-muted)]">
            See the included <code>firmware/ecoclamp_esp32.ino</code> sketch for a ready-to-flash example.
          </p>
        </CardContent>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Device" : "Connect EcoClamp"}>
        <form onSubmit={handleSave} className="space-y-4">
          {error && <p className="rounded-lg bg-[color-mix(in_srgb,var(--status-critical)_10%,transparent)] p-3 text-xs text-[var(--status-critical)]">{error}</p>}
          <FormField label="Device ID" htmlFor="device_code" hint="e.g. EC-001">
            <Input id="device_code" required value={deviceCode} onChange={(e) => setDeviceCode(e.target.value)} placeholder="EC-001" />
          </FormField>
          <FormField label="Device Name" htmlFor="device_name">
            <Input id="device_name" required value={deviceName} onChange={(e) => setDeviceName(e.target.value)} placeholder="Shopfloor Clamp 1" />
          </FormField>
          <FormField label="Pair with Machine" htmlFor="machine_id">
            <Select id="machine_id" value={machineId} onChange={(e) => setMachineId(e.target.value)}>
              <option value="">Unassigned</option>
              {machines.map((m) => <option key={m.id} value={m.id}>{m.machine_name} ({m.machine_code})</option>)}
            </Select>
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? "Save changes" : "Connect device"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remove device?">
        <p className="text-sm text-[var(--ink-secondary)]">
          Remove <strong>{deleteTarget?.device_name}</strong>? Its API key will stop working immediately.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Remove</Button>
        </div>
      </Modal>
    </div>
  );
}
