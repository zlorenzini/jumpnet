"""
clients/micropython/chipsets/ds3231.py

CEP chipset plugin for Maxim DS3231 real-time clock.
I2C address: 0x68
"""

CHIPSET = {
    "name":          "ds3231",
    "i2c_addresses": [0x68],
    "bus":           "i2c",
    "provides":      ["rtc", "temperature"],
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
