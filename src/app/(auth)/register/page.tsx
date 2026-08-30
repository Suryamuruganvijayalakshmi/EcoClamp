"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { FormField, Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { AlertCircle, CheckCircle2 } from "lucide-react";

const INDUSTRY_TYPES = [
  "General Manufacturing",
  "Textiles & Apparel",
  "Food Processing",
  "Metal & Machining",
  "Plastics & Rubber",
  "Chemicals & Pharma",
  "Automotive Components",
  "Electronics Assembly",
  "Cement & Building Materials",
  "Paper & Packaging",
  "Other",
];

const INDIAN_STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Gujarat", "Haryana",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Odisha", "Punjab",
  "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Other",
];

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    companyName: "",
    industryType: INDUSTRY_TYPES[0],
    state: INDIAN_STATES[0],
    district: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.fullName,
            phone_number: form.phoneNumber,
            company_name: form.companyName,
            industry_type: form.industryType,
            state: form.state,
            district: form.district,
          },
        },
      });

      if (error) {
        setError(error.message);
        return;
      }

      setSuccess(true);
      // If email confirmation is disabled on the Supabase project, a session
      // exists immediately and we can go straight to the dashboard.
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Couldn't reach the server. Check your internet connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <AuthShell title="Check your inbox" subtitle="Almost there.">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="size-10 text-[var(--status-good)]" />
          <p className="text-sm text-[var(--ink-secondary)]">
            We&apos;ve sent a confirmation link to <strong>{form.email}</strong>. Confirm your email, then log in
            to your new EcoClamp dashboard.
          </p>
          <Link href="/login" className="mt-2">
            <Button variant="outline">Go to login</Button>
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      wide
      title="Register your factory"
      subtitle="Create your EcoClamp account to start monitoring machines."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-[color-mix(in_srgb,var(--status-critical)_10%,transparent)] p-3 text-xs text-[var(--status-critical)]">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Full Name" htmlFor="fullName">
            <Input id="fullName" required value={form.fullName} onChange={(e) => update("fullName", e.target.value)} placeholder="Priya Sharma" />
          </FormField>
          <FormField label="Email" htmlFor="email">
            <Input id="email" type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@company.com" />
          </FormField>
          <FormField label="Phone Number" htmlFor="phoneNumber">
            <Input id="phoneNumber" type="tel" required value={form.phoneNumber} onChange={(e) => update("phoneNumber", e.target.value)} placeholder="+91 90000 00000" />
          </FormField>
          <FormField label="Company Name" htmlFor="companyName">
            <Input id="companyName" required value={form.companyName} onChange={(e) => update("companyName", e.target.value)} placeholder="Sharma Precision Works" />
          </FormField>
          <FormField label="Industry Type" htmlFor="industryType">
            <Select id="industryType" value={form.industryType} onChange={(e) => update("industryType", e.target.value)}>
              {INDUSTRY_TYPES.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="State" htmlFor="state">
            <Select id="state" value={form.state} onChange={(e) => update("state", e.target.value)}>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="District" htmlFor="district">
            <Input id="district" required value={form.district} onChange={(e) => update("district", e.target.value)} placeholder="Pune" />
          </FormField>
          <FormField label="Password" htmlFor="password" hint="At least 8 characters">
            <Input id="password" type="password" required value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="••••••••" />
          </FormField>
          <FormField label="Confirm Password" htmlFor="confirmPassword">
            <Input id="confirmPassword" type="password" required value={form.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} placeholder="••••••••" />
          </FormField>
        </div>

        <Button type="submit" className="w-full" loading={loading}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-[var(--ink-muted)]">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[var(--brand-strong)] hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
