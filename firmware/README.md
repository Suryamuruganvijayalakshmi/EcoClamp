# EcoClamp ESP32 Firmware

Flash `ecoclamp_esp32.ino` to an ESP32 dev board to turn it into a live
EcoClamp device that POSTs real CT current readings to your dashboard with
`source = "live"`.

## Hardware

- ESP32 dev board (any variant with a usable ADC1 pin)
- Non-invasive clamp-on CT sensor — the shipped sketch is tuned for
  **SCT-013-000** (100 A : 0.05 A, bare CT, no internal burden resistor)
  with a 33Ω external burden resistor. If you use a different CT (e.g.
  SCT-013-030, 30 A : 1 V with a built-in burden), update `CT_RATIO` and
  `BURDEN_RESISTOR` at the top of the sketch accordingly.
- 33Ω burden resistor (for a bare CT like the SCT-013-000)
- 2x 10kΩ resistors (bias divider) to center the CT's AC output around Vcc/2
- Jumper wires, breadboard or perfboard

## Wiring

```
        CT sensor (SCT-013-030)
        ┌─────────────┐
 clamp → │             │ ── lead 1 ──┬── ADC pin (GPIO34)
  onto   │   CURRENT   │             │
  a live │   CARRYING  │            10kΩ
  wire   │    WIRE     │             │
        └─────────────┘         3.3V ─┤
                                       │
                                      10kΩ
                                       │
                              lead 2 ──┴── GND
```

The two 10kΩ resistors form a voltage divider that biases the CT's AC output
to sit within the ESP32 ADC's 0–3.3 V range (ADC pins can't read negative
voltage). The midpoint of the divider is where `lead 1` of the CT connects,
and is also the `CT_PIN` input.

**Never clamp the CT around both wires of a mains cable (live + neutral)** —
it must go around a single current-carrying conductor only, or it will read
zero (the fields cancel).

## Calibration

The sketch zero-calibrates automatically on every boot (keep the load OFF
for the first ~2 seconds after power-up while it samples the resting ADC
bias) — no manual zero-offset needed.

For current-scale accuracy:

1. Flash the firmware with the default `CT_RATIO` (2000.0, from the
   SCT-013-000's 100A:0.05A spec) and `BURDEN_RESISTOR` (33.0Ω).
2. Clamp onto a machine's supply line and run it under a known, steady load.
3. Compare the Serial Monitor's reported current against a clamp meter on
   the same wire.
4. Adjust `CT_RATIO` proportionally: `new_ratio = old_ratio * (clamp_meter_reading / firmware_reading)`.
5. Re-flash and re-check across a couple of load levels.

## Getting your device credentials

1. In the EcoClamp dashboard, go to **EcoClamp Devices → Connect EcoClamp**.
2. Enter a Device ID (e.g. `EC-001`) and name, optionally pairing it to a
   machine immediately.
3. Copy the generated API key into `DEVICE_API_KEY` in the sketch.
4. Set `MACHINE_ID` to the target machine's Machine ID (e.g. `M-001`) —
   this must match a machine already created in **Machines**.
5. Set `INGEST_SHARED_SECRET` to the same value as `ECOCLAMP_INGEST_SHARED_SECRET`
   in the app's `.env.local`.
6. Set `SERVER_HOST` to your running app's URL (a Vercel deployment, or
   `http://<your-PC's-LAN-IP>:3000` if the ESP32 and your dev server are on
   the same Wi-Fi network — `localhost` won't work from the ESP32's side).

## Payload

The firmware computes RMS current plus a few extra diagnostics on-device
(estimated power, peak / peak-to-peak current, mains frequency, crest
factor, a rough load classification, and a heuristic risk score), and POSTs
all of it to `/api/ingest`:

```json
{
  "machine_id": "M-001",
  "device_id": "EC-001",
  "current": 3.82,
  "active_power": 812.4,
  "peak": 4.1,
  "p2p": 8.0,
  "frequency": 50.1,
  "crest_factor": 1.42,
  "device_class": "MEDIUM LOAD",
  "risk": 15,
  "risk_level": "LOW",
  "onboard_status": "NORMAL"
}
```

with headers `X-Ingest-Key` (shared platform secret) and `X-Device-Key`
(this device's own API key). A successful call returns `201` and marks the
device as `connected` on the Devices page. Only `current` actually drives
the dashboard's baseline/anomaly/health/forecast engine — the rest is
stored on the reading as raw on-device telemetry for reference, never as a
certified diagnosis (that's a deliberate honesty rule that applies
everywhere in this app, not just here).

## Multiple machines

Flash one ESP32 + CT sensor pair per machine you want to monitor (each with
its own `DEVICE_ID` / `MACHINE_ID` / `DEVICE_API_KEY`). The dashboard
aggregates all connected devices under your factory automatically.
