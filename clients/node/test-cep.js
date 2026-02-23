/**
 * clients/node/test-cep.js
 *
 * End-to-end test of all CEP /devices endpoints.
 * No hardware required — sends synthetic CEP documents.
 *
 * Usage:
 *   node clients/node/test-cep.js [http://localhost:4080]
 */

const BASE = process.argv[2] ?? 'http://localhost:4080';

// ── Synthetic CEP documents ────────────────────────────────────────────────────

const ESP32_DOC = {
  device: {
    id:        "aa:bb:cc:dd:ee:ff",
    class:     "microcontroller",
    transport: "network",
    model:     "ESP32-DevKitC",
    firmware:  "2.0.0",
  },
  capabilities: [
    { type: "compute", mhz: 240, ram_kb: 320, flash_kb: 4096 },
    {
      type: "i2c",
      buses: [{ id: 0, sda: 21, scl: 22, freq_hz: 100000,
                devices_found: ["0x76", "0x3c"] }]
    },
    { type: "sensor",  chipset: "bme280",  bus: "i2c", bus_id: 0,
      address: "0x76", provides: ["temperature", "humidity", "pressure"] },
    { type: "display", chipset: "ssd1306", bus: "i2c", bus_id: 0,
      address: "0x3c", width_px: 128, height_px: 64, color: false },
    { type: "neopixel", pin: 5, max_leds: 64 },
    { type: "adc",  pins: [32, 33, 34, 35], resolution: 12 },
    { type: "network", interfaces: [{ kind: "wifi", mac: "aa:bb:cc:dd:ee:ff",
                                      ip: "192.168.1.42", ssid: "TestNet" }] },
  ]
};

const PICO_DOC = {
  device: {
    id:        "e6614c311b876123",
    class:     "microcontroller",
    transport: "usb",
    model:     "Raspberry Pi Pico W",
    firmware:  "1.22.2",
  },
  capabilities: [
    { type: "compute", mhz: 133 },
    {
      type: "i2c",
      buses: [{ id: 0, sda: "GP4", scl: "GP5", freq_hz: 100000,
                devices_found: ["0x68"] }]
    },
    { type: "sensor", chipset: "mpu6050", bus: "i2c", bus_id: 0,
      address: "0x68", provides: ["acceleration", "gyroscope", "temperature"] },
    { type: "adc", pins: [0, 1, 2], resolution: 16 },
    { type: "network", interfaces: [{ kind: "wifi", mac: "28:cd:c1:00:11:22" }] },
  ]
};

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function req(method, path, body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(`${BASE}${path}`, opts);
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\nCEP /devices endpoint test  →  ${BASE}\n`);

  // 1. Register ESP32
  console.log('1. POST /devices/register (ESP32)');
  let r = await req('POST', '/devices/register', ESP32_DOC);
  assert('status 201',           r.status === 201);
  assert('status=registered',    r.body?.status === 'registered');
  assert('id echoed back',       r.body?.id === ESP32_DOC.device.id);

  // 2. Register Pico
  console.log('\n2. POST /devices/register (Pico W)');
  r = await req('POST', '/devices/register', PICO_DOC);
  assert('status 201',           r.status === 201);
  assert('id echoed back',       r.body?.id === PICO_DOC.device.id);

  // 3. List all
  console.log('\n3. GET /devices');
  r = await req('GET', '/devices');
  assert('status 200',           r.status === 200);
  assert('count = 2',            r.body?.count === 2);
  assert('devices array',        Array.isArray(r.body?.devices));

  // 4. Get single device
  console.log('\n4. GET /devices/:id');
  r = await req('GET', '/devices/' + encodeURIComponent(ESP32_DOC.device.id));
  assert('status 200',           r.status === 200);
  assert('correct id',           r.body?.device?.id === ESP32_DOC.device.id);
  assert('has capabilities',     Array.isArray(r.body?.capabilities));
  assert('has sensor cap',       r.body?.capabilities?.some(c => c.type === 'sensor'));

  // 5. 404 for unknown device
  console.log('\n5. GET /devices/no-such-device (should 404)');
  r = await req('GET', '/devices/no-such-device');
  assert('status 404',           r.status === 404);

  // 6. Query by capability type
  console.log('\n6. GET /devices/query/capability/neopixel');
  r = await req('GET', '/devices/query/capability/neopixel');
  assert('status 200',           r.status === 200);
  assert('count = 1',            r.body?.count === 1);
  assert('ESP32 returned',       r.body?.devices?.[0]?.device?.id === ESP32_DOC.device.id);

  // 7. Query by sensor measurement
  console.log('\n7. GET /devices/query/provides/temperature');
  r = await req('GET', '/devices/query/provides/temperature');
  assert('status 200',           r.status === 200);
  assert('count = 2',            r.body?.count === 2,
         `got ${r.body?.count}`);  // both BME280 and MPU-6050 provide temperature

  // 8. Query provides — exclusive measurement
  console.log('\n8. GET /devices/query/provides/pressure');
  r = await req('GET', '/devices/query/provides/pressure');
  assert('status 200',           r.status === 200);
  assert('count = 1 (BME280)',   r.body?.count === 1);

  // 9. Re-register same device (upsert)
  console.log('\n9. POST /devices/register (re-register ESP32 — upsert)');
  const updated = { ...ESP32_DOC, capabilities: [{ type: "compute", mhz: 240 }] };
  r = await req('POST', '/devices/register', updated);
  assert('status 201',           r.status === 201);
  r = await req('GET', '/devices');
  assert('still count 2',        r.body?.count === 2);   // not a phantom 3rd entry

  // 10. Delete device
  console.log('\n10. DELETE /devices/:id');
  r = await req('DELETE', '/devices/' + encodeURIComponent(PICO_DOC.device.id));
  assert('status 200',           r.status === 200);
  r = await req('GET', '/devices');
  assert('count = 1 after delete', r.body?.count === 1);

  // 11. Bad registration (no device.id)
  console.log('\n11. POST /devices/register with invalid body (should 400)');
  r = await req('POST', '/devices/register', { capabilities: [] });
  assert('status 400',           r.status === 400);

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Passed: ${passed}   Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error(err); process.exit(1); });
