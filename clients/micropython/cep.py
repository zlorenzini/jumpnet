"""
clients/micropython/cep.py

JumpNet Capability Enumeration Protocol — MicroPython shim.
Targets: ESP32, ESP32-S3, Raspberry Pi Pico W (any MicroPython board).

Usage:
    from cep import getCapabilitiesJSON
    import ujson
    print(ujson.dumps(getCapabilitiesJSON()))

To POST to JumpNet:
    from cep import register_with_jumpnet
    register_with_jumpnet("http://jumpnet-host:4080")
"""

import ujson
import machine
import sys
import time

# ── Soft imports (not all boards have every module) ────────────────────────────

def _try_import(name):
    try:
        return __import__(name)
    except ImportError:
        return None

network  = _try_import("network")
uos      = _try_import("uos")
ubinascii = _try_import("ubinascii")
urequests = _try_import("urequests")

# ── Chipset plugin registry ────────────────────────────────────────────────────
# Loaded lazily from the chipsets/ sub-directory.
# Each plugin is a module with a CHIPSET dict and an optional describe() fn.

_CHIPSET_PLUGINS = {}

def load_chipset_plugins():
    """
    Import every module in the chipsets/ package and register it by its
    CHIPSET['i2c_addresses'] list.  Silently skips modules that fail to load.
    """
    plugin_names = []
    try:
        from chipsets import PLUGIN_LIST  # chipsets/__init__.py exports this
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


# ── Device identity ────────────────────────────────────────────────────────────

def _device_id():
    try:
        uid = machine.unique_id()
        if ubinascii:
            return ubinascii.hexlify(uid).decode()
        return "".join("{:02x}".format(b) for b in uid)
    except Exception:
        return "unknown"


def _board_model():
    try:
        return sys.implementation._machine
    except Exception:
        try:
            return sys.platform
        except Exception:
            return "unknown"


def _firmware():
    try:
        v = sys.implementation.version
        return "{}.{}.{}".format(*v)
    except Exception:
        return "unknown"


# ── Capability detectors ───────────────────────────────────────────────────────

def detect_compute():
    cap = {"type": "compute"}
    try:
        cap["mhz"] = machine.freq() // 1_000_000
    except Exception:
        pass
    try:
        info = uos.statvfs("/")
        block_size  = info[0]
        total_blocks = info[2]
        cap["flash_kb"] = (block_size * total_blocks) // 1024
    except Exception:
        pass
    return cap


def scan_i2c(bus_configs=None):
    """
    Scan I2C buses.  bus_configs is a list of (bus_id, sda_pin, scl_pin).
    Defaults to common ESP32 pins if not supplied.
    Returns a list of capability dicts and a dict of {address: module} for
    chipset matching.
    """
    if bus_configs is None:
        bus_configs = [
            (0, 21, 22),   # ESP32 default I2C
        ]

    i2c_caps  = []
    found_map = {}   # addr_int -> found address set

    for bus_id, sda, scl in bus_configs:
        try:
            i2c = machine.I2C(bus_id, sda=machine.Pin(sda), scl=machine.Pin(scl), freq=100_000)
            addrs = i2c.scan()
            hex_addrs = ["0x{:02x}".format(a) for a in addrs]
            i2c_caps.append({
                "type":  "i2c",
                "buses": [{
                    "id":            bus_id,
                    "sda":           sda,
                    "scl":           scl,
                    "freq_hz":       100_000,
                    "devices_found": hex_addrs,
                }]
            })
            for a in addrs:
                found_map[a] = {"bus_id": bus_id, "address": "0x{:02x}".format(a)}
        except Exception:
            pass

    return i2c_caps, found_map


def detect_chipsets(found_map):
    """
    Cross-reference discovered I2C addresses against loaded chipset plugins.
    Returns a list of sensor capability dicts.
    """
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


def detect_network():
    """Return a network capability dict if a WiFi interface is available."""
    if not network:
        return None
    try:
        wlan = network.WLAN(network.STA_IF)
        ifconf = wlan.ifconfig() if wlan.isconnected() else ("0.0.0.0", "0.0.0.0", "0.0.0.0", "0.0.0.0")
        mac_bytes = wlan.config("mac")
        mac_str   = ":".join("{:02x}".format(b) for b in mac_bytes)

        iface = {
            "kind": "wifi",
            "mac":  mac_str,
        }
        if wlan.isconnected():
            iface["ip"]   = ifconf[0]
            iface["ssid"] = wlan.config("essid")
            try:
                iface["rssi_db"] = wlan.status("rssi")
            except Exception:
                pass

        return {"type": "network", "interfaces": [iface]}
    except Exception:
        return None


