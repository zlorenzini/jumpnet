"""
clients/micropython/chipsets/bme280.py

CEP chipset plugin for Bosch BME280 — temperature, humidity, pressure.
I2C addresses: 0x76 (SDO=GND), 0x77 (SDO=VCC)
"""

CHIPSET = {
    "name":          "bme280",
    "i2c_addresses": [0x76, 0x77],
    "bus":           "i2c",
    "provides":      ["temperature", "humidity", "pressure"],
}


def describe(bus_id: int, address: int) -> dict:
    """
    Return a sensor capability dict for a BME280 found at the given address.
    Called by the CEP shim after I2C scanning identifies this chipset.
    """
    return {
        "type":     "sensor",
        "chipset":  CHIPSET["name"],
        "bus":      "i2c",
        "bus_id":   bus_id,
        "address":  "0x{:02x}".format(address),
        "provides": CHIPSET["provides"],
    }
