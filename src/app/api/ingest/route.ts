// ESP32 EcoClamp ingestion endpoint (section 9).
//
// Expected payload:
// {
//   "machine_id": "M-001",       // machine_code, NOT the internal uuid
//   "device_id": "EC-001",       // device_code
//   "current": 3.82,
//   "timestamp": "ISO_TIMESTAMP", // optional, defaults to server time
//
//   // Optional — only if your firmware computes more than raw RMS current
//   // (see firmware/ecoclamp_esp32.ino). Stored as raw on-device diagnostics
//   // for reference only; NEVER used as the authoritative health/anomaly
//   // signal — that is always computed server-side in src/lib/engine/ from
//   // `current` + the learned baseline, identically for live and simulated
//   // data.
//   "active_power": 812.4,
//   "peak": 4.1,
//   "p2p": 8.0,
//   "frequency": 50.1,
//   "crest_factor": 1.42,
//   "device_class": "MEDIUM LOAD",
//   "risk": 15,
//   "risk_level": "LOW",
//   "onboard_status": "NORMAL"
// }
//
// Auth: the device authenticates with its own per-device api_key (issued
// when the device row is created) as the `X-Device-Key` header, PLUS a
// shared platform secret as `X-Ingest-Key` (a coarse extra gate so a leaked
// device key alone can't be replayed from an unrelated deployment). Every
// reading written here is stored with source = "live" — never mixed with
// simulation data.
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const sharedSecret = request.headers.get("x-ingest-key");
  if (!process.env.ECOCLAMP_INGEST_SHARED_SECRET || sharedSecret !== process.env.ECOCLAMP_INGEST_SHARED_SECRET) {
    return NextResponse.json({ error: "Unauthorized: invalid or missing X-Ingest-Key" }, { status: 401 });
  }

  const deviceKey = request.headers.get("x-device-key");
  if (!deviceKey) {
    return NextResponse.json({ error: "Missing X-Device-Key header" }, { status: 401 });
  }

  let body: {
    machine_id?: string;
    device_id?: string;
    current?: number;
    timestamp?: string;
    active_power?: number;
    peak?: number;
    p2p?: number;
    frequency?: number;
    crest_factor?: number;
    device_class?: string;
    risk?: number;
    risk_level?: string;
    onboard_status?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.current !== "number" || Number.isNaN(body.current) || body.current < 0) {
    return NextResponse.json({ error: "`current` must be a non-negative number (Amps)" }, { status: 400 });
  }
  if (!body.machine_id || !body.device_id) {
    return NextResponse.json({ error: "`machine_id` and `device_id` are required" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // Verify the device by its api_key AND device_code, so a stolen key can't
  // be used to impersonate a different device_id.
  const { data: device, error: deviceError } = await supabase
    .from("devices")
    .select("id, factory_id, device_code, machine_id")
    .eq("api_key", deviceKey)
    .eq("device_code", body.device_id)
    .maybeSingle();

  if (deviceError || !device) {
    return NextResponse.json({ error: "Unknown device or invalid device key" }, { status: 401 });
  }

  const { data: machine, error: machineError } = await supabase
    .from("machines")
    .select("id, factory_id")
    .eq("machine_code", body.machine_id)
    .eq("factory_id", device.factory_id)
    .maybeSingle();

  if (machineError || !machine) {
    return NextResponse.json({ error: `Unknown machine_id "${body.machine_id}" for this device's factory` }, { status: 404 });
  }

  const recordedAt = body.timestamp ? new Date(body.timestamp) : new Date();
  if (Number.isNaN(recordedAt.getTime())) {
    return NextResponse.json({ error: "Invalid `timestamp`" }, { status: 400 });
  }

  const { error: insertError } = await supabase.from("energy_readings").insert({
    factory_id: machine.factory_id,
    machine_id: machine.id,
    device_id: device.id,
    current_amps: body.current,
    source: "live",
    recorded_at: recordedAt.toISOString(),
    onboard_active_power_w: typeof body.active_power === "number" ? body.active_power : null,
    onboard_peak_amps: typeof body.peak === "number" ? body.peak : null,
    onboard_p2p_amps: typeof body.p2p === "number" ? body.p2p : null,
    onboard_frequency_hz: typeof body.frequency === "number" ? body.frequency : null,
    onboard_crest_factor: typeof body.crest_factor === "number" ? body.crest_factor : null,
    onboard_load_class: body.device_class ?? null,
    onboard_risk_score: typeof body.risk === "number" ? body.risk : null,
    onboard_risk_level: body.risk_level ?? null,
    onboard_status: body.onboard_status ?? null,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await supabase
    .from("devices")
    .update({ status: "connected", last_seen_at: new Date().toISOString() })
    .eq("id", device.id);

  return NextResponse.json({ ok: true, source: "live" }, { status: 201 });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message:
      "EcoClamp ingestion endpoint. POST { machine_id, device_id, current, timestamp, active_power?, peak?, p2p?, frequency?, crest_factor?, device_class?, risk?, risk_level?, onboard_status? } with X-Ingest-Key and X-Device-Key headers.",
  });
}
