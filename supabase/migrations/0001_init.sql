-- ============================================================================
-- EcoClamp — Supabase schema + Row Level Security
-- Run this once in your Supabase project's SQL editor (or via `supabase db push`).
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE where possible.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. factories
-- ----------------------------------------------------------------------------
create table if not exists factories (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  company_name text not null,
  industry_type text not null,
  state        text not null,
  district     text not null,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. profiles (1:1 with auth.users)
-- ----------------------------------------------------------------------------
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null,
  email        text not null,
  phone_number text,
  factory_id   uuid references factories(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. machines
-- ----------------------------------------------------------------------------
create table if not exists machines (
  id                          uuid primary key default gen_random_uuid(),
  factory_id                  uuid not null references factories(id) on delete cascade,
  machine_name                text not null,
  machine_code                text not null,
  machine_type                text not null,
  department                  text,
  production_line             text,
  rated_current                numeric not null default 0,
  rated_voltage                numeric not null default 230,
  rated_power                  numeric,
  phase_type                   text not null default 'single' check (phase_type in ('single','three')),
  power_factor_assumption      numeric not null default 0.9,
  expected_operating_schedule  text,
  production_output_unit       text,
  connected_device_id          uuid,
  baseline_sample_requirement  integer not null default 30,
  created_at                   timestamptz not null default now(),
  unique (factory_id, machine_code)
);

-- ----------------------------------------------------------------------------
-- 4. devices (EcoClamp hardware units)
-- ----------------------------------------------------------------------------
create table if not exists devices (
  id                uuid primary key default gen_random_uuid(),
  factory_id        uuid not null references factories(id) on delete cascade,
  device_code       text not null,
  device_name       text not null,
  machine_id        uuid references machines(id) on delete set null,
  api_key           text not null default encode(gen_random_bytes(20), 'hex'),
  status            text not null default 'never_seen' check (status in ('connected','disconnected','never_seen')),
  last_seen_at      timestamptz,
  firmware_version  text,
  created_at        timestamptz not null default now(),
  unique (factory_id, device_code),
  unique (api_key)
);

alter table machines
  add constraint machines_connected_device_fk
  foreign key (connected_device_id) references devices(id) on delete set null;

-- ----------------------------------------------------------------------------
-- 5. energy_readings (raw CT current samples — live + simulation)
-- ----------------------------------------------------------------------------
create table if not exists energy_readings (
  id                    uuid primary key default gen_random_uuid(),
  factory_id            uuid not null references factories(id) on delete cascade,
  machine_id            uuid not null references machines(id) on delete cascade,
  device_id             uuid references devices(id) on delete set null,
  current_amps          numeric not null,
  source                text not null check (source in ('live','simulation')),
  scenario              text,
  -- Optional raw on-device diagnostics from firmware that computes more than
  -- just RMS current (e.g. the SCT-013 sketch in firmware/). These are stored
  -- as-is for reference/debugging only — they are NEVER treated as an
  -- authoritative diagnosis. The dashboard's own health/anomaly/maintenance
  -- pages are always driven by the server-side engine in src/lib/engine/,
  -- computed uniformly from current_amps + the learned baseline, so live and
  -- simulated readings are scored identically and no single device's
  -- self-reported "risk" can misrepresent a machine's health.
  onboard_active_power_w numeric,
  onboard_peak_amps       numeric,
  onboard_p2p_amps        numeric,
  onboard_frequency_hz    numeric,
  onboard_crest_factor    numeric,
  onboard_load_class      text,
  onboard_risk_score      integer,
  onboard_risk_level      text,
  onboard_status          text,
  recorded_at   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index if not exists idx_energy_readings_machine_time on energy_readings (machine_id, recorded_at desc);
create index if not exists idx_energy_readings_factory_time on energy_readings (factory_id, recorded_at desc);

-- ----------------------------------------------------------------------------
-- 6. machine_baselines (one row per machine, upserted as data accrues)
-- ----------------------------------------------------------------------------
create table if not exists machine_baselines (
  id               uuid primary key default gen_random_uuid(),
  machine_id       uuid not null unique references machines(id) on delete cascade,
  average_current  numeric not null default 0,
  std_dev          numeric not null default 0,
  min_normal       numeric not null default 0,
  max_normal       numeric not null default 0,
  sample_count     integer not null default 0,
  confidence       text not null default 'low' check (confidence in ('low','medium','high')),
  status           text not null default 'learning' check (status in ('learning','established')),
  updated_at       timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 7. anomaly_events
-- ----------------------------------------------------------------------------
create table if not exists anomaly_events (
  id                  uuid primary key default gen_random_uuid(),
  factory_id          uuid not null references factories(id) on delete cascade,
  machine_id          uuid not null references machines(id) on delete cascade,
  started_at          timestamptz not null default now(),
  ended_at            timestamptz,
  peak_current        numeric not null,
  baseline_current    numeric not null,
  peak_deviation_pct  numeric not null,
  severity            text not null check (severity in ('normal','watch','warning','critical')),
  status              text not null default 'active' check (status in ('active','resolved')),
  source              text not null check (source in ('live','simulation'))
);
create index if not exists idx_anomaly_events_machine on anomaly_events (machine_id, started_at desc);

-- ----------------------------------------------------------------------------
-- 8. alerts
-- ----------------------------------------------------------------------------
create table if not exists alerts (
  id                  uuid primary key default gen_random_uuid(),
  factory_id          uuid not null references factories(id) on delete cascade,
  machine_id          uuid not null references machines(id) on delete cascade,
  anomaly_event_id    uuid references anomaly_events(id) on delete set null,
  title               text not null,
  severity            text not null check (severity in ('normal','watch','warning','critical')),
  current_amps        numeric not null,
  baseline_amps       numeric not null,
  deviation_pct       numeric not null,
  recommendation      text not null check (recommendation in ('general_checkup','service_recommended','urgent_inspection')),
  status              text not null default 'open' check (status in ('open','acknowledged','resolved','auto_action')),
  response_deadline   timestamptz,
  acknowledged_at     timestamptz,
  acknowledged_by     uuid references auth.users(id),
  source              text not null check (source in ('live','simulation')),
  created_at          timestamptz not null default now()
);
create index if not exists idx_alerts_factory on alerts (factory_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 9. ai_predictions (health score + forecast snapshots)
-- ----------------------------------------------------------------------------
create table if not exists ai_predictions (
  id                    uuid primary key default gen_random_uuid(),
  factory_id            uuid not null references factories(id) on delete cascade,
  machine_id            uuid not null references machines(id) on delete cascade,
  health_score          integer not null,
  health_status         text not null,
  trend                 text not null check (trend in ('increasing','decreasing','stable')),
  forecast_low          numeric,
  forecast_high         numeric,
  forecast_confidence   text check (forecast_confidence in ('low','medium','high')),
  generated_at          timestamptz not null default now()
);
create index if not exists idx_ai_predictions_machine on ai_predictions (machine_id, generated_at desc);

-- ----------------------------------------------------------------------------
-- 10. maintenance_recommendations
-- ----------------------------------------------------------------------------
create table if not exists maintenance_recommendations (
  id          uuid primary key default gen_random_uuid(),
  factory_id  uuid not null references factories(id) on delete cascade,
  machine_id  uuid not null references machines(id) on delete cascade,
  tier        text not null check (tier in ('general_checkup','service_recommended','urgent_inspection')),
  reason      text not null,
  created_at  timestamptz not null default now(),
  resolved    boolean not null default false
);

-- ----------------------------------------------------------------------------
-- 11. production_records (operator-entered — never inferred from current)
-- ----------------------------------------------------------------------------
create table if not exists production_records (
  id               uuid primary key default gen_random_uuid(),
  factory_id       uuid not null references factories(id) on delete cascade,
  machine_id       uuid not null references machines(id) on delete cascade,
  batch            text,
  quantity         numeric not null,
  unit             text not null,
  operating_hours  numeric not null,
  recorded_at      timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 12. energy_conservation_events (potential avoidable energy tracking)
-- ----------------------------------------------------------------------------
create table if not exists energy_conservation_events (
  id                      uuid primary key default gen_random_uuid(),
  factory_id              uuid not null references factories(id) on delete cascade,
  machine_id              uuid not null references machines(id) on delete cascade,
  event_type              text not null check (event_type in ('abnormal','idle')),
  started_at              timestamptz not null,
  ended_at                timestamptz,
  avg_excess_power_kw     numeric not null default 0,
  potential_avoidable_kwh numeric not null default 0,
  observed_reduction_kwh  numeric,
  created_at              timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 13. automation_events (human-supervised response log)
-- ----------------------------------------------------------------------------
create table if not exists automation_events (
  id          uuid primary key default gen_random_uuid(),
  factory_id  uuid not null references factories(id) on delete cascade,
  machine_id  uuid not null references machines(id) on delete cascade,
  alert_id    uuid not null references alerts(id) on delete cascade,
  action      text not null check (action in ('acknowledged','stopped','auto_prototype_action')),
  actor       uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Implementation extra: simulation_sessions (drives the AI Demo Simulation
-- Mode scenario buttons — not part of the core data model described in the
-- brief, but required to track "which scenario is active for which machine".
-- ----------------------------------------------------------------------------
create table if not exists simulation_sessions (
  id           uuid primary key default gen_random_uuid(),
  factory_id   uuid not null references factories(id) on delete cascade,
  machine_id   uuid not null references machines(id) on delete cascade,
  scenario     text not null,
  active       boolean not null default true,
  started_at   timestamptz not null default now(),
  last_tick_at timestamptz,
  unique (machine_id)
);

-- ============================================================================
-- Auto-provisioning: when a user registers, create their factory + profile
-- from the signup metadata (full_name, phone_number, company_name,
-- industry_type, state, district) passed in supabase.auth.signUp options.
-- ============================================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_factory_id uuid;
begin
  insert into factories (owner_id, company_name, industry_type, state, district)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'company_name', 'My Factory'),
    coalesce(new.raw_user_meta_data->>'industry_type', 'General Manufacturing'),
    coalesce(new.raw_user_meta_data->>'state', ''),
    coalesce(new.raw_user_meta_data->>'district', '')
  )
  returning id into new_factory_id;

  insert into profiles (id, full_name, email, phone_number, factory_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    new.raw_user_meta_data->>'phone_number',
    new_factory_id
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================================
-- Row Level Security
-- Every table is scoped to the caller's factory via profiles.factory_id.
-- The service_role key (used server-side by the ESP32 ingestion endpoint and
-- the simulation engine) bypasses RLS entirely, which is expected — a physical
-- device has no Supabase user session.
-- ============================================================================
create or replace function auth_factory_id()
returns uuid
language sql
security definer set search_path = public
stable
as $$
  select factory_id from profiles where id = auth.uid();
$$;

alter table factories enable row level security;
alter table profiles enable row level security;
alter table machines enable row level security;
alter table devices enable row level security;
alter table energy_readings enable row level security;
alter table machine_baselines enable row level security;
alter table anomaly_events enable row level security;
alter table alerts enable row level security;
alter table ai_predictions enable row level security;
alter table maintenance_recommendations enable row level security;
alter table production_records enable row level security;
alter table energy_conservation_events enable row level security;
alter table automation_events enable row level security;
alter table simulation_sessions enable row level security;

drop policy if exists "own factory" on factories;
create policy "own factory" on factories
  for all using (id = auth_factory_id() or owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- Generic per-factory policy, applied to every remaining table.
do $$
declare
  t text;
begin
  foreach t in array array[
    'machines','devices','energy_readings',
    'anomaly_events','alerts','ai_predictions','maintenance_recommendations',
    'production_records','energy_conservation_events','automation_events',
    'simulation_sessions'
  ]
  loop
    execute format(
      'drop policy if exists "factory scoped" on %I;
       create policy "factory scoped" on %I
       for all using (factory_id = auth_factory_id())
       with check (factory_id = auth_factory_id());',
      t, t
    );
  end loop;
end $$;

-- machine_baselines has no factory_id column (keyed by machine_id only) —
-- scope it via a join to machines instead.
drop policy if exists "factory scoped" on machine_baselines;
create policy "baseline via machine" on machine_baselines
  for all using (
    machine_id in (select id from machines where factory_id = auth_factory_id())
  )
  with check (
    machine_id in (select id from machines where factory_id = auth_factory_id())
  );

-- ============================================================================
-- Realtime: allow the dashboard to subscribe to live inserts for the
-- Live Energy graph and Alerts feed.
-- ============================================================================
alter publication supabase_realtime add table energy_readings;
alter publication supabase_realtime add table alerts;
alter publication supabase_realtime add table anomaly_events;
