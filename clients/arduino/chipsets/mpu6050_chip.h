/**
 * clients/arduino/chipsets/mpu6050_chip.h
 *
 * CEP chipset descriptor for InvenSense MPU-6050 IMU.
 */

#pragma once
#include "../cep.h"

static const uint8_t _mpu6050_addrs[]   = { 0x68, 0x69, 0x00 };
static const char*   _mpu6050_provides[] = { "acceleration", "gyroscope", "temperature", nullptr };

static const CepChipsetDescriptor MPU6050_Chip = {
    .name         = "mpu6050",
    .i2cAddresses = _mpu6050_addrs,
    .provides     = _mpu6050_provides,
    .bus          = "i2c",
};
