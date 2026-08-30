"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Device, Factory, Machine, Profile } from "@/lib/types";

interface DashboardContextValue {
  user: User | null;
  profile: Profile | null;
  factory: Factory | null;
  machines: Machine[];
  devices: Device[];
  loading: boolean;
  refreshMachines: () => Promise<void>;
  refreshDevices: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [factory, setFactory] = useState<Factory | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const currentUser = authData.user;
    setUser(currentUser);
    if (!currentUser) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .maybeSingle();
    setProfile(profileData as Profile | null);

    if (profileData?.factory_id) {
      const { data: factoryData } = await supabase
        .from("factories")
        .select("*")
        .eq("id", profileData.factory_id)
        .maybeSingle();
      setFactory(factoryData as Factory | null);
    }
  }, [supabase]);

  const refreshMachines = useCallback(async () => {
    const { data } = await supabase.from("machines").select("*").order("created_at", { ascending: true });
    setMachines((data as Machine[]) || []);
  }, [supabase]);

  const refreshDevices = useCallback(async () => {
    const { data } = await supabase.from("devices").select("*").order("created_at", { ascending: true });
    setDevices((data as Device[]) || []);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refreshProfile();
      await Promise.all([refreshMachines(), refreshDevices()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-machines-devices")
      .on("postgres_changes", { event: "*", schema: "public", table: "machines" }, () => refreshMachines())
      .on("postgres_changes", { event: "*", schema: "public", table: "devices" }, () => refreshDevices())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, refreshMachines, refreshDevices]);

  const value: DashboardContextValue = {
    user,
    profile,
    factory,
    machines,
    devices,
    loading,
    refreshMachines,
    refreshDevices,
    refreshProfile,
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}
