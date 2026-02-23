/*
 * cep.h  —  JumpNet Capability Enumeration Protocol for Arduino / ESP32
 *
 * Generates a self-description JSON string for any Arduino-compatible board.
 * Zero external dependencies: uses only Wire, SPI, and stdlib.
 *
 * Usage:
 *   #include "cep.h"
 *   CEP cep;
 *   String json = cep.getCapabilitiesJSON();
 *   Serial.println(json);
 *
 * Chipset plugins:
 *   Include chipset headers before or after cep.h, then register:
 *   cep.registerChipset(&bme280Chip);
 *
 * On ESP32 you get: MAC-based device ID, CPU freq, heap, flash, WiFi, I2C scan.
 * On plain Arduino you get: compile-time board model, I2C scan.
 */

#pragma once

#include <Arduino.h>
#include <Wire.h>

// ── Chipset plugin interface ───────────────────────────────────────────────────

struct CepChipsetDescriptor {
    const char* name;
    const uint8_t* i2cAddresses;   // zero-terminated list
    const char** provides;          // null-terminated list of capability strings
    const char* bus;                // "i2c" | "spi"

    // Optional: override to produce custom JSON fragment.
    // Return empty String to use default sensor JSON.
    virtual String describe(int busId, uint8_t address) const { return ""; }
};

// ── CEP builder ───────────────────────────────────────────────────────────────

class CEP {
public:
    static const int MAX_CHIPSETS = 16;

    CEP() : _numChipsets(0) {}

    // Register a chipset plugin
    void registerChipset(const CepChipsetDescriptor* chip) {
        if (_numChipsets < MAX_CHIPSETS) {
            _chipsets[_numChipsets++] = chip;
        }
    }

    // ── Main entry point ─────────────────────────────────────────────────────

    String getCapabilitiesJSON() {
        String caps = "";

        _appendCompute(caps);
        caps += ",";

        String sensors = "";
        _appendI2C(caps, sensors);

        if (sensors.length() > 0) {
            caps += "," + sensors;
        }

        _appendGPIO(caps);
        _appendADC(caps);

#ifdef ESP32
        caps += ",";
        _appendNetwork(caps);
#endif

        String doc = "{";
        doc += "\"device\":" + _deviceObject() + ",";
        doc += "\"capabilities\":[" + caps + "]";
        doc += "}";
        return doc;
    }

private:
    const CepChipsetDescriptor* _chipsets[MAX_CHIPSETS];
    int _numChipsets;

    // ── Device identity ────────────────────────────────────────────────────

    String _deviceObject() {
        String d = "{";
        d += "\"id\":\"" + _deviceId() + "\",";
        d += "\"class\":\"microcontroller\",";
        d += "\"transport\":\"serial\",";
        d += "\"model\":\"" + String(ARDUINO_BOARD) + "\",";
        d += "\"firmware\":\"" + String(ESP_ARDUINO_VERSION_MAJOR) + "." +
             String(ESP_ARDUINO_VERSION_MINOR) + "." +
             String(ESP_ARDUINO_VERSION_PATCH) + "\"";
        d += "}";
        return d;
    }

    String _deviceId() {
#ifdef ESP32
        uint64_t mac = ESP.getEfuseMac();
        char buf[18];
        snprintf(buf, sizeof(buf), "%02x:%02x:%02x:%02x:%02x:%02x",
                 (uint8_t)(mac >> 40),
                 (uint8_t)(mac >> 32),
                 (uint8_t)(mac >> 24),
                 (uint8_t)(mac >> 16),
                 (uint8_t)(mac >>  8),
                 (uint8_t)(mac      ));
        return String(buf);
#else
        return "arduino-" + String(ARDUINO_BOARD);
#endif
    }

    // ── Compute ───────────────────────────────────────────────────────────