def detect_gpio(output_pins=None, input_pins=None):
    """Describe GPIO availability.  Pass explicit pin lists if known."""
    cap = {"type": "gpio"}
    if output_pins:
        cap["digital_out"] = output_pins
    if input_pins:
        cap["digital_in"] = input_pins
    return cap


def detect_adc(pins=None):
    """Probe ADC-capable pins (ESP32 ADC1 defaults if not provided)."""
    if pins is None:
        # ESP32 ADC1 channels
        pins = [32, 33, 34, 35, 36, 39]
    working = []
    for p in pins:
        try:
            adc = machine.ADC(machine.Pin(p))
            adc.read()   # will raise if pin not usable
            working.append(p)
        except Exception:
            pass
    if not working:
        return None
    return {"type": "adc", "pins": working, "resolution": 12}


def detect_neopixel(candidate_pins=None):
    """
    Try to identify a NeoPixel bus by sending a minimal pulse and checking
    if the operation succeeds.  Returns a capability dict or None.
    """
    if candidate_pins is None:
        candidate_pins = [5, 13, 27, 16]

    neopixel_mod = _try_import("neopixel")
    if not neopixel_mod:
        return None

    for pin_no in candidate_pins:
        try:
            np = neopixel_mod.NeoPixel(machine.Pin(pin_no), 1)
            np[0] = (0, 0, 0)
            np.write()
            # If we got here without exception, pin is wired for NeoPixel
            return {"type": "neopixel", "pin": pin_no, "max_leds": 64}
        except Exception:
            pass
    return None


def detect_storage():
    """Detect flash / SD storage."""
    caps = []
    try:
        stat = uos.statvfs("/")
        total_kb = (stat[0] * stat[2]) // 1024
        free_kb  = (stat[0] * stat[3]) // 1024
        caps.append({"type": "storage", "kind": "flash", "total_kb": total_kb, "free_kb": free_kb})
    except Exception:
        pass
    return caps


# ── Main public API ───────────────────────────────────────────────────────────

def getCapabilitiesJSON(
    i2c_buses=None,
    gpio_out=None,
    gpio_in=None,
    adc_pins=None,
    neopixel_candidates=None,
):
    """
    Build and return the full CEP capability document as a Python dict.

    Parameters let callers hint pin assignments for boards where
    auto-detection is ambiguous.

    Example:
        from cep import getCapabilitiesJSON
        import ujson
        print(ujson.dumps(getCapabilitiesJSON()))
    """
    load_chipset_plugins()

    capabilities = []

    # Compute
    capabilities.append(detect_compute())

    # I2C + chipset sensors
    i2c_caps, found_map = scan_i2c(i2c_buses)
    capabilities.extend(i2c_caps)
    capabilities.extend(detect_chipsets(found_map))

    # ADC
    adc_cap = detect_adc(adc_pins)
    if adc_cap:
        capabilities.append(adc_cap)

    # NeoPixel
    neo_cap = detect_neopixel(neopixel_candidates)
    if neo_cap:
        capabilities.append(neo_cap)

    # Storage
    capabilities.extend(detect_storage())

    # GPIO
    if gpio_out or gpio_in:
        capabilities.append(detect_gpio(gpio_out, gpio_in))

    # Network
    net_cap = detect_network()
    if net_cap:
        capabilities.append(net_cap)

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

def register_with_jumpnet(base_url, **kwargs):
    """
    POST this device's capability document to JumpNet.

    Usage:
        register_with_jumpnet("http://192.168.1.100:4080")
    """
    if not urequests:
        print("[CEP] urequests not available — cannot register automatically.")
        return False
    try:
        doc  = getCapabilitiesJSON(**kwargs)
        body = ujson.dumps(doc)
        resp = urequests.post(
            base_url.rstrip("/") + "/devices/register",
            headers={"Content-Type": "application/json"},
            data=body,
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
