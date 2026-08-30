"use client";

import { useEffect, useState } from "react";
import { User, Save, CheckCircle2, KeyRound } from "lucide-react";
import { useDashboard } from "@/lib/supabase/DashboardProvider";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormField, Input } from "@/components/ui/Input";
import { LoadingState } from "@/components/ui/States";

export default function ProfilePage() {
  const { profile, loading, refreshProfile } = useDashboard();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setPhone(profile.phone_number || "");
    }
  }, [profile]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setSaved(false);
    const supabase = createClient();
    await supabase.from("profiles").update({ full_name: fullName, phone_number: phone }).eq("id", profile.id);
    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setPwMessage("Password must be at least 8 characters.");
      return;
    }
    setPwSaving(true);
    setPwMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwSaving(false);
    if (error) {
      setPwMessage(error.message);
      return;
    }
    setNewPassword("");
    setPwMessage("Password updated successfully.");
  }

  if (loading || !profile) return <LoadingState label="Loading profile…" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">Your personal account details.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="size-4 text-[var(--brand)]" /> Personal Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Full Name" htmlFor="full_name">
                <Input id="full_name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </FormField>
              <FormField label="Email" htmlFor="email">
                <Input id="email" value={profile.email} disabled className="opacity-60" />
              </FormField>
              <FormField label="Phone Number" htmlFor="phone">
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
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
          <CardTitle className="flex items-center gap-2"><KeyRound className="size-4 text-[var(--brand)]" /> Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            {pwMessage && (
              <p className={`text-xs ${pwMessage.includes("success") ? "text-[var(--status-good)]" : "text-[var(--status-critical)]"}`}>{pwMessage}</p>
            )}
            <FormField label="New Password" htmlFor="new_password" hint="At least 8 characters">
              <Input id="new_password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
            </FormField>
            <Button type="submit" loading={pwSaving} variant="outline">Update password</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
