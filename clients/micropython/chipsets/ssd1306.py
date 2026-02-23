"""
clients/micropython/chipsets/ssd1306.py

CEP chipset plugin for SSD1306 OLED display controller.
I2C addresses: 0x3C (most common), 0x3D
"""

CHIPSET = {
    "name":          "ssd1306",
    "i2c_addresses": [0x3C, 0x3D],
    "bus":           "i2c",
    "provides":      ["display"],
}


def describe(bus_id: int, address: int) -> dict:
    return {
        "type":      "display",
        "chipset":   CHIPSET["name"],
        "bus":       "i2c",
        "bus_id":    bus_id,
        "address":   "0x{:02x}".format(address),
        "width_px":  128,
        "height_px": 64,
        "color":     False,
    }
