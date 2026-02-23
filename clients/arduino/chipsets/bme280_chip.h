/**
 * clients/arduino/chipsets/bme280_chip.h
 *
 * CEP chipset descriptor for Bosch BME280.
 * Include AFTER cep.h, then call cep.registerChipset(&BME280_Chip).
 */

#pragma once
#include "../cep.h"

// Zero-terminated address list
static const uint8_t _bme280_addrs[] = { 0x76, 0x77, 0x00 };

// Null-terminated provides list
static const char* _bme280_provides[] = { "temperature", "humidity", "pressure", nullptr };

static const CepChipsetDescriptor BME280_Chip = {
    .name          = "bme280",
    .i2cAddresses  = _bme280_addrs,
    .provides      = _bme280_provides,
    .bus           = "i2c",
};
