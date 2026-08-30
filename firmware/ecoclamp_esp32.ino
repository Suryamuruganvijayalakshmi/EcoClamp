/*
 * EcoClamp ESP32 Firmware — SCT-013-000 CT Sensor -> EcoClamp Dashboard
 * ----------------------------------------------------------------------
 * Reads AC current from a non-invasive clamp-on CT sensor, computes RMS
 * current, estimated power, peak / peak-to-peak current, mains frequency,
 * and crest factor entirely on-device, then POSTs each reading to the
 * EcoClamp app's ingestion endpoint (/api/ingest) as source = "live".
 *
 * This firmware talks to the EcoClamp APP, not to Supabase directly. The
 * app's server-side engine (src/lib/engine/) is what actually drives the
 * dashboard's baseline learning, anomaly detection, health score, forecast
 * and maintenance tiers — computed uniformly from `current_amps`, the same
 * way for every machine. The extra diagnostics below (power/peak/p2p/
 * frequency/crest factor/on-device load class/on-device risk score) are
 * still sent and stored, but only as supplementary raw telemetry — never
 * as a certified fault diagnosis. That's a deliberate design choice: no
 * single device's self-reported "risk %" should be able to disagree with,
 * or bypass, what the dashboard tells the operator.
 *
 * HARDWARE
 *   ESP32 dev board (ADC1 pin — avoid ADC2 pins, they conflict with Wi-Fi)
 *   SCT-013-000 CT sensor (100 A : 0.05 A) + 33 ohm burden resistor
 *   10k + 10k bias divider from 3.3V to GND, midpoint -> CT_PIN
 *   See firmware/README.md for wiring + calibration.
 *
 * SETUP
 *   1. Fill in WIFI_SSID / WIFI_PASSWORD below (already set to your network).
 *   2. Set SERVER_HOST to your deployed app's URL, e.g.
 *      "https://your-app.vercel.app" or "http://192.168.1.50:3000" for a
 *      dev server on the same LAN as this board.
 *   3. Set INGEST_SHARED_SECRET to match ECOCLAMP_INGEST_SHARED_SECRET in
 *      the app's .env.local.
 *   4. In the dashboard: create a Machine (copy its Machine ID, e.g.
 *      "M-001") and connect an EcoClamp Device (copy its Device ID, e.g.
 *      "EC-001", and the API key it generates). Fill those into
 *      MACHINE_ID / DEVICE_ID / DEVICE_API_KEY below.
 *   5. Flash to the ESP32, open Serial Monitor at 115200 baud, keep the
 *      load OFF for the first ~2 seconds while it zero-calibrates.
 *
 * No ArduinoJson dependency — the JSON payload is built by hand, same as
 * your original sketch.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <math.h>


// =====================================================
// WIFI
// =====================================================

const char* WIFI_SSID = "Pixel-9a";
const char* WIFI_PASSWORD = "surya123";


// =====================================================
// ECOCLAMP APP (replaces direct Supabase calls)
// =====================================================

// Point this at your PC's LAN IP while running `npm run dev` there, e.g.
// "http://192.168.1.42:3000" — NOT "localhost", the ESP32 can't resolve
// that as itself. Find your IP with `ipconfig` (look for "IPv4 Address"
// under your Wi-Fi adapter) and replace ONLY the IP below. Once you deploy
// to Vercel/etc, swap this for that URL instead (with https://).
const char* SERVER_HOST = "http://10.215.132.167:3000";
const char* INGEST_PATH = "/api/ingest";

// Must match ECOCLAMP_INGEST_SHARED_SECRET in the app's .env.local.
const char* INGEST_SHARED_SECRET = "d91cee8d41121ad7011669c3eda7b3508489e7028cb1de4b";

// From your dashboard: Machines -> "CNC" (S1), EcoClamp Devices -> "CNC Motor" (EC001).
const char* MACHINE_ID = "S1";                 // machines.machine_code
const char* DEVICE_ID = "EC001";               // devices.device_code
const char* DEVICE_API_KEY = "4ef8064befabd70d5595bf338df60d95d37ca310";


// =====================================================
// CT SENSOR
// =====================================================

#define CT_PIN 34

const float BURDEN_RESISTOR = 33.0;

// SCT-013-000: 100A / 0.05A = 2000
const float CT_RATIO = 2000.0;


// =====================================================
// ELECTRICAL PARAMETERS (prototype assumptions — shown in the
// dashboard as estimates, never as measured values)
// =====================================================

const float MAINS_VOLTAGE = 230.0;
const float POWER_FACTOR = 0.90;


// =====================================================
// ADC
// =====================================================

const float ADC_VREF = 3.3;
const float ADC_MAX = 4095.0;


// =====================================================
// SAMPLING
// =====================================================

const int SAMPLE_COUNT = 1000;
const int SAMPLE_DELAY_US = 100;


// =====================================================
// BIAS
// =====================================================

float biasADC = 0;


// =====================================================
// WIFI CONNECTION
// =====================================================

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  Serial.println();
  Serial.println("Connecting WiFi...");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
    delay(200);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi CONNECTED");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi FAILED");
  }
}


// =====================================================
// SEND TO ECOCLAMP APP  (/api/ingest — service-role backed, same auth
// contract as the rest of the platform: X-Ingest-Key + X-Device-Key)
// =====================================================

void sendToEcoClamp(
  float irms,
  float activePower,
  float peak,
  float p2p,
  float frequency,
  float crestFactor,
  String deviceClass,
  int risk,
  String riskLevel,
  String status
) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    if (WiFi.status() != WL_CONNECTED) {
      return;
    }
  }

  HTTPClient http;
  String url = String(SERVER_HOST) + String(INGEST_PATH);
  http.begin(url);
  http.setTimeout(5000);

  // ===================================================
  // HEADERS — the app's own auth, not a Supabase key
  // ===================================================
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Ingest-Key", INGEST_SHARED_SECRET);
  http.addHeader("X-Device-Key", DEVICE_API_KEY);

  // ===================================================
  // JSON — matches /api/ingest's payload contract
  // ===================================================
  String json = "{";

  json += "\"machine_id\":\"";
  json += MACHINE_ID;
  json += "\"";

  json += ",\"device_id\":\"";
  json += DEVICE_ID;
  json += "\"";

  json += ",\"current\":";
  json += String(irms, 3);

  json += ",\"active_power\":";
  json += String(activePower, 2);

  json += ",\"peak\":";
  json += String(peak, 3);

  json += ",\"p2p\":";
  json += String(p2p, 3);

  json += ",\"frequency\":";
  json += String(frequency, 2);

  json += ",\"crest_factor\":";
  json += String(crestFactor, 3);

  json += ",\"device_class\":\"";
  json += deviceClass;
  json += "\"";

  json += ",\"risk\":";
  json += String(risk);

  json += ",\"risk_level\":\"";
  json += riskLevel;
  json += "\"";

  json += ",\"onboard_status\":\"";
  json += status;
  json += "\"";

  json += "}";

  // ===================================================
  // SEND
  // ===================================================
  int httpCode = http.POST(json);

  Serial.print("EcoClamp HTTP: ");
  Serial.println(httpCode);

  if (httpCode >= 200 && httpCode < 300) {
    Serial.println("UPLOAD SUCCESS");
  } else {
    Serial.println("UPLOAD FAILED");
    Serial.println(http.getString());
  }

  http.end();
}


// =====================================================
// SETUP
// =====================================================

void setup() {
  Serial.begin(115200);

  analogReadResolution(12);
  analogSetPinAttenuation(CT_PIN, ADC_11db);

  delay(1000);

  Serial.println();
  Serial.println("==========================================");
  Serial.println("          ECOCLAMP");
  Serial.println("   INTELLIGENT ENERGY MONITOR");
  Serial.println("==========================================");

  connectWiFi();

  // ===================================================
  // ZERO CURRENT CALIBRATION
  // ===================================================
  Serial.println();
  Serial.println("ZERO CURRENT CALIBRATION");
  Serial.println("Keep the load OFF.");

  delay(2000);

  long total = 0;
  const int calibrationSamples = 2000;

  for (int i = 0; i < calibrationSamples; i++) {
    total += analogRead(CT_PIN);
    delayMicroseconds(100);
  }

  biasADC = (float)total / calibrationSamples;

  Serial.print("Bias ADC = ");
  Serial.println(biasADC, 2);

  Serial.println();
  Serial.println("Calibration completed.");
  Serial.println("Monitoring started...");
  Serial.println();
}


// =====================================================
// LOOP
// =====================================================

void loop() {
  double sumSquares = 0;
  float maximum = -9999;
  float minimum = 9999;
  int zeroCrossings = 0;
  float previousSample = 0;

  unsigned long startTime = micros();

  // ===================================================
  // SAMPLE CURRENT WAVEFORM
  // ===================================================
  for (int i = 0; i < SAMPLE_COUNT; i++) {
    int raw = analogRead(CT_PIN);

    float centeredADC = raw - biasADC;
    float acVoltage = (centeredADC / ADC_MAX) * ADC_VREF;

    sumSquares += acVoltage * acVoltage;

    if (acVoltage > maximum) maximum = acVoltage;
    if (acVoltage < minimum) minimum = acVoltage;

    if ((previousSample < 0 && acVoltage >= 0) || (previousSample > 0 && acVoltage <= 0)) {
      zeroCrossings++;
    }

    previousSample = acVoltage;
    delayMicroseconds(SAMPLE_DELAY_US);
  }

  unsigned long elapsed = micros() - startTime;

  // ===================================================
  // RMS CURRENT
  // ===================================================
  float vrms = sqrt(sumSquares / SAMPLE_COUNT);
  float secondaryCurrent = vrms / BURDEN_RESISTOR;
  float irms = secondaryCurrent * CT_RATIO;

  // ===================================================
  // POWER (estimate — always labelled as such in the dashboard)
  // ===================================================
  float activePower = irms * MAINS_VOLTAGE * POWER_FACTOR;

  // ===================================================
  // PEAK / P2P CURRENT
  // ===================================================
  float peakVoltage = max(fabs(maximum), fabs(minimum));
  float peakCurrent = (peakVoltage / BURDEN_RESISTOR) * CT_RATIO;

  float p2pVoltage = maximum - minimum;
  float p2pCurrent = (p2pVoltage / BURDEN_RESISTOR) * CT_RATIO;

  // ===================================================
  // FREQUENCY
  // ===================================================
  float measurementTime = elapsed / 1000000.0;
  float frequency = 0;
  if (zeroCrossings >= 2) {
    frequency = (zeroCrossings / 2.0) / measurementTime;
  }

  // ===================================================
  // CREST FACTOR
  // ===================================================
  float crestFactor = 0;
  if (irms > 0.01) {
    crestFactor = peakCurrent / irms;
  }

  // ===================================================
  // ON-DEVICE LOAD CLASS (rough label only — the dashboard's own
  // health/anomaly engine is the authoritative signal, not this)
  // ===================================================
  String deviceClass;
  if (irms < 0.05) {
    deviceClass = "STANDBY / IDLE";
  } else if (activePower < 150) {
    deviceClass = "LIGHT LOAD";
  } else if (activePower < 800) {
    deviceClass = "MEDIUM LOAD";
  } else if (activePower < 2000) {
    deviceClass = "HEAVY LOAD";
  } else {
    deviceClass = "HIGH POWER LOAD";
  }

  // ===================================================
  // ON-DEVICE RISK SCORE (heuristic, sent as raw telemetry only —
  // see the comment at the top of this file)
  // ===================================================
  int risk = 0;
  if (irms < 0.05) {
    risk = 0;
  } else if (activePower < 150) {
    risk = 5;
  } else if (activePower < 800) {
    risk = 15;
  } else if (activePower < 2000) {
    risk = 25;
  } else {
    risk = 60;
  }

  if (irms > 0.05) {
    if (frequency < 45 || frequency > 55) {
      risk += 20;
    }
    if (crestFactor > 3.0) {
      risk += 20;
    } else if (crestFactor > 2.0) {
      risk += 10;
    }
  }

  if (risk > 100) risk = 100;

  String riskLevel;
  String status;
  if (irms < 0.05) {
    riskLevel = "NO_LOAD";
    status = "NO_LOAD";
  } else if (risk < 25) {
    riskLevel = "LOW";
    status = "NORMAL";
  } else if (risk < 50) {
    riskLevel = "MEDIUM";
    status = "MONITOR";
  } else if (risk < 75) {
    riskLevel = "HIGH";
    status = "ABNORMAL";
  } else {
    riskLevel = "CRITICAL";
    status = "FAULT_RISK";
  }

  // ===================================================
  // SERIAL OUTPUT
  // ===================================================
  Serial.println();
  Serial.println("--------------- ECOCLAMP ---------------");
  Serial.print("Current       : "); Serial.print(irms, 3); Serial.println(" A");
  Serial.print("Power (est.)  : "); Serial.print(activePower, 2); Serial.println(" W");
  Serial.print("Peak          : "); Serial.print(peakCurrent, 3); Serial.println(" A");
  Serial.print("P2P           : "); Serial.print(p2pCurrent, 3); Serial.println(" A");
  Serial.print("Frequency     : "); Serial.print(frequency, 2); Serial.println(" Hz");
  Serial.print("Crest Factor  : "); Serial.println(crestFactor, 3);
  Serial.print("Load Class    : "); Serial.println(deviceClass);
  Serial.print("On-device Risk: "); Serial.print(risk); Serial.println("%");
  Serial.print("Risk Level    : "); Serial.println(riskLevel);
  Serial.print("Status        : "); Serial.println(status);

  // ===================================================
  // SEND TO ECOCLAMP APP
  // ===================================================
  sendToEcoClamp(
    irms,
    activePower,
    peakCurrent,
    p2pCurrent,
    frequency,
    crestFactor,
    deviceClass,
    risk,
    riskLevel,
    status
  );

  // No fixed delay between loops — matches your original "fast
  // transmission" design. Each loop already takes roughly SAMPLE_COUNT *
  // SAMPLE_DELAY_US (~100ms) for sampling plus Wi-Fi POST latency, so you
  // get on the order of a few readings per second. If you'd rather send
  // less often (fewer rows in Supabase, gentler on the dashboard's
  // realtime feed), add e.g. `delay(2000);` here.
}
