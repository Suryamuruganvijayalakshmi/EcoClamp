"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { computeMachineSnapshot, type MachineSnapshot, type ReadingLike } from "@/lib/engine/snapshot";
import type { Machine } from "@/lib/types";

/**
 * Fetches recent readings for every machine in the factory in one query and
 * computes a full analytics snapshot per machine. This backs the Overview,
 * AI Intelligence, and Alerts-generation views.
 */
export function useFleetSnapshots(machines: Machine[], factoryId: string | undefined, lookbackHours = 24) {
  const supabase = useMemo(() => createClient(), []);
  const [snapshots, setSnapshots] = useState<MachineSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!factoryId || machines.length === 0) {
      setSnapshots([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
    const { data } = await supabase
      .from("energy_readings")
      .select("machine_id, current_amps, recorded_at, source")
      .eq("factory_id", factoryId)
      .gte("recorded_at", since.toISOString())
      .order("recorded_at", { ascending: false })
      .limit(6000);

    const byMachine = new Map<string, ReadingLike[]>();
    for (const row of (data as (ReadingLike & { machine_id: string })[]) || []) {
      const list = byMachine.get(row.machine_id) || [];
      list.push(row);
      byMachine.set(row.machine_id, list);
    }

    const results = machines.map((m) => computeMachineSnapshot(m, byMachine.get(m.id) || []));
    setSnapshots(results);
    setLoading(false);
  }, [machines, factoryId, lookbackHours, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!factoryId) return;
    const channel = supabase
      .channel(`fleet-readings-${factoryId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "energy_readings", filter: `factory_id=eq.${factoryId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factoryId]);

  return { snapshots, loading, reload: load };
}
