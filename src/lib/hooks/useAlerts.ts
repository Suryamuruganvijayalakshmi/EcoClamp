"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MachineSnapshot } from "@/lib/engine/snapshot";
import type { Alert } from "@/lib/types";

const RESPONSE_WINDOW_SECONDS = 30;
const ALERT_COOLDOWN_MS = 10 * 60 * 1000; // don't re-alert the same machine within 10 min

/**
 * Watches fleet snapshots and opens a new alert (with a 30-second
 * human-response window) the first time a machine crosses into
 * warning/critical severity, respecting a cooldown so it doesn't spam.
 * Also fetches the alert feed with realtime updates, and provides the
 * acknowledge / stop actions plus the auto-expiry into "PROTOTYPE AUTOMATION"
 * when nobody responds in time (section 25).
 */
export function useAlertsEngine(snapshots: MachineSnapshot[], factoryId: string | undefined) {
  const supabase = useMemo(() => createClient(), []);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadAlerts = useCallback(async () => {
    if (!factoryId) return;
    const { data } = await supabase
      .from("alerts")
      .select("*")
      .eq("factory_id", factoryId)
      .order("created_at", { ascending: false })
      .limit(100);
    setAlerts((data as Alert[]) || []);
    setLoading(false);
  }, [factoryId, supabase]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  useEffect(() => {
    if (!factoryId) return;
    const channel = supabase
      .channel(`alerts-${factoryId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts", filter: `factory_id=eq.${factoryId}` }, () => loadAlerts())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [factoryId, supabase, loadAlerts]);

  // Generate new alerts from snapshots that just crossed into warning/critical.
  useEffect(() => {
    if (!factoryId || snapshots.length === 0) return;
    (async () => {
      for (const s of snapshots) {
        if (!s.hasData || (s.severity !== "warning" && s.severity !== "critical")) continue;

        const recentAlert = alerts.find(
          (a) =>
            a.machine_id === s.machine.id &&
            Date.now() - new Date(a.created_at).getTime() < ALERT_COOLDOWN_MS
        );
        if (recentAlert) continue;

        const deadline = new Date(Date.now() + RESPONSE_WINDOW_SECONDS * 1000).toISOString();
        const { error } = await supabase.from("alerts").insert({
          factory_id: factoryId,
          machine_id: s.machine.id,
          title: `${s.severity === "critical" ? "🚨 HIGH CURRENT EVENT" : "⚠️ Abnormal Consumption"} — ${s.machine.machine_name}`,
          severity: s.severity,
          current_amps: s.latest!.current_amps,
          baseline_amps: s.baseline.averageCurrent,
          deviation_pct: s.deviationPct,
          recommendation: s.maintenance.tier,
          status: "open",
          response_deadline: deadline,
          source: s.source || "simulation",
        });
        if (!error) loadAlerts();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshots, factoryId]);

  // Auto-expire alerts whose 30s window passed with no response.
  useEffect(() => {
    const expired = alerts.filter(
      (a) => a.status === "open" && a.response_deadline && new Date(a.response_deadline).getTime() <= now
    );
    if (expired.length === 0) return;
    (async () => {
      for (const a of expired) {
        await supabase.from("alerts").update({ status: "auto_action" }).eq("id", a.id);
        await supabase.from("automation_events").insert({
          factory_id: a.factory_id,
          machine_id: a.machine_id,
          alert_id: a.id,
          action: "auto_prototype_action",
        });
      }
      loadAlerts();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  const acknowledge = useCallback(
    async (alertId: string) => {
      const { data: userData } = await supabase.auth.getUser();
      await supabase
        .from("alerts")
        .update({ status: "acknowledged", acknowledged_at: new Date().toISOString(), acknowledged_by: userData.user?.id })
        .eq("id", alertId);
      const alert = alerts.find((a) => a.id === alertId);
      if (alert) {
        await supabase.from("automation_events").insert({
          factory_id: alert.factory_id,
          machine_id: alert.machine_id,
          alert_id: alertId,
          action: "acknowledged",
          actor: userData.user?.id,
        });
      }
      loadAlerts();
    },
    [supabase, alerts, loadAlerts]
  );

  const stopAction = useCallback(
    async (alertId: string) => {
      const { data: userData } = await supabase.auth.getUser();
      await supabase
        .from("alerts")
        .update({ status: "resolved", acknowledged_at: new Date().toISOString(), acknowledged_by: userData.user?.id })
        .eq("id", alertId);
      const alert = alerts.find((a) => a.id === alertId);
      if (alert) {
        await supabase.from("automation_events").insert({
          factory_id: alert.factory_id,
          machine_id: alert.machine_id,
          alert_id: alertId,
          action: "stopped",
          actor: userData.user?.id,
        });
      }
      loadAlerts();
    },
    [supabase, alerts, loadAlerts]
  );

  function secondsRemaining(alert: Alert): number | null {
    if (!alert.response_deadline || alert.status !== "open") return null;
    return Math.max(0, Math.round((new Date(alert.response_deadline).getTime() - now) / 1000));
  }

  return { alerts, loading, acknowledge, stopAction, secondsRemaining };
}
