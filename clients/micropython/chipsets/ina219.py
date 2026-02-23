"""
clients/micropython/chipsets/ina219.py

CEP chipset plugin for Texas Instruments INA219 — power monitor.
I2C addresses: 0x40–0x4F (configurable via A0/A1 pins)
"""

CHIPSET = {
    "name":          "ina219",
    "i2c_addresses": [0x40, 0x41, 0x44, 0x45],
    "bus":           "i2c",
    "provides":      ["voltage", "current", "power"],
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
