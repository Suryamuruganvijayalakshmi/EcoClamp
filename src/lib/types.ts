// EcoClamp shared domain types
// These mirror the Supabase schema in supabase/schema.sql

export type DataSource = "live" | "simulation";

export type PhaseType = "single" | "three";

export type MachineStatus = "excellent" | "good" | "attention" | "poor" | "critical" | "offline";

export type SeverityLevel = "normal" | "idle" | "watch" | "warning" | "critical";

export type ConfidenceLevel = "low" | "medium" | "high";

export interface Factory {
  id: string;
  owner_id: string;
  company_name: string;
  industry_type: string;
  state: string;
  district: string;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  factory_id: string | null;
  created_at: string;
}

export interface Machine {
  id: string;
  factory_id: string;
  machine_name: string;
  machine_code: string; // e.g. M-001
  machine_type: string;
  department: string | null;
  production_line: string | null;
  rated_current: number; // Amps
  rated_voltage: number; // Volts
  rated_power: number | null; // kW, optional override
  phase_type: PhaseType;
  power_factor_assumption: number; // default 0.9
  expected_operating_schedule: string | null;
  production_output_unit: string | null;
  connected_device_id: string | null;
  baseline_sample_requirement: number; // configurable min samples
  baseline_reset_at: string | null; // set when an operator resets learned baseline; readings before this are ignored for baseline/anomaly learning
  created_at: string;
}

export interface Device {
  id: string;
  factory_id: string;
  device_code: string; // e.g. EC-001
  device_name: string;
  machine_id: string | null;
  api_key: string;
  status: "connected" | "disconnected" | "never_seen";
  last_seen_at: string | null;
  firmware_version: string | null;
  created_at: string;
}

export interface EnergyReading {
  id: string;
  factory_id: string;
  machine_id: string;
  device_id: string | null;
  current_amps: number;
  source: DataSource;
  scenario: string | null; // simulation scenario tag
  recorded_at: string;
  created_at: string;
  // Optional raw on-device diagnostics from firmware that computes more than
  // just RMS current (see firmware/ecoclamp_esp32.ino) -- reference only,
  // never an authoritative signal on their own (see supabase/schema.sql).
  // Null for simulation data and for any live device not reporting them.
  onboard_active_power_w: number | null;
  onboard_peak_amps: number | null;
  onboard_p2p_amps: number | null;
  onboard_frequency_hz: number | null;
  onboard_crest_factor: number | null;
  onboard_load_class: string | null;
  onboard_risk_score: number | null;
  onboard_risk_level: string | null;
  onboard_status: string | null;
}

export interface MachineBaseline {
  id: string;
  machine_id: string;
  average_current: number;
  std_dev: number;
  min_normal: number;
  max_normal: number;
  sample_count: number;
  confidence: ConfidenceLevel;
  status: "learning" | "established";
  updated_at: string;
}

export interface AnomalyEvent {
  id: string;
  factory_id: string;
  machine_id: string;
  started_at: string;
  ended_at: string | null;
  peak_current: number;
  baseline_current: number;
  peak_deviation_pct: number;
  severity: SeverityLevel;
  status: "active" | "resolved";
  source: DataSource;
}

export interface Alert {
  id: string;
  factory_id: string;
  machine_id: string;
  anomaly_event_id: string | null;
  title: string;
  severity: SeverityLevel;
  current_amps: number;
  baseline_amps: number;
  deviation_pct: number;
  recommendation: MaintenanceTier;
  status: "open" | "acknowledged" | "resolved" | "auto_action";
  response_deadline: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  source: DataSource;
  created_at: string;
}

export type MaintenanceTier = "general_checkup" | "service_recommended" | "urgent_inspection";

export interface MaintenanceRecommendation {
  id: string;
  factory_id: string;
  machine_id: string;
  tier: MaintenanceTier;
  reason: string;
  created_at: string;
  resolved: boolean;
}

export interface AIPrediction {
  id: string;
  factory_id: string;
  machine_id: string;
  health_score: number;
  health_status: MachineStatus;
  trend: "increasing" | "decreasing" | "stable";
  forecast_low: number;
  forecast_high: number;
  forecast_confidence: ConfidenceLevel;
  generated_at: string;
}

export interface ProductionRecord {
  id: string;
  factory_id: string;
  machine_id: string;
  batch: string | null;
  quantity: number;
  unit: string;
  operating_hours: number;
  recorded_at: string;
  created_at: string;
}

export interface EnergyConservationEvent {
  id: string;
  factory_id: string;
  machine_id: string;
  event_type: "abnormal" | "idle";
  started_at: string;
  ended_at: string | null;
  avg_excess_power_kw: number;
  potential_avoidable_kwh: number;
  observed_reduction_kwh: number | null;
  created_at: string;
}

export interface AutomationEvent {
  id: string;
  factory_id: string;
  machine_id: string;
  alert_id: string;
  action: "acknowledged" | "stopped" | "auto_prototype_action";
  actor: string | null;
  created_at: string;
}

export const SIMULATION_SCENARIOS = [
  "normal_operation",
  "high_energy_consumption",
  "sustained_abnormal_event",
  "idle_consumption",
  "gradual_degradation",
] as const;

export type SimulationScenario = (typeof SIMULATION_SCENARIOS)[number];

export const SCENARIO_LABELS: Record<SimulationScenario, string> = {
  normal_operation: "🟢 Normal Operation",
  high_energy_consumption: "🟡 High Energy Consumption",
  sustained_abnormal_event: "🔴 Sustained Abnormal Event",
  idle_consumption: "💤 Idle Consumption Event",
  gradual_degradation: "📈 Gradual Degradation Trend",
};
