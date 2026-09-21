"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { computeBaseline, type BaselineResult } from "@/lib/engine/baseline";
import { fetchRecentReadings } from "@/lib/hooks/useReadings";

/**
 * Machine Baseline Learning (section 11). Recomputes from the most recent
 * readings and persists the result to `machine_baselines` so other pages
 * (Overview, AI Intelligence) can read a stable snapshot without
 * recomputing from raw readings every time.
 *
 * `baselineResetAt`: when set (an operator reset the baseline from the Live
 * Energy page), readings recorded before this timestamp are excluded, so the
 * baseline re-learns the machine's normal behavior from scratch -- no
 * historical readings are deleted, they're just no longer counted toward
 * "normal."
 */
export function useBaseline(machineId: string | undefined, sampleRequirement = 30, baselineResetAt?: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [baseline, setBaseline] = useState<BaselineResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  const recompute = useCallback(async () => {
    if (!machineId) return;
    setLoading(true);
    let readings = await fetchRecentReadings(machineId, 500);
    if (baselineResetAt) {
      const cutoff = new Date(baselineResetAt).getTime();
      readings = readings.filter((r) => new Date(r.recorded_at).getTime() >= cutoff);
    }
    const result = computeBaseline(
      readings.map((r) => r.current_amps),
      sampleRequirement
    );
    setBaseline(result);

    await supabase.from("machine_baselines").upsert(
      {
        machine_id: machineId,
        average_current: result.averageCurrent,
        std_dev: result.stdDev,
        min_normal: result.minNormal,
        max_normal: result.maxNormal,
        sample_count: result.sampleCount,
        confidence: result.confidence,
        status: result.status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "machine_id" }
    );
    setLoading(false);
  }, [machineId, sampleRequirement, baselineResetAt, supabase]);

  useEffect(() => {
    recompute();
  }, [recompute]);

  /** Marks "now" as the cutoff for this machine's baseline learning (see
   * `baseline_reset_at` on `machines`), then recomputes. Never deletes
   * readings -- older data stays in `energy_readings` for history/analytics,
   * it's just no longer counted toward the learned normal range. */
  const resetBaseline = useCallback(async () => {
    if (!machineId) return;
    setResetting(true);
    const resetAt = new Date().toISOString();
    await supabase
      .from("machines")
      .update({ baseline_reset_at: resetAt })
      .eq("id", machineId);
    const emptyBaseline = computeBaseline([], sampleRequirement);
    setBaseline(emptyBaseline);
    await supabase.from("machine_baselines").upsert(
      {
        machine_id: machineId,
        average_current: 0,
        std_dev: 0,
        min_normal: 0,
        max_normal: 0,
        sample_count: 0,
        confidence: "low",
        status: "learning",
        updated_at: resetAt,
      },
      { onConflict: "machine_id" }
    );
    setResetting(false);
  }, [machineId, sampleRequirement, supabase]);

  return { baseline, loading, recompute, resetBaseline, resetting };
}