    void _appendCompute(String& caps) {
        caps += "{\"type\":\"compute\"";
#ifdef ESP32
        caps += ",\"mhz\":" + String(ESP.getCpuFreqMHz());
        caps += ",\"ram_kb\":" + String(ESP.getHeapSize() / 1024);
        caps += ",\"flash_kb\":" + String(ESP.getFlashChipSize() / 1024);
#endif
        caps += "}";
    }

    // ── I2C scan + chipset matching ───────────────────────────────────────

    void _appendI2C(String& caps, String& sensors) {
        Wire.begin();

        String devices = "[";
        bool first = true;

        // Internal: track found addresses for chipset matching
        uint8_t found[64];
        int     nFound = 0;

        for (uint8_t addr = 1; addr < 127; addr++) {
            Wire.beginTransmission(addr);
            if (Wire.endTransmission() == 0) {
                found[nFound++] = addr;
                char hex[7];
                snprintf(hex, sizeof(hex), "\"0x%02x\"", addr);
                if (!first) devices += ",";
                devices += String(hex);
                first = false;
            }
            delayMicroseconds(100);
        }
        devices += "]";

        caps += ",{\"type\":\"i2c\",\"buses\":[{\"id\":0,\"sda\":21,\"scl\":22,"
                "\"freq_hz\":100000,\"devices_found\":" + devices + "}]}";

        // Match found addresses to chipset plugins
        bool firstSensor = true;
        for (int i = 0; i < nFound; i++) {
            for (int c = 0; c < _numChipsets; c++) {
                const CepChipsetDescriptor* chip = _chipsets[c];
                for (int k = 0; chip->i2cAddresses[k] != 0; k++) {
                    if (chip->i2cAddresses[k] == found[i]) {
                        String custom = chip->describe(0, found[i]);
                        String s;
                        if (custom.length() > 0) {
                            s = custom;
                        } else {
                            char hex[7];
                            snprintf(hex, sizeof(hex), "0x%02x", found[i]);
                            s  = "{\"type\":\"sensor\"";
                            s += ",\"chipset\":\"" + String(chip->name) + "\"";
                            s += ",\"bus\":\"i2c\",\"bus_id\":0";
                            s += ",\"address\":\"" + String(hex) + "\"";
                            s += ",\"provides\":[";
                            bool fp = true;
                            for (int p = 0; chip->provides[p] != nullptr; p++) {
                                if (!fp) s += ",";
                                s += "\"" + String(chip->provides[p]) + "\"";
                                fp = false;
                            }
                            s += "]}";
                        }
                        if (!firstSensor) sensors += ",";
                        sensors += s;
                        firstSensor = false;
                    }
                }
            }
        }
    }

    // ── GPIO ──────────────────────────────────────────────────────────────

    void _appendGPIO(String& caps) {
#ifdef ESP32
        caps += ",{\"type\":\"gpio\",\"digital_out\":[2,4,5,12,13,14,15,16,17,18,19,21,22,23,25,26,27,32,33]"
                ",\"digital_in\":[32,33,34,35,36,39]}";
#else
        caps += ",{\"type\":\"gpio\"}";
#endif
    }

    // ── ADC ───────────────────────────────────────────────────────────────

    void _appendADC(String& caps) {
#ifdef ESP32
        caps += ",{\"type\":\"adc\",\"pins\":[32,33,34,35,36,39],\"resolution\":12,\"channels\":6}";
#endif
    }

    // ── Network (ESP32 only) ───────────────────────────────────────────────

#ifdef ESP32
    void _appendNetwork(String& caps) {
        uint8_t mac[6];
        esp_read_mac(mac, ESP_MAC_WIFI_STA);
        char macStr[18];
        snprintf(macStr, sizeof(macStr), "%02x:%02x:%02x:%02x:%02x:%02x",
                 mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
        caps += "{\"type\":\"network\",\"interfaces\":["
                "{\"kind\":\"wifi\",\"mac\":\"" + String(macStr) + "\"}]}";
    }
#endif
};
