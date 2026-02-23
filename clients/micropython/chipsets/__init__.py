"""
clients/micropython/chipsets/__init__.py

Lists all chipset plugin module names for the CEP auto-loader.
Add your chipset module name here to enable auto-detection.
"""

PLUGIN_LIST = [
    "bme280",     # Bosch BME280: temperature, humidity, pressure
    "ssd1306",    # SSD1306 OLED display
    "ws2812",     # WS2812 / NeoPixel (I2C bridge via IS31FL3731 or similar)
    "pcm5102",    # PCM5102 I2S DAC (GPIO-detected, listed here for inventory)
    "ina219",     # INA219 current/voltage sensor
    "ads1115",    # ADS1115 16-bit ADC
    "mpu6050",    # MPU-6050 IMU (accelerometer + gyro)
    "ds3231",     # DS3231 real-time clock
]
