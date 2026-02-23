"""
clients/circuitpython/cep.py

JumpNet Capability Enumeration Protocol — CircuitPython shim.
Targets: Raspberry Pi Pico W, RP2040-based boards, Adafruit Feather M4.

CircuitPython differs from MicroPython:
  - Use board module to enumerate named pins
  - Use busio for I2C/SPI (not machine.I2C)
  - Use wifi (not network) for Pico W networking

Usage:
    from cep import getCapabilitiesJSON
    import json
    print(json.dumps(getCapabilitiesJSON()))
"""

import json
import time

# ── Soft imports ──────────────────────────────────────────────────────────────

def _try_import(name):
    try:
        return __import__(name)
    except (ImportError, NotImplementedError):
        return None

board       = _try_import("board")
busio       = _try_import("busio")
analogio    = _try_import("analogio")
microcontroller = _try_import("microcontroller")
storage     = _try_import("storage")
wifi        = _try_import("wifi")    # Pico W / ESP32-S2/S3 only
socketpool  = _try_import("socketpool")
adafruit_requests = _try_import("adafruit_requests")

# ── Chipset plugin registry ───────────────────────────────────────────────────
# Same model as MicroPython: each chipset has CHIPSET dict + describe()

_CHIPSET_PLUGINS = {}

def load_chipset_plugins():
    """Load chipset plugins from the chipsets/ sub-package."""
    plugin_names = []
    try:
        from chipsets import PLUGIN_LIST
        plugin_names = PLUGIN_LIST
    except Exception:
        pass

    for name in plugin_names:
        try:
            mod = __import__("chipsets." + name, globals(), locals(), [name], 0)
            chip = getattr(mod, "CHIPSET", None)
            if chip:
                for addr in chip.get("i2c_addresses", []):
                    _CHIPSET_PLUGINS[addr] = mod
        except Exception:
            pass


# ── Device identity ───────────────────────────────────────────────────────────

def _device_id():
    try:
        import binascii
        return binascii.hexlify(microcontroller.cpu.uid).decode()
    except Exception:
        return "unknown"


def _board_model():
    try:
        return board.board_id
    except Exception:
        return "unknown"


def _firmware():
    import sys
    try:
        v = sys.implementation.version
        return "{}.{}.{}".format(*v)
    except Exception:
        return "unknown"


# ── Capability detectors ─────────────────────────────────────────────────────

def detect_compute():
    cap = {"type": "compute"}
    try:
        cap["mhz"] = microcontroller.cpu.frequency // 1_000_000
    except Exception:
        pass
    try:
        cap["ram_kb"] = microcontroller.cpu.reset_reason.__class__.__name__ and None  # just a probe
    except Exception:
        pass
    return cap


def _named_pin(attr):
    """Safely get a named board pin number (not all boards expose a .id)."""
    try:
        return getattr(board, attr)
    except AttributeError:
        return None


def scan_i2c():
    """Scan I2C on board.SDA/SCL if available."""
    if not busio:
        return [], {}

    sda = _named_pin("SDA")
    scl = _named_pin("SCL")
    if sda is None or scl is None:
        return [], {}

    i2c_caps  = []
    found_map = {}

    try:
        i2c = busio.I2C(scl, sda, frequency=100_000)

        # Wait for lock
        while not i2c.try_lock():
            pass
        try:
            addrs = i2c.scan()
        finally:
            i2c.unlock()

        hex_addrs = ["0x{:02x}".format(a) for a in addrs]
        i2c_caps.append({
            "type":  "i2c",
            "buses": [{
                "id":            0,
                "sda":           str(sda),
                "scl":           str(scl),
                "freq_hz":       100_000,
                "devices_found": hex_addrs,
            }]
        })
        for a in addrs:
            found_map[a] = {"bus_id": 0, "address": "0x{:02x}".format(a)}
    except Exception:
        pass

    return i2c_caps, found_map


def detect_chipsets(found_map):
    sensors = []
    for addr_int, location in found_map.items():
        plugin = _CHIPSET_PLUGINS.get(addr_int)
        if plugin:
            try:
                cap = plugin.describe(location["bus_id"], addr_int)
            except AttributeError:
                chip = plugin.CHIPSET
                cap = {
                    "type":     "sensor",
                    "chipset":  chip["name"],
                    "bus":      "i2c",
                    "bus_id":   location["bus_id"],
                    "address":  location["address"],
                    "provides": chip.get("provides", []),
                }
            sensors.append(cap)
    return sensors


