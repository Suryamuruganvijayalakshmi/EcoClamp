"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  Check,
  ChevronDown,
  CircleDot,
  Cpu,
  Gauge,
  History,
  Layers3,
  Radio,
  ShieldCheck,
  Thermometer,
  TimerReset,
  Waves,
  Zap,
} from "lucide-react";

type DemoMode =
  | "NORMAL"
  | "HIGH LOAD"
  | "VIBRATION ANOMALY"
  | "THERMAL DRIFT"
  | "RPM INSTABILITY"
  | "MULTI-SENSOR ANOMALY";

type Profile = {
  current: number;
  vibration: number;
  temperature: number;
  rpm: number;
  drift: number;
  risk: number;
};

const modes: { label: DemoMode; hint: string }[] = [
  { label: "NORMAL", hint: "Healthy reference behavior" },
  { label: "HIGH LOAD", hint: "Load transition with coupled signals" },
  { label: "VIBRATION ANOMALY", hint: "Mechanical signal moves first" },
  { label: "THERMAL DRIFT", hint: "Progressive thermal change" },
  { label: "RPM INSTABILITY", hint: "Rotational stability degrades" },
  { label: "MULTI-SENSOR ANOMALY", hint: "Correlated drift across systems" },
];

const base = { current: 2.14, vibration: 0.42, temperature: 34.2, rpm: 1432 };

function signed(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(0)}%`;
}

function driftLabel(score: number) {
  if (score < 10) return "STABLE";
  if (score < 20) return "MILD DRIFT";
  if (score < 35) return "SIGNIFICANT DRIFT";
  return "CRITICAL DRIFT";
}

function Sparkline({ values, color = "var(--brand)" }: { values: number[]; color?: string }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => `${(index / (values.length - 1)) * 100},${38 - ((value - min) / range) * 32}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-12 w-full overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function FingerprintIcon() {
  return (
    <div className="relative flex size-9 items-center justify-center text-[var(--brand)]">
      <span className="absolute size-8 rounded-full border border-current opacity-30" />
      <span className="absolute size-6 rounded-full border border-current opacity-60" />
      <span className="absolute size-3 rounded-full border border-current" />
    </div>
  );
}

