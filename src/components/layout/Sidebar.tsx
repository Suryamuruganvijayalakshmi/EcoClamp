"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Factory,
  Cpu,
  Zap,
  BarChart3,
  Brain,
  TrendingUp,
  Wrench,
  Leaf,
  Package,
  Bell,
  History,
  Settings,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/machines", label: "Machines", icon: Factory },
  { href: "/dashboard/devices", label: "EcoClamp Devices", icon: Cpu },
  { href: "/dashboard/live", label: "Live Energy", icon: Zap },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/ai", label: "AI Intelligence", icon: Brain },
  { href: "/dashboard/forecast", label: "Forecast", icon: TrendingUp },
  { href: "/dashboard/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/dashboard/conservation", label: "Resource Conservation", icon: Leaf },
  { href: "/dashboard/production", label: "Production & Yield", icon: Package },
  { href: "/dashboard/alerts", label: "Alerts", icon: Bell },
  { href: "/dashboard/history", label: "History", icon: History },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/profile", label: "Profile", icon: User },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--brand)] text-white">
              <Zap className="size-4" fill="currentColor" />
            </div>
            <span className="text-base font-semibold tracking-tight">EcoClamp</span>
          </Link>
          <button onClick={onClose} className="text-[var(--ink-muted)] lg:hidden">
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {NAV_ITEMS.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                    : "text-[var(--ink-secondary)] hover:bg-[var(--border)] hover:text-[var(--ink-primary)]"
                )}
              >
                <item.icon className="size-4.5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[var(--border)] px-5 py-4">
          <p className="text-[11px] leading-relaxed text-[var(--ink-muted)]">
            Monitor → Predict → Conserve → Act
          </p>
        </div>
      </aside>
    </>
  );
}
