"""
clients/micropython/chipsets/mpu6050.py

CEP chipset plugin for InvenSense MPU-6050 IMU.
I2C addresses: 0x68 (AD0=GND), 0x69 (AD0=VCC)
"""

CHIPSET = {
    "name":          "mpu6050",
    "i2c_addresses": [0x68, 0x69],
    "bus":           "i2c",
    "provides":      ["acceleration", "gyroscope", "temperature"],
}


def describe(bus_id: int, address: int) -> dict:
    return {
        "type":     "sensor",
        "chipset":  CHIPSET["name"],
        "bus":      "i2c",
        "bus_id":   bus_id,
        "address":  "0x{:02x}".format(address),
        "provides": CHIPSET["provides"],
    }
