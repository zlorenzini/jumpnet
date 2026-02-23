"""
clients/python/test_cep_desktop.py

Tests the MicroPython CEP shim (clients/micropython/cep.py) on a normal
desktop Python 3 installation — no hardware, no ESP32 required.

Mocks the MicroPython-only modules (machine, ujson, network, etc.) so the
entire cep.py logic runs and produces a valid CEP document.

Usage:
    python clients/python/test_cep_desktop.py
"""

import sys, json, types, importlib, os, pathlib

# ── 1. Inject MicroPython stubs into sys.modules ──────────────────────────────

# ----- machine ---------------------------------------------------------------
machine = types.ModuleType("machine")

class _Pin:
    def __init__(self, n, mode=None): self.n = n
    def __repr__(self): return f"Pin({self.n})"

class _I2C:
    """Minimal I2C stub that pretends to find a BME280 (0x76) and SSD1306 (0x3C)."""
    def __init__(self, bus_id, sda=None, scl=None, freq=100_000):
        self.bus_id = bus_id
    def scan(self):
        return [0x76, 0x3C]   # BME280 + SSD1306

class _ADC:
    def __init__(self, pin): pass
    def read(self): return 2048

machine.Pin        = _Pin
machine.I2C        = _I2C
machine.ADC        = _ADC
machine.unique_id  = lambda: b'\xaa\xbb\xcc\xdd\xee\xff'
machine.freq       = lambda: 240_000_000
sys.modules["machine"] = machine

# ----- ujson -----------------------------------------------------------------
ujson = types.ModuleType("ujson")
ujson.dumps = json.dumps
ujson.loads = json.loads
sys.modules["ujson"] = ujson

# ----- uos -------------------------------------------------------------------
uos = types.ModuleType("uos")
# statvfs returns (block_size, _, total, free, ...)
uos.statvfs = lambda path: (4096, 0, 1024, 512, 0, 0, 0, 0)
sys.modules["uos"] = uos

# ----- ubinascii -------------------------------------------------------------
import binascii as _bin
ubinascii = types.ModuleType("ubinascii")
ubinascii.hexlify = _bin.hexlify
sys.modules["ubinascii"] = ubinascii

# ----- network (WiFi stub, reports connected) --------------------------------
network = types.ModuleType("network")
network.STA_IF = 0
class _WLAN:
    def __init__(self, iface): pass
    def isconnected(self): return True
    def ifconfig(self): return ("192.168.1.99", "255.255.255.0", "192.168.1.1", "8.8.8.8")
    def config(self, key):
        return b'\xaa\xbb\xcc\xdd\xee\xff' if key == "mac" else "MockSSID"
    def status(self, key): return -55  # RSSI
network.WLAN = _WLAN
sys.modules["network"] = network

# ----- neopixel --------------------------------------------------------------
neopixel = types.ModuleType("neopixel")
class _NeoPixel:
    def __init__(self, pin, n): self._data = [(0,0,0)] * n
    def __setitem__(self, i, v): self._data[i] = v
    def write(self): pass
neopixel.NeoPixel = _NeoPixel
sys.modules["neopixel"] = neopixel

# ----- urequests (not used during test) -------------------------------------
urequests = types.ModuleType("urequests")
sys.modules["urequests"] = urequests

# ── 2. Point the import path at the MicroPython client directory ──────────────

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
MICROPYTHON_DIR = REPO_ROOT / "clients" / "micropython"
sys.path.insert(0, str(MICROPYTHON_DIR))

# ── 3. Run the shim ───────────────────────────────────────────────────────────

import cep as cep_module   # the real MicroPython cep.py

doc = cep_module.getCapabilitiesJSON(
    i2c_buses=[(0, 21, 22)],
    neopixel_candidates=[5],
)

# ── 4. Validate the output ────────────────────────────────────────────────────

passed = failed = 0

def check(label, condition, detail=""):
    global passed, failed
    if condition:
        print(f"  ✓ {label}")
        passed += 1
    else:
        print(f"  ✗ {label}{' — ' + detail if detail else ''}")
        failed += 1

print("\nCEP Desktop Shim Test (MicroPython mock)\n")

# Device block
check("device.id present",       bool(doc.get("device", {}).get("id")))
check("device.class = microcontroller", doc["device"]["class"] == "microcontroller")
check("device.transport present", bool(doc["device"].get("transport")))
check("device.firmware present",  bool(doc["device"].get("firmware")))

caps = doc.get("capabilities", [])
types_found = [c["type"] for c in caps]

check("capabilities is list",    isinstance(caps, list))
check("compute present",         "compute" in types_found)
check("i2c present",             "i2c" in types_found)
check("sensor present",          "sensor" in types_found, f"types: {types_found}")
check("storage present",         "storage" in types_found)
check("network present",         "network" in types_found)

# I2C scan results
i2c_cap = next((c for c in caps if c["type"] == "i2c"), None)
if i2c_cap:
    found = i2c_cap["buses"][0]["devices_found"]
    check("I2C found 0x76 (BME280)",   "0x76" in found, str(found))
    check("I2C found 0x3c (SSD1306)",  "0x3c" in found, str(found))

# Sensor caps from chipset plugins
sensors = [c for c in caps if c["type"] == "sensor"]
sensor_names = [s["chipset"] for s in sensors]
check("BME280 plugin detected",   "bme280" in sensor_names, str(sensor_names))

display_caps = [c for c in caps if c["type"] == "display"]
check("SSD1306 display detected", any(d.get("chipset") == "ssd1306" for d in display_caps),
      str(display_caps))

# Compute
compute = next((c for c in caps if c["type"] == "compute"), {})
check("compute.mhz = 240",        compute.get("mhz") == 240, str(compute.get("mhz")))

# Network
net = next((c for c in caps if c["type"] == "network"), None)
check("network.interfaces present", bool(net and net.get("interfaces")))
if net:
    iface = net["interfaces"][0]
    check("WiFi SSID present",    bool(iface.get("ssid")), str(iface))
    check("IP present",           bool(iface.get("ip")),   str(iface))

# JSON serialisability
try:
    serialised = json.dumps(doc, indent=2)
    check("document is JSON-serialisable", True)
    print(f"\n--- Produced document ({len(serialised)} bytes) ---")
    print(serialised)
except Exception as e:
    check("document is JSON-serialisable", False, str(e))

# ── Summary ───────────────────────────────────────────────────────────────────
print(f"\n{'─'*40}")
print(f"Passed: {passed}   Failed: {failed}")
if failed:
    sys.exit(1)
