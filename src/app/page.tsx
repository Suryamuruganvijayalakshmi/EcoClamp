import Link from "next/link";
import {
  Zap,
  Brain,
  TrendingUp,
  Wrench,
  Leaf,
  Siren,
  ArrowRight,
  BarChart3,
  Cpu,
  Radio,
  Database,
  Activity,
  Gauge,
  Bell,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

const features = [
  {
    icon: Zap,
    title: "Live Energy Monitoring",
    description: "Monitor machine-level electrical behavior in real time.",
  },
  {
    icon: Brain,
    title: "AI Intelligence",
    description: "Learn machine operating patterns and identify anomalies.",
  },
  {
    icon: TrendingUp,
    title: "Trend Forecasting",
    description: "Estimate short-term consumption trends based on historical data.",
  },
  {
    icon: Wrench,
    title: "Smart Maintenance Guidance",
    description: "Recommend general inspection or service based on sustained abnormal patterns.",
  },
  {
    icon: Leaf,
    title: "Resource Conservation",
    description: "Identify avoidable energy consumption and prioritize corrective action.",
  },
  {
    icon: Siren,
    title: "Human-Supervised Alerts",
    description: "Notify operators and allow intervention before configured automated actions.",
  },
];

const flowSteps = [
  { icon: Cpu, label: "EcoClamp Device" },
  { icon: Radio, label: "CT Current Sensor" },
  { icon: Activity, label: "ESP32" },
  { icon: Database, label: "Supabase" },
  { icon: Gauge, label: "Real-Time Dashboard" },
  { icon: Brain, label: "AI Analytics Engine" },
  { icon: Bell, label: "Alert + Human Response" },
];

const storySteps = [
  { title: "MONITOR", description: "Machine-level electrical behavior, live." },
  { title: "UNDERSTAND", description: "Baseline learning reveals what's normal." },
  { title: "PREDICT", description: "Short-term forecasts of consumption trends." },
  { title: "DETECT WASTE", description: "Anomalies and avoidable energy surfaced." },
  { title: "RECOMMEND ACTION", description: "Transparent, tiered maintenance guidance." },
  { title: "CONSERVE RESOURCES", description: "Operators act before waste compounds." },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--page)]/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--brand)] text-white shadow-[var(--shadow-sm)]">
              <Zap className="size-5" fill="currentColor" />
            </div>
            <span className="text-lg font-semibold tracking-tight">EcoClamp</span>
          </div>
          <nav className="hidden items-center gap-8 text-sm text-[var(--ink-secondary)] md:flex">
            <a href="#how-it-works" className="hover:text-[var(--ink-primary)]">How it works</a>
            <a href="#features" className="hover:text-[var(--ink-primary)]">Features</a>
            <a href="#story" className="hover:text-[var(--ink-primary)]">The mission</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-20 pb-24">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px]"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 0%, color-mix(in srgb, var(--brand) 16%, transparent), transparent)",
          }}
        />
        <div className="mx-auto max-w-4xl text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-medium text-[var(--ink-secondary)]">
            <Cpu className="size-3.5 text-[var(--brand)]" />
            AIoT Retrofit Platform for MSMEs &amp; Industries
          </div>
          <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
            Eco<span className="text-[var(--brand)]">Clamp</span>
          </h1>
          <p className="mt-4 text-xl font-medium text-[var(--ink-secondary)]">
            AIoT Intelligence for Smarter Resource Conservation
          </p>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[var(--ink-muted)]">
            EcoClamp helps industries monitor machine-level electrical behavior, identify abnormal
            energy consumption, forecast operating trends, and generate actionable recommendations
            for smarter energy and resource management.
          </p>

          <div className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-[var(--brand-strong)]">
            <span>Monitor</span>
            <ArrowRight className="size-4" />
            <span>Predict</span>
            <ArrowRight className="size-4" />
            <span>Conserve</span>
            <ArrowRight className="size-4" />
            <span>Act</span>
          </div>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register">
              <Button size="lg" className="gap-2">
                <Zap className="size-4" /> Launch Dashboard
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="gap-2">
                <BarChart3 className="size-4" /> Explore Analytics
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* System flow */}
      <section id="how-it-works" className="border-y border-[var(--border)] bg-[var(--surface)] px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-[var(--brand-strong)]">
            Complete System Flow
          </h2>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
            {flowSteps.map((step, i) => (
              <div key={step.label} className="flex flex-col items-center gap-2 text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-raised)] text-[var(--brand)]">
                  <step.icon className="size-5" />
                </div>
                <p className="text-xs font-medium text-[var(--ink-secondary)]">{step.label}</p>
                {i < flowSteps.length - 1 && (
                  <ArrowRight className="hidden size-4 text-[var(--ink-muted)] lg:block lg:absolute" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section id="features" className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight">Everything invisible, made visible</h2>
            <p className="mt-3 text-[var(--ink-muted)]">
              A complete intelligent industrial energy platform — not merely a current sensor dashboard.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)] transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
              >
                <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                  <f.icon className="size-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-muted)]">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story / mission */}
      <section id="story" className="border-t border-[var(--border)] bg-[var(--surface)] px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-[var(--brand)] text-white">
            <ShieldCheck className="size-6" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">ECOCLAMP</h2>
          <p className="mt-1 text-[var(--brand-strong)] font-medium">
            AIoT Intelligence for Smart Resource Conservation
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[var(--ink-muted)]">
            EcoClamp transforms machine-level electrical data into actionable intelligence.
          </p>

          <div className="mt-12 grid grid-cols-2 gap-6 text-left sm:grid-cols-3 lg:grid-cols-6">
            {storySteps.map((s, i) => (
              <div key={s.title} className="relative">
                <p className="text-xs font-bold tracking-wide text-[var(--brand-strong)]">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <p className="mt-1 text-sm font-semibold">{s.title}</p>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-xs text-[var(--ink-muted)] sm:flex-row">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-[var(--brand)]" />
            <span>EcoClamp — Non-Invasive AIoT Energy Intelligence</span>
          </div>
          <p>Built for SIH — Smart Resource Conservation track</p>
        </div>
      </footer>
    </div>
  );
}
