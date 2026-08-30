"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EnergyReading } from "@/lib/types";

export type TimeRange = "5m" | "30m" | "1h" | "today" | "7d" | "30d";

export function rangeToSince(range: TimeRange): Date {
  const now = new Date();
  switch (range) {
    case "5m":
      return new Date(now.getTime() - 5 * 60 * 1000);
    case "30m":
      return new Date(now.getTime() - 30 * 60 * 1000);
    case "1h":
      return new Date(now.getTime() - 60 * 60 * 1000);
    case "today": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

/**
 * Live-updating window of readings for one machine. Subscribes to Supabase
 * Realtime so both /api/ingest inserts (source=live) and simulation inserts
 * (source=simulation) appear on the graph immediately.
 */
export function useReadings(machineId: string | undefined, range: TimeRange, maxPoints = 400) {
  const supabase = useMemo(() => createClient(), []);
  const [readings, setReadings] = useState<EnergyReading[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!machineId) return;
    setLoading(true);
    const since = rangeToSince(range);
    const { data } = await supabase
      .from("energy_readings")
      .select("*")
      .eq("machine_id", machineId)
      .gte("recorded_at", since.toISOString())
      .order("recorded_at", { ascending: true })
      .limit(maxPoints);
    setReadings((data as EnergyReading[]) || []);
    setLoading(false);
  }, [machineId, range, maxPoints, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!machineId) return;
    const channel = supabase
      .channel(`readings-${machineId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "energy_readings", filter: `machine_id=eq.${machineId}` },
        (payload) => {
          setReadings((prev) => {
            const next = [...prev, payload.new as EnergyReading];
            return next.length > maxPoints ? next.slice(next.length - maxPoints) : next;
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [machineId, supabase, maxPoints]);

  return { readings, loading, reload: load };
}

/** One-shot fetch of the most recent N readings for a machine (no realtime, no range filter). */
export async function fetchRecentReadings(machineId: string, limit = 200): Promise<EnergyReading[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("energy_readings")
    .select("*")
    .eq("machine_id", machineId)
    .order("recorded_at", { ascending: false })
    .limit(limit);
  return ((data as EnergyReading[]) || []).reverse();
}
