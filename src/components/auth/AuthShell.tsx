import Link from "next/link";
import { Zap } from "lucide-react";

export function AuthShell({
  title,
  subtitle,
  children,
  wide = false,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-4 py-12">
      <div className={`w-full ${wide ? "max-w-2xl" : "max-w-md"}`}>
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--brand)] text-white">
            <Zap className="size-5" fill="currentColor" />
          </div>
          <span className="text-lg font-semibold tracking-tight">EcoClamp</span>
        </Link>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-8 shadow-[var(--shadow-md)]">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