export default function LandingPage() {
  const [mode, setMode] = useState<DemoMode>("VIBRATION ANOMALY");
  const [tick, setTick] = useState(0);
  const [modeOpen, setModeOpen] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => setTick((current) => current + 1), 2200);
    return () => window.clearInterval(interval);
  }, []);

  const state = useMemo(() => {
    const wave = Math.sin(tick * 0.8) * 0.015;
    const profiles: Record<DemoMode, Profile> = {
      NORMAL: { current: 2.12 + wave, vibration: 0.42 + wave, temperature: 34.2 + wave, rpm: 1432 + wave * 20, drift: 4.8, risk: 8 },
      "HIGH LOAD": { current: 2.78 + wave, vibration: 0.49 + wave, temperature: 37.8 + Math.abs(wave) * 2, rpm: 1408 + wave * 20, drift: 16.2, risk: 39 },
      "VIBRATION ANOMALY": { current: 2.44 + wave, vibration: 0.55 + Math.abs(wave) * 2, temperature: 34.8 + wave, rpm: 1426 + wave * 20, drift: 18.4, risk: 72 },
      "THERMAL DRIFT": { current: 2.16 + wave, vibration: 0.43 + wave, temperature: 41.6 + Math.abs(wave) * 3, rpm: 1430 + wave * 20, drift: 12.7, risk: 46 },
      "RPM INSTABILITY": { current: 2.32 + wave, vibration: 0.48 + wave, temperature: 35.1 + wave, rpm: 1378 + Math.sin(tick) * 45, drift: 22.9, risk: 61 },
      "MULTI-SENSOR ANOMALY": { current: 2.96 + wave, vibration: 0.71 + Math.abs(wave) * 2, temperature: 42.3 + Math.abs(wave) * 2, rpm: 1324 + wave * 20, drift: 38.6, risk: 84 },
    };
    const profile = profiles[mode];
    return {
      ...profile,
      health: Math.max(0, Math.round(100 - profile.drift * 0.42 - profile.risk * 0.12)),
      currentDelta: ((profile.current - base.current) / base.current) * 100,
      vibrationDelta: ((profile.vibration - base.vibration) / base.vibration) * 100,
      temperatureDelta: ((profile.temperature - base.temperature) / base.temperature) * 100,
      rpmDelta: ((profile.rpm - base.rpm) / base.rpm) * 100,
    };
  }, [mode, tick]);

  const spark = (offset: number, multiplier: number) =>
    Array.from({ length: 18 }, (_, index) => 1 + Math.sin(index * 0.7 + tick * 0.2 + offset) * 0.08 + (index / 18) * multiplier);
  const contributors = [
    { label: "Vibration deviation", value: state.vibrationDelta, width: Math.min(100, Math.abs(state.vibrationDelta) * 1.65), color: "var(--status-serious)" },
    { label: "Current deviation", value: state.currentDelta, width: Math.min(100, Math.abs(state.currentDelta) * 1.7), color: "var(--series-1)" },
    { label: "RPM deviation", value: state.rpmDelta, width: Math.min(100, Math.abs(state.rpmDelta) * 2.4), color: "var(--series-5)" },
    { label: "Temperature deviation", value: state.temperatureDelta, width: Math.min(100, Math.abs(state.temperatureDelta) * 3.5), color: "var(--status-warning)" },
  ];
  const sensorRows = [
    ["Current", state.current, base.current, "A", Zap, "var(--series-1)", state.currentDelta],
    ["Mechanical", state.vibration, base.vibration, "g RMS", Waves, "var(--status-serious)", state.vibrationDelta],
    ["Thermal", state.temperature, base.temperature, "Â°C", Thermometer, "var(--status-warning)", state.temperatureDelta],
    ["Rotational", state.rpm, base.rpm, "RPM", Gauge, "var(--series-5)", state.rpmDelta],
  ] as const;

  return (
    <main className="min-h-screen bg-[var(--page)] text-[var(--ink-primary)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center bg-[var(--brand)] text-white"><Zap className="size-5" fill="currentColor" /></div>
            <div><div className="text-sm font-bold tracking-[0.18em]">ECOCLAMP</div><div className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">Machine behavioral intelligence</div></div>
          </Link>
          <div className="hidden items-center gap-6 text-xs font-medium text-[var(--ink-secondary)] md:flex"><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[var(--status-good)] pulse-dot" />Simulation stream active</span><span>Prototype / research mode</span><Link href="/login" className="text-[var(--brand-strong)] hover:underline">Operator login</Link></div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-5 py-8 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div><div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-strong)]"><CircleDot className="size-3.5" /> Live machine behavioral model</div><h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">Understand your machines before they fail.</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--ink-secondary)]">EcoClamp uses a non-invasive SCT-013 current sensor and your machine&apos;s own history to show what is normal, flag unusual load, and estimate what may happen next.</p><div className="mt-5 flex flex-wrap gap-3"><Link href="/login" className="inline-flex items-center gap-2 bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-sm)] hover:bg-[var(--brand-strong)]">Log in <ArrowRight className="size-4" /></Link><Link href="/register" className="inline-flex items-center gap-2 border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold hover:border-[var(--brand)]">Register your factory</Link></div></div>
          <div className="relative w-full lg:w-72"><button onClick={() => setModeOpen((open) => !open)} className="flex w-full items-center justify-between border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-left shadow-[var(--shadow-sm)]"><span><span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Demo mode Â· simulated data</span><span className="mt-1 block text-sm font-semibold">{mode}</span></span><ChevronDown className="size-4 text-[var(--ink-muted)]" /></button>{modeOpen && <div className="absolute right-0 z-20 mt-2 w-full border border-[var(--border-strong)] bg-[var(--surface-raised)] p-1 shadow-[var(--shadow-lg)]">{modes.map((item) => <button key={item.label} onClick={() => { setMode(item.label); setModeOpen(false); }} className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-[var(--brand-soft)]"><span className={`mt-1 size-2 rounded-full ${item.label === mode ? "bg-[var(--brand)]" : "bg-[var(--border-strong)]"}`} /><span><span className="block text-xs font-semibold">{item.label}</span><span className="block text-[11px] text-[var(--ink-muted)]">{item.hint}</span></span></button>)}</div>}</div>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2 text-[11px] font-medium text-[var(--ink-muted)]"><span className="border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 py-1">CONV-001</span><span className="border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 py-1">Conveyor drive motor</span><span className="border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 py-1">Fingerprint learned Â· 184 cycles</span><span className="ml-auto flex items-center gap-1.5"><Radio className="size-3.5 text-[var(--brand)]" /> ESP32 edge node Â· 2.2s ago</span></div>

        <section className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]"><Activity className="size-4 text-[var(--brand)]" /> Behavioral drift</div><div className="mt-3 flex items-end gap-3"><span className="text-6xl font-semibold tracking-[-0.05em]">{state.drift.toFixed(1)}%</span><span className="mb-2 border border-[color-mix(in_srgb,var(--status-serious)_35%,transparent)] bg-[color-mix(in_srgb,var(--status-serious)_10%,transparent)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--status-serious)]">{driftLabel(state.drift)}</span></div><p className="mt-2 max-w-md text-sm text-[var(--ink-secondary)]">Deviation from this machine&apos;s learned behavioral fingerprint, not a universal threshold.</p></div><div className="text-right text-[11px] text-[var(--ink-muted)]"><div className="font-semibold text-[var(--ink-secondary)]">RESEARCH THRESHOLDS</div><div className="mt-1">0â€“10 stable Â· 10â€“20 mild</div><div>20â€“35 significant Â· 35+ critical</div></div></div>
            <div className="mt-8 grid gap-5 sm:grid-cols-2"><div className="relative flex min-h-48 items-center justify-center border border-[var(--border)] bg-[var(--page)]"><div className="absolute inset-8 rounded-full border border-dashed border-[var(--border-strong)]" /><div className="absolute inset-14 rounded-full border border-[var(--brand)]/30" /><div className="relative flex size-24 flex-col items-center justify-center rounded-full border-2 border-[var(--status-serious)] bg-[var(--surface)] shadow-[0_0_0_12px_color-mix(in_srgb,var(--status-serious)_8%,transparent)]"><span className="text-2xl font-semibold">{state.drift.toFixed(1)}%</span><span className="text-[9px] uppercase tracking-widest text-[var(--ink-muted)]">drift</span></div><div className="absolute left-4 top-4 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--series-1)]"><Zap className="size-3" /> Electrical</div><div className="absolute right-4 top-4 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--status-serious)]"><Waves className="size-3" /> Mechanical</div><div className="absolute bottom-4 left-4 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--status-warning)]"><Thermometer className="size-3" /> Thermal</div><div className="absolute bottom-4 right-4 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--series-5)]"><Gauge className="size-3" /> Rotational</div><div className="absolute left-1/2 top-2 h-8 border-l border-dashed border-[var(--border-strong)]" /><div className="absolute bottom-2 left-1/2 h-8 border-l border-dashed border-[var(--border-strong)]" /><div className="absolute left-2 top-1/2 w-8 border-t border-dashed border-[var(--border-strong)]" /><div className="absolute right-2 top-1/2 w-8 border-t border-dashed border-[var(--border-strong)]" /></div><div><div className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Contributing signals</div><div className="space-y-4">{contributors.map((item) => <div key={item.label}><div className="mb-1 flex justify-between text-xs"><span className="text-[var(--ink-secondary)]">{item.label}</span><span className="font-semibold" style={{ color: item.color }}>{signed(item.value)}</span></div><div className="h-1.5 bg-[var(--border)]"><div className="h-full transition-all duration-500" style={{ width: `${item.width}%`, background: item.color }} /></div></div>)}</div><div className="mt-6 border-l-2 border-[var(--status-serious)] bg-[var(--page)] p-3 text-xs leading-relaxed text-[var(--ink-secondary)]"><span className="font-semibold text-[var(--ink-primary)]">Behavioral drift detected.</span> Mechanical change is leading the signal mix while thermal behavior remains near baseline.</div></div></div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1"><div className="border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Machine health index</span><ShieldCheck className="size-4 text-[var(--brand)]" /></div><div className="mt-4 flex items-end gap-2"><span className="text-5xl font-semibold">{state.health}</span><span className="mb-2 text-sm text-[var(--ink-muted)]">/ 100</span></div><div className="mt-4 h-2 bg-[var(--border)]"><div className="h-full bg-[var(--brand)] transition-all duration-500" style={{ width: `${state.health}%` }} /></div><p className="mt-3 text-xs leading-relaxed text-[var(--ink-muted)]">A directional product metric. It is intentionally separate from drift, risk, and sensor confidence.</p></div><div className="border border-[var(--ink-primary)] bg-[var(--ink-primary)] p-5 text-[var(--page)] shadow-[var(--shadow-sm)]"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--page)]/60">Degradation risk</span><BrainCircuit className="size-4 text-[var(--brand)]" /></div><div className="mt-4 flex items-end gap-2"><span className="text-5xl font-semibold text-[var(--brand)]">{state.risk}%</span><span className="mb-2 text-sm text-[var(--page)]/60">model-derived</span></div><p className="mt-4 text-sm leading-relaxed text-[var(--page)]/75">Elevated risk. Inspection recommended. This prototype uses simulated evidence and makes no failure claim.</p><div className="mt-5 flex items-center gap-2 border-t border-white/15 pt-3 text-[11px] text-[var(--page)]/60"><Layers3 className="size-3.5" /> Isolation Forest architecture Â· no trained dataset</div></div></div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]"><div className="border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Machine behavior map</div><h2 className="mt-2 text-xl font-semibold">Current window vs learned fingerprint</h2></div><div className="flex items-center gap-2 text-[11px] text-[var(--ink-muted)]"><span className="size-2 rounded-full bg-[var(--brand)]" /> Current <span className="ml-2 size-2 rounded-full bg-[var(--border-strong)]" /> Fingerprint</div></div><div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5">{sensorRows.map(([label, value, baseline, unit, Icon, color, delta]) => <div key={label}><div className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 font-semibold"><Icon className="size-3.5" style={{ color }} />{label}</span><span className="font-medium" style={{ color }}>{signed(delta)}</span></div><div className="mt-2 flex items-center gap-2"><div className="h-2 flex-1 bg-[var(--border)]"><div className="h-full transition-all duration-500" style={{ width: `${Math.min(100, Math.abs(value) / Math.max(baseline, 1) * 80)}%`, background: color }} /></div><span className="w-20 text-right text-xs font-semibold">{value.toFixed(label === "Rotational" ? 0 : 2)} <span className="font-normal text-[var(--ink-muted)]">{unit}</span></span></div><div className="mt-2"><Sparkline values={spark(delta, Math.abs(delta) / 180)} color={color} /></div></div>)}</div></div>
          <div className="border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7"><div className="flex items-center justify-between"><div><div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Machine digital fingerprint</div><h2 className="mt-2 text-xl font-semibold">CONVEYOR DRIVE 01</h2></div><FingerprintIcon /></div><div className="mt-6 space-y-5">{[["Electrical stability", 92, "var(--series-1)"], ["Mechanical stability", Math.max(12, 100 - Math.round(state.vibrationDelta * 1.4)), "var(--status-serious)"], ["Thermal stability", Math.max(18, 100 - Math.round(state.temperatureDelta * 1.8)), "var(--status-warning)"], ["Rotational stability", Math.max(18, 100 - Math.round(Math.abs(state.rpmDelta) * 2.2)), "var(--series-5)"]].map(([label, value, color]) => <div key={String(label)}><div className="mb-1.5 flex justify-between text-xs"><span className="text-[var(--ink-secondary)]">{label}</span><span className="font-semibold">{value}%</span></div><div className="flex gap-1">{Array.from({ length: 10 }, (_, index) => <span key={index} className="h-2 flex-1 transition-colors duration-500" style={{ background: index < Math.round(Number(value) / 10) ? String(color) : "var(--border)" }} />)}</div></div>)}</div><div className="mt-7 flex items-end justify-between border-t border-[var(--border)] pt-5"><div><div className="text-[11px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">Overall similarity</div><div className="mt-1 text-3xl font-semibold">{(100 - state.drift).toFixed(1)}%</div></div><div className="text-right text-xs text-[var(--ink-muted)]"><History className="ml-auto mb-1 size-4" />184 healthy cycles<br />last updated 2m ago</div></div></div></section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr_0.85fr]"><div className="border border-[var(--border)] bg-[var(--surface)] p-5"><div className="flex items-center justify-between"><div><div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">What changed?</div><h2 className="mt-2 text-lg font-semibold">Current window / healthy window</h2></div><TimerReset className="size-5 text-[var(--brand)]" /></div><div className="mt-5 space-y-3">{[["Vibration RMS", state.vibrationDelta, "0.55 g", "0.42 g"], ["Current draw", state.currentDelta, "2.44 A", "2.14 A"], ["Temperature", state.temperatureDelta, "34.8 Â°C", "34.2 Â°C"], ["RPM", state.rpmDelta, "1,426", "1,432"]].map(([label, delta, current, healthy]) => <div key={String(label)} className="flex items-center justify-between border-b border-[var(--border)] pb-3 text-sm"><span className="text-[var(--ink-secondary)]">{label}</span><span className="font-mono text-xs text-[var(--ink-muted)]">{current} <ArrowRight className="mx-1 inline size-3" /> {healthy}</span><span className="w-14 text-right font-semibold" style={{ color: Number(delta) > 5 ? "var(--status-serious)" : "var(--status-good)" }}>{signed(Number(delta))}</span></div>)}</div></div><div className="border border-[var(--border)] bg-[var(--surface)] p-5"><div className="flex items-center justify-between"><div><div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Behavior evolution</div><h2 className="mt-2 text-lg font-semibold">Drift trajectory</h2></div><span className="text-[11px] font-medium text-[var(--brand-strong)]">last 18 windows</span></div><div className="mt-5 h-28 border-b border-l border-[var(--border)] bg-[linear-gradient(to_bottom,transparent_49%,var(--border)_50%,transparent_51%)] p-3"><Sparkline values={spark(1, Math.max(0.04, state.drift / 110))} color="var(--status-serious)" /></div><div className="mt-3 flex justify-between text-[10px] uppercase tracking-wider text-[var(--ink-muted)]"><span>Healthy history</span><span>Current window</span></div></div><div className="border border-[var(--border)] bg-[var(--surface)] p-5"><div className="flex items-center justify-between"><div><div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Data quality</div><h2 className="mt-2 text-lg font-semibold">Sensor confidence</h2></div><span className="text-2xl font-semibold text-[var(--brand-strong)]">94%</span></div><div className="mt-5 space-y-2.5">{[["Current", "Good"], ["Vibration", "Good"], ["Temperature", "Good"], ["RPM", mode === "RPM INSTABILITY" || mode === "MULTI-SENSOR ANOMALY" ? "Warning" : "Good"]].map(([label, status]) => <div key={label} className="flex items-center justify-between text-xs"><span className="text-[var(--ink-secondary)]">{label}</span><span className={`flex items-center gap-1.5 font-semibold ${status === "Good" ? "text-[var(--status-good)]" : "text-[var(--status-warning)]"}`}><span className="size-1.5 rounded-full bg-current" />{status}</span></div>)}</div><div className="mt-5 border-t border-[var(--border)] pt-3 text-[11px] leading-relaxed text-[var(--ink-muted)]">Quality gates model output. Simulated stream has no missing samples; real device data requires calibration and timestamp checks.</div></div></section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.9fr]"><div className="border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7"><div className="flex items-center justify-between"><div><div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Machine event timeline</div><h2 className="mt-2 text-xl font-semibold">Evidence, not alarm noise</h2></div><span className="flex items-center gap-1.5 text-[11px] text-[var(--ink-muted)]"><History className="size-3.5" /> today</span></div><div className="mt-6 space-y-0">{[["10:26", "Investigation recommendation generated", "Model risk elevated to 72%", "var(--status-serious)"], ["10:21", "Behavioral drift increased", "Vibration deviation persisted across 6 windows", "var(--status-warning)"], ["10:18", "Vibration deviation detected", "RMS increased 31% vs learned baseline", "var(--series-1)"], ["10:15", "Load increased", "Current draw moved +14% under high load", "var(--ink-muted)"], ["09:42", "Normal operation", "Fingerprint similarity 96.8%", "var(--status-good)"]].map(([time, title, detail, color]) => <div key={time} className="flex gap-4 border-l border-[var(--border-strong)] pb-5 pl-5 last:pb-0"><div className="relative"><span className="absolute -left-[25px] top-1 size-2 rounded-full border-2 border-[var(--surface)]" style={{ background: color }} /></div><div className="flex-1"><div className="flex flex-wrap justify-between gap-2"><span className="text-xs font-mono text-[var(--ink-muted)]">{time}</span><span className="text-xs font-semibold">{title}</span></div><p className="mt-1 text-xs text-[var(--ink-secondary)]">{detail}</p></div></div>)}</div></div><div className="border border-[var(--ink-primary)] bg-[var(--ink-primary)] p-5 text-[var(--page)] sm:p-7"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand)]"><BrainCircuit className="size-4" /> AI investigation brief</div><h2 className="mt-3 text-2xl font-semibold">What should I check?</h2><p className="mt-3 text-sm leading-relaxed text-[var(--page)]/70">The numerical engine found a persistent behavioral change. The operator-facing explanation stays grounded in the supplied evidence.</p><div className="mt-6 space-y-4">{["Inspect drive-side mechanical components and belt alignment.", "Check abnormal vibration sources against site procedure.", "Compare the next operating cycle before escalating service."].map((item, index) => <div key={item} className="flex gap-3 text-sm"><span className="flex size-6 shrink-0 items-center justify-center border border-[var(--brand)]/60 text-xs font-semibold text-[var(--brand)]">{index + 1}</span><span className="text-[var(--page)]/85">{item}</span></div>)}</div><div className="mt-7 border-t border-white/15 pt-4 text-[11px] leading-relaxed text-[var(--page)]/55">Prototype / simulated evidence. This is an investigation aid, not a confirmed diagnosis or a replacement for qualified personnel and manufacturer procedures.</div></div></section>

        <footer className="mt-10 flex flex-col justify-between gap-4 border-t border-[var(--border)] py-6 text-xs text-[var(--ink-muted)] sm:flex-row sm:items-center"><div className="flex items-center gap-2"><Cpu className="size-4 text-[var(--brand)]" /> Non-invasive clamp-on sensing Â· ESP32 edge architecture</div><div className="flex items-center gap-5"><Link href="/dashboard" className="hover:text-[var(--ink-primary)]">Open full dashboard <ArrowRight className="ml-1 inline size-3" /></Link><span className="flex items-center gap-1.5"><Check className="size-3.5 text-[var(--status-good)]" /> No accuracy claims</span></div></footer>
      </div>
    </main>
  );
}
