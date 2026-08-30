"use client";

import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Save, CheckCircle2 } from "lucide-react";
import { useDashboard } from "@/lib/supabase/DashboardProvider";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormField, Input } from "@/components/ui/Input";
import { LoadingState } from "@/components/ui/States";

export default function SettingsPage() {
  const { factory, loading, refreshProfile } = useDashboard();
  const [form, setForm] = useState({ company_name: "", industry_type: "", state: "", district: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (factory) {
      setForm({
        company_name: factory.company_name,
        industry_type: factory.industry_type,
        state: factory.state,
        district: factory.district,
      });
    }
  }, [factory]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!factory) return;
    setSaving(true);
    setSaved(false);
    const supabase = createClient();
    await supabase.from("factories").update(form).eq("id", factory.id);
    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) return <LoadingState label="Loading settings…" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">Factory profile and platform configuration.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><SettingsIcon className="size-4 text-[var(--brand)]" /> Factory Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Company Name" htmlFor="company_name">
                <Input id="company_name" required value={form.company_name} onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))} />
              </FormField>
              <FormField label="Industry Type" htmlFor="industry_type">
                <Input id="industry_type" required value={form.industry_type} onChange={(e) => setForm((f) => ({ ...f, industry_type: e.target.value }))} />
              </FormField>
              <FormField label="State" htmlFor="state">
                <Input id="state" required value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
              </FormField>
              <FormField label="District" htmlFor="district">
                <Input id="district" required value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} />
              </FormField>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" loading={saving} className="gap-1.5"><Save className="size-4" /> Save changes</Button>
              {saved && <span className="flex items-center gap-1 text-sm text-[var(--status-good)]"><CheckCircle2 className="size-4" /> Saved</span>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About Energy Assumptions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--ink-secondary)]">
            Voltage, power factor, and phase type are configured per-machine (Machines → Edit), since different
            equipment on your floor may run on different supplies. Every energy figure derived from current alone
            is labelled <strong>estimated</strong> throughout the platform.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
