/**
 * clients/arduino/jumpnet_cep_example/jumpnet_cep_example.ino
 *
 * JumpNet CEP — Arduino / ESP32 usage example.
 *
 * This sketch:
 *  1. Scans I2C, detects known chipsets
 *  2. Prints the CEP JSON to Serial
 *  3. (If WiFi creds are set) registers with a JumpNet node
 *
 * Board: ESP32 (any variant)
 * Required: no external libraries — cep.h is self-contained.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include "../cep.h"
#include "../chipsets/bme280_chip.h"
#include "../chipsets/ssd1306_chip.h"
#include "../chipsets/mpu6050_chip.h"

// ── Config ────────────────────────────────────────────────────────────────────
const char* WIFI_SSID     = "";          // Set your SSID
const char* WIFI_PASSWORD = "";          // Set your password
const char* JUMPNET_URL   = "http://192.168.1.100:4080";   // Set JumpNet host

// ── Setup ─────────────────────────────────────────────────────────────────────

CEP cep;

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("[CEP] Starting...");

    // Register chipset plugins
    cep.registerChipset(&BME280_Chip);
    cep.registerChipset(&SSD1306_Chip);
    cep.registerChipset(&MPU6050_Chip);

    // Build and print capability JSON
    String json = cep.getCapabilitiesJSON();
    Serial.println("[CEP] Capability document:");
    Serial.println(json);

    // Optional: register with JumpNet over WiFi
    if (strlen(WIFI_SSID) > 0) {
        Serial.print("[WiFi] Connecting...");
        WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
        int attempts = 0;
        while (WiFi.status() != WL_CONNECTED && attempts++ < 20) {
            delay(500);
            Serial.print(".");
        }
        Serial.println();

        if (WiFi.status() == WL_CONNECTED) {
            Serial.println("[WiFi] Connected: " + WiFi.localIP().toString());
            registerWithJumpNet(json);
        } else {
            Serial.println("[WiFi] Failed to connect.");
        }
    }
}

void loop() {
    // Re-register every 60s to keep the JumpNet registry fresh
    static unsigned long lastReg = 0;
    if (strlen(WIFI_SSID) > 0 && WiFi.status() == WL_CONNECTED &&
        millis() - lastReg > 60000) {
        registerWithJumpNet(cep.getCapabilitiesJSON());
        lastReg = millis();
    }
    delay(1000);
}

// ── Helper ───────────────────────────────────────────────────────────────────

void registerWithJumpNet(const String& json) {
    HTTPClient http;
    http.begin(String(JUMPNET_URL) + "/devices/register");
    http.addHeader("Content-Type", "application/json");
    int code = http.POST(json);
    Serial.printf("[CEP] POST /devices/register → %d\n", code);
    http.end();
}
