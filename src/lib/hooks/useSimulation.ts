"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { generateSimulatedCurrent } from "@/lib/engine/simulate";
import type { SimulationScenario } from "@/lib/types";

const TICK_MS = 2000;

interface SimulationSessionRow {
  id: string;
  factory_id: string;
  machine_id: string;
  scenario: string;
  active: boolean;
  started_at: string;
}

/**
 * Drives the AI Demo Simulation Mode (section 27) for a single machine.
 * Writes are done directly from the browser via the RLS-scoped Supabase
 * client (the logged-in operator IS the "source" of the demo, unlike a
 * real ESP32 device which has no user session and goes through /api/ingest
 * with source="live" instead). Every row this writes is source="simulation".
 */
export function useSimulation(machineId: string | undefined, baselineCurrent: number, factoryId: string | undefined) {
  const supabase = useCallback(() => createClient(), [])();
  const [session, setSession] = useState<SimulationSessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSession = useCallback(async () => {
    if (!machineId) return;
    const { data } = await supabase
      .from("simulation_sessions")
      .select("*")
      .eq("machine_id", machineId)
      .maybeSingle();
    setSession((data as SimulationSessionRow) || null);
    setLoading(false);
  }, [machineId, supabase]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const tick = useCallback(async () => {
    if (!session || !session.active || !machineId || !factoryId) return;
    const elapsedSeconds = (Date.now() - new Date(session.started_at).getTime()) / 1000;
    const value = generateSimulatedCurrent({
      scenario: session.scenario as SimulationScenario,
      baselineCurrent: baselineCurrent || 4,
      elapsedSeconds,
    });
    await supabase.from("energy_readings").insert({
      factory_id: factoryId,
      machine_id: machineId,
      current_amps: value,
      source: "simulation",
      scenario: session.scenario,
      recorded_at: new Date().toISOString(),
    });
  }, [session, machineId, factoryId, baselineCurrent, supabase]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (session?.active) {
      // Fire one immediately, then on the interval.
      tick();
      intervalRef.current = setInterval(tick, TICK_MS);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.active, session?.scenario, session?.started_at]);

  const startScenario = useCallback(
    async (scenario: SimulationScenario) => {
      if (!machineId || !factoryId) return;
      const { data, error } = await supabase
        .from("simulation_sessions")
        .upsert(
          {
            machine_id: machineId,
            factory_id: factoryId,
            scenario,
            active: true,
            started_at: new Date().toISOString(),
          },
          { onConflict: "machine_id" }
        )
        .select()
        .single();
      if (!error) setSession(data as SimulationSessionRow);
    },
    [machineId, factoryId, supabase]
  );

  const stopScenario = useCallback(async () => {
    if (!machineId) return;
    const { data, error } = await supabase
      .from("simulation_sessions")
      .update({ active: false })
      .eq("machine_id", machineId)
      .select()
      .single();
    if (!error) setSession(data as SimulationSessionRow);
  }, [machineId, supabase]);

  return { session, loading, startScenario, stopScenario };
}
