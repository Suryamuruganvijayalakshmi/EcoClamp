/*
=========================================================
        ECOCLAMP -- MULTI-CHANNEL VARIANT
   ONE ESP32 + UP TO 3 SCT-013-000 CT CLAMPS
   -> reports each clamp as its own machine in the dashboard
=========================================================

Why this exists: one EcoClamp *controller* (this ESP32, its Wi-Fi
connection, its device API key) can carry multiple CT clamps at once -- one
per ADC1-capable pin -- and report each clamp's reading against a
DIFFERENT machine_id. The dashboard doesn't organize data by physical
device, it organizes by machine: baseline learning, anomaly detection
(Isolation Forest), health score, forecast -- every layer runs per
machine_id independently, exactly as if each clamp had its own separate
ESP32.

Every channel uses the SAME DEVICE_ID / DEVICE_API_KEY below (it genuinely
is the same physical device reporting all of them), but a DIFFERENT
MACHINE_ID per channel. The app's /api/ingest endpoint already supports
this with no backend changes: it authenticates the device by its API key,
then looks up whichever machine_code the reading names, independently per
request -- it does not require a device to be permanently "paired" to only
one machine.

HARDWARE PER CHANNEL: SCT-013-000 + 33 ohm burden resistor + 10k+10k bias
divider, same as the single-channel sketch -- just repeated on a different
ADC1 pin. Safe ESP32 ADC1 pins to use together (don't conflict with Wi-Fi,
unlike ADC2 pins): GPIO32, GPIO33, GPIO34, GPIO35, GPIO36 (VP), GPIO39 (VN).
This sketch uses GPIO34 / GPIO35 / GPIO32 for channels 1-3.

BEFORE FLASHING: create each additional machine (EC002, EC003, ...) on the
Machines page first -- the ingest endpoint rejects a machine_code it
doesn't recognize for your factory. If you only have one physical clamp
wired up right now, that's fine: leave the other channel(s) in CHANNELS[]
commented out or physically unconnected -- an unconnected ADC pin will just
read noise near zero, which is honest (no load = no reading), it won't
crash anything.
=========================================================
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
// ECOCLAMP APP
// =====================================================
const char* SERVER_HOST = "http://10.215.132.167:3000";
const char* INGEST_PATH = "/api/ingest";
const char* INGEST_SHARED_SECRET = "d91cee8d41121ad7011669c3eda7b3508489e7028cb1de4b";

// Same physical device for every channel -- from your EcoClamp Devices page.
const char* DEVICE_ID = "EC001";
const char* DEVICE_API_KEY = "4ef8064befabd70d5595bf338df60d95d37ca310";

// =====================================================
// SENSOR / ELECTRICAL CONSTANTS (shared across all channels)
// =====================================================
const float BURDEN_RESISTOR = 33.0;
const float CT_RATIO = 2000.0; // SCT-013-000: 100A / 0.05A
const float MAINS_VOLTAGE = 230.0;
const float POWER_FACTOR = 0.90;
const float ADC_VREF = 3.3;
const float ADC_MAX = 4095.0;
const int SAMPLE_COUNT = 1000;
const int SAMPLE_DELAY_US = 100;

// =====================================================
// CHANNELS -- one entry per clamp. machine_id must match a machine_code
// you've already created on the Machines page. Comment out / remove
// entries for clamps you don't physically have wired up yet.
// =====================================================
struct Channel {
  int ctPin;
  const char* machineId;
  float bias; // filled in during calibration, leave as 0 here
};

Channel CHANNELS[] = {
  { 34, "S1", 0 },    // clamp 1 -> the machine you already have wired up (machine_code "S1")
  { 35, "EC002", 0 }, // clamp 2 -> create machine "EC002" first
  { 32, "EC003", 0 }, // clamp 3 -> create machine "EC003" first
};
const int NUM_CHANNELS = sizeof(CHANNELS) / sizeof(CHANNELS[0]);

// =====================================================
// WIFI CONNECTION
// =====================================================
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
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
// PER-CHANNEL ZERO-CURRENT CALIBRATION
// =====================================================
void calibrateChannel(Channel &ch) {
  long total = 0;
  const int calibrationSamples = 2000;
  for (int i = 0; i < calibrationSamples; i++) {
    total += analogRead(ch.ctPin);
    delayMicroseconds(100);
  }
  ch.bias = (float)total / calibrationSamples;
  Serial.print("  Channel ");
  Serial.print(ch.machineId);
  Serial.print(" (GPIO");
  Serial.print(ch.ctPin);
  Serial.print(") bias = ");
  Serial.println(ch.bias, 2);
}

// =====================================================
// PER-CHANNEL SAMPLING (same math as the single-channel sketch)
// =====================================================
struct SampleResult {
  float irms, activePower, peak, p2p, frequency, crestFactor;
  String deviceClass, riskLevel, status;
  int risk;
};

SampleResult sampleChannel(Channel &ch) {
  double sumSquares = 0;
  float maximum = -9999, minimum = 9999;
  int zeroCrossings = 0;
  float previousSample = 0;
  unsigned long startTime = micros();

  for (int i = 0; i < SAMPLE_COUNT; i++) {
    int raw = analogRead(ch.ctPin);
    float centeredADC = raw - ch.bias;
    float acVoltage = (centeredADC / ADC_MAX) * ADC_VREF;

    sumSquares += acVoltage * acVoltage;
    if (acVoltage > maximum) maximum = acVoltage;
    if (acVoltage < minimum) minimum = acVoltage;
    if ((previousSample < 0 && acVoltage >= 0) || (previousSample > 0 && acVoltage <= 0)) zeroCrossings++;
    previousSample = acVoltage;

    delayMicroseconds(SAMPLE_DELAY_US);
  }

  unsigned long elapsed = micros() - startTime;

  float vrms = sqrt(sumSquares / SAMPLE_COUNT);
  float irms = (vrms / BURDEN_RESISTOR) * CT_RATIO;
  float activePower = irms * MAINS_VOLTAGE * POWER_FACTOR;

  float peakVoltage = max(fabs(maximum), fabs(minimum));
  float peakCurrent = (peakVoltage / BURDEN_RESISTOR) * CT_RATIO;
  float p2pVoltage = maximum - minimum;
  float p2pCurrent = (p2pVoltage / BURDEN_RESISTOR) * CT_RATIO;

  float measurementTime = elapsed / 1000000.0;
  float frequency = (zeroCrossings >= 2) ? (zeroCrossings / 2.0) / measurementTime : 0;
  float crestFactor = (irms > 0.01) ? peakCurrent / irms : 0;

  String deviceClass;
  if (irms < 0.05) deviceClass = "STANDBY / IDLE";
  else if (activePower < 150) deviceClass = "LIGHT LOAD";
  else if (activePower < 800) deviceClass = "MEDIUM LOAD";
  else if (activePower < 2000) deviceClass = "HEAVY LOAD";
  else deviceClass = "HIGH POWER LOAD";

  int risk = 0;
  if (irms < 0.05) risk = 0;
  else if (activePower < 150) risk = 5;
  else if (activePower < 800) risk = 15;
  else if (activePower < 2000) risk = 25;
  else risk = 60;
  if (irms > 0.05) {
    if (frequency < 45 || frequency > 55) risk += 20;
    if (crestFactor > 3.0) risk += 20;
    else if (crestFactor > 2.0) risk += 10;
  }
  if (risk > 100) risk = 100;

  String riskLevel, status;
  if (irms < 0.05) { riskLevel = "NO_LOAD"; status = "NO_LOAD"; }
  else if (risk < 25) { riskLevel = "LOW"; status = "NORMAL"; }
  else if (risk < 50) { riskLevel = "MEDIUM"; status = "MONITOR"; }
  else if (risk < 75) { riskLevel = "HIGH"; status = "ABNORMAL"; }
  else { riskLevel = "CRITICAL"; status = "FAULT_RISK"; }

  return { irms, activePower, peakCurrent, p2pCurrent, frequency, crestFactor, deviceClass, riskLevel, status, risk };
}

// =====================================================
// SEND ONE CHANNEL'S READING TO THE ECOCLAMP APP
// =====================================================
void sendReading(const char* machineId, const SampleResult &r) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    if (WiFi.status() != WL_CONNECTED) return;
  }

  HTTPClient http;
  String url = String(SERVER_HOST) + String(INGEST_PATH);
  http.begin(url);
  http.setTimeout(5000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Ingest-Key", INGEST_SHARED_SECRET);
  http.addHeader("X-Device-Key", DEVICE_API_KEY);

  String json = "{";
  json += "\"machine_id\":\""; json += machineId; json += "\"";
  json += ",\"device_id\":\""; json += DEVICE_ID; json += "\"";
  json += ",\"current\":"; json += String(r.irms, 3);
  json += ",\"active_power\":"; json += String(r.activePower, 2);
  json += ",\"peak\":"; json += String(r.peak, 3);
  json += ",\"p2p\":"; json += String(r.p2p, 3);
  json += ",\"frequency\":"; json += String(r.frequency, 2);
  json += ",\"crest_factor\":"; json += String(r.crestFactor, 3);
  json += ",\"device_class\":\""; json += r.deviceClass; json += "\"";
  json += ",\"risk\":"; json += String(r.risk);
  json += ",\"risk_level\":\""; json += r.riskLevel; json += "\"";
  json += ",\"onboard_status\":\""; json += r.status; json += "\"";
  json += "}";

  int httpCode = http.POST(json);
  Serial.print("  -> HTTP ");
  Serial.println(httpCode);
  if (!(httpCode >= 200 && httpCode < 300)) Serial.println(http.getString());
  http.end();
}

// =====================================================
// SETUP
// =====================================================
void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  for (int i = 0; i < NUM_CHANNELS; i++) analogSetPinAttenuation(CHANNELS[i].ctPin, ADC_11db);

  delay(1000);
  Serial.println();
  Serial.println("==========================================");
  Serial.println("     ECOCLAMP -- MULTI-CHANNEL");
  Serial.print("     ");
  Serial.print(NUM_CHANNELS);
  Serial.println(" clamp(s) configured");
  Serial.println("==========================================");

  connectWiFi();

  Serial.println();
  Serial.println("ZERO CURRENT CALIBRATION -- keep every clamp's load OFF.");
  delay(2000);
  for (int i = 0; i < NUM_CHANNELS; i++) calibrateChannel(CHANNELS[i]);
  Serial.println("Calibration complete. Monitoring started...");
}

// =====================================================
// LOOP -- sample and send every channel in turn
// =====================================================
void loop() {
  for (int i = 0; i < NUM_CHANNELS; i++) {
    SampleResult r = sampleChannel(CHANNELS[i]);

    Serial.println();
    Serial.print("--- ");
    Serial.print(CHANNELS[i].machineId);
    Serial.println(" ---");
    Serial.print("  Current: "); Serial.print(r.irms, 3); Serial.println(" A");
    Serial.print("  Power:   "); Serial.print(r.activePower, 2); Serial.println(" W");
    Serial.print("  Status:  "); Serial.println(r.status);

    sendReading(CHANNELS[i].machineId, r);
  }
}
