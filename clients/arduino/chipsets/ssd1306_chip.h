/**
 * clients/arduino/chipsets/ssd1306_chip.h
 *
 * CEP chipset descriptor for SSD1306 OLED display.
 */

#pragma once
#include "../cep.h"

static const uint8_t  _ssd1306_addrs[]   = { 0x3C, 0x3D, 0x00 };
static const char*    _ssd1306_provides[] = { "display", nullptr };

struct SSD1306ChipDescriptor : public CepChipsetDescriptor {
    SSD1306ChipDescriptor() {
        name         = "ssd1306";
        i2cAddresses = _ssd1306_addrs;
        provides     = _ssd1306_provides;
        bus          = "i2c";
    }

    String describe(int busId, uint8_t address) const override {
        char hex[7];
        snprintf(hex, sizeof(hex), "0x%02x", address);
        String s = "{\"type\":\"display\"";
        s += ",\"chipset\":\"ssd1306\"";
        s += ",\"bus\":\"i2c\",\"bus_id\":" + String(busId);
        s += ",\"address\":\"" + String(hex) + "\"";
        s += ",\"width_px\":128,\"height_px\":64,\"color\":false}";
        return s;
    }
};

static SSD1306ChipDescriptor SSD1306_Chip;
