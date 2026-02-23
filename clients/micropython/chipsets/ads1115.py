"""
clients/micropython/chipsets/ads1115.py

CEP chipset plugin for Texas Instruments ADS1115 — 4-channel 16-bit ADC.
I2C addresses: 0x48–0x4B (configurable via ADDR pin)
"""

CHIPSET = {
    "name":          "ads1115",
    "i2c_addresses": [0x48, 0x49, 0x4A, 0x4B],
    "bus":           "i2c",
    "provides":      ["adc"],
}


def describe(bus_id: int, address: int) -> dict:
    return {
        "type":       "adc",
        "chipset":    CHIPSET["name"],
        "bus":        "i2c",
        "bus_id":     bus_id,
        "address":    "0x{:02x}".format(address),
        "resolution": 16,
        "channels":   4,
        "provides":   CHIPSET["provides"],
    }
