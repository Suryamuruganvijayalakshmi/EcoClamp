"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { FormField, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { AlertCircle, MailCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/dashboard/settings` : undefined,
      });

      if (error) {
        setError(error.message);
        return;
      }
      setSent(true);
    } catch {
      setError("Couldn't reach the server. Check your internet connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthShell title="Reset link sent" subtitle="Check your inbox.">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <MailCheck className="size-10 text-[var(--status-good)]" />
          <p className="text-sm text-[var(--ink-secondary)]">
            If an account exists for <strong>{email}</strong>, a password reset link has been sent.
          </p>
          <Link href="/login" className="mt-2">
            <Button variant="outline">Back to login</Button>
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot your password?" subtitle="We'll email you a reset link.">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-[color-mix(in_srgb,var(--status-critical)_10%,transparent)] p-3 text-xs text-[var(--status-critical)]">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <FormField label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </FormField>
        <Button type="submit" className="w-full" loading={loading}>
          Send reset link
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-[var(--ink-muted)]">
        <Link href="/login" className="font-medium text-[var(--brand-strong)] hover:underline">
          Back to login
        </Link>
      </p>
    </AuthShell>
  );
}
