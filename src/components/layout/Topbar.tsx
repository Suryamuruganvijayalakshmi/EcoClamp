"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Menu, LogOut, ChevronDown, User as UserIcon, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDashboard } from "@/lib/supabase/DashboardProvider";

export function Topbar({ onMenuClick, title }: { onMenuClick: () => void; title?: string }) {
  const router = useRouter();
  const { profile, factory } = useDashboard();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const initials = (profile?.full_name || profile?.email || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--border)] bg-[var(--page)]/85 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="text-[var(--ink-secondary)] lg:hidden">
          <Menu className="size-5" />
        </button>
        <div>
          <p className="text-sm font-semibold">{title || "Dashboard"}</p>
          {factory && <p className="text-xs text-[var(--ink-muted)]">{factory.company_name}</p>}
        </div>
      </div>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2 rounded-full border border-[var(--border-strong)] py-1 pl-1 pr-2.5 hover:bg-[var(--border)]"
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-[var(--brand)] text-[11px] font-semibold text-white">
            {initials}
          </span>
          <span className="hidden text-sm font-medium sm:inline">{profile?.full_name || "Account"}</span>
          <ChevronDown className="size-3.5 text-[var(--ink-muted)]" />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 z-40 mt-2 w-52 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-1.5 shadow-[var(--shadow-lg)]">
              <Link
                href="/dashboard/profile"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--ink-secondary)] hover:bg-[var(--border)]"
              >
                <UserIcon className="size-4" /> Profile
              </Link>
              <Link
                href="/dashboard/settings"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--ink-secondary)] hover:bg-[var(--border)]"
              >
                <Settings className="size-4" /> Settings
              </Link>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--status-critical)] hover:bg-[color-mix(in_srgb,var(--status-critical)_10%,transparent)]"
              >
                <LogOut className="size-4" /> Log out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