def detect_analog():
    """Report analog-capable pins the board advertises."""
    if not analogio:
        return None
    pins = []
    for attr in dir(board):
        if attr.startswith("A") and attr[1:].isdigit():
            pins.append(int(attr[1:]))
    if not pins:
        return None
    return {"type": "adc", "pins": sorted(pins), "resolution": 16}


def detect_network():
    """Detect WiFi on Pico W or similar."""
    if not wifi:
        return None
    try:
        iface = {"kind": "wifi"}
        try:
            iface["mac"] = str(wifi.radio.mac_address_ap).replace("bytearray", "")
        except Exception:
            pass
        if wifi.radio.ipv4_address:
            iface["ip"]   = str(wifi.radio.ipv4_address)
        if wifi.radio.ap_info:
            iface["ssid"]    = str(wifi.radio.ap_info.ssid)
            iface["rssi_db"] = wifi.radio.ap_info.rssi
        return {"type": "network", "interfaces": [iface]}
    except Exception:
        return None


def detect_storage():
    caps = []
    if not storage:
        return caps
    try:
        fs = storage.getmount("/")
        caps.append({"type": "storage", "kind": "flash", "label": fs.label})
    except Exception:
        pass
    return caps


def detect_neopixel():
    """Detect NeoPixel pin if the board exposes board.NEOPIXEL."""
    pin = _named_pin("NEOPIXEL")
    if pin is None:
        return None
    return {"type": "neopixel", "pin": str(pin), "max_leds": 64}


# ── Main public API ───────────────────────────────────────────────────────────

def getCapabilitiesJSON():
    """
    Build and return the full CEP capability document as a Python dict.

    Example:
        from cep import getCapabilitiesJSON
        import json
        print(json.dumps(getCapabilitiesJSON()))
    """
    load_chipset_plugins()

    capabilities = []

    capabilities.append(detect_compute())

    i2c_caps, found_map = scan_i2c()
    capabilities.extend(i2c_caps)
    capabilities.extend(detect_chipsets(found_map))

    adc_cap = detect_analog()
    if adc_cap:
        capabilities.append(adc_cap)

    neo = detect_neopixel()
    if neo:
        capabilities.append(neo)

    capabilities.extend(detect_storage())

    net_cap = detect_network()
    if net_cap:
        capabilities.append(net_cap)

    # GPIO — report named digital pins from board module
    gpio_pins = []
    if board:
        for attr in dir(board):
            if attr.startswith("D") and attr[1:].isdigit():
                gpio_pins.append(int(attr[1:]))
    if gpio_pins:
        capabilities.append({"type": "gpio", "pins": sorted(gpio_pins)})

    doc = {
        "device": {
            "id":         _device_id(),
            "class":      "microcontroller",
            "transport":  "network" if net_cap else "usb",
            "model":      _board_model(),
            "firmware":   _firmware(),
            "reportedAt": _iso_now(),
        },
        "capabilities": capabilities,
    }
    return doc


# ── Registration helper ───────────────────────────────────────────────────────

def register_with_jumpnet(base_url):
    """POST this device's CEP document to a JumpNet node."""
    if not wifi or not socketpool or not adafruit_requests:
        print("[CEP] WiFi/requests not available.")
        return False
    try:
        pool    = socketpool.SocketPool(wifi.radio)
        session = adafruit_requests.Session(pool)
        doc     = getCapabilitiesJSON()
        resp    = session.post(
            base_url.rstrip("/") + "/devices/register",
            headers={"Content-Type": "application/json"},
            json=doc,
        )
        ok = resp.status_code in (200, 201)
        resp.close()
        return ok
    except Exception as e:
        print("[CEP] Registration failed:", e)
        return False


# ── Helpers ───────────────────────────────────────────────────────────────────

def _iso_now():
    try:
        t = time.localtime()
        return "{:04d}-{:02d}-{:02d}T{:02d}:{:02d}:{:02d}Z".format(*t[:6])
    except Exception:
        return "1970-01-01T00:00:00Z"
