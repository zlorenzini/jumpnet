/**
 * server/lib/cepRegistry.js
 *
 * In-memory registry of CEP device documents received via POST /devices/register.
 * Each entry is the full CEP JSON as defined in schemas/cep.schema.json.
 *
 * On JumpNet nodes with persistent storage, swap the Map for a JSON file or
 * SQLite (e.g. better-sqlite3) backing — the API surface stays the same.
 */

/**
 * @typedef {Object} CepDevice
 * @property {object}   device        — device identity block
 * @property {object[]} capabilities  — capability array
 * @property {string}   _registeredAt — ISO timestamp of registration
 * @property {string}   _ip           — originating IP if available
 */

/** @type {Map<string, CepDevice>} keyed by device.id */
const _registry = new Map();

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Register or update a device's capability document.
 *
 * @param {object} doc    — CEP document (must have doc.device.id)
 * @param {string} [ip]   — originating IP address
 * @returns {CepDevice}   — stored entry
 */
export function registerDevice(doc, ip = null) {
  if (!doc?.device?.id) {
    throw new Error('CEP document missing device.id');
  }
  const entry = {
    ...doc,
    _registeredAt: new Date().toISOString(),
    _ip:           ip,
  };
  _registry.set(doc.device.id, entry);
  return entry;
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * List all registered devices, optionally filtered by capability type.
 *
 * @param {string} [capType]  — e.g. "sensor", "neopixel", "compute"
 * @returns {CepDevice[]}
 */
export function listDevices(capType = null) {
  const all = [..._registry.values()];
  if (!capType) return all;
  return all.filter(d =>
    d.capabilities?.some(c => c.type === capType)
  );
}

/**
 * Get a single device by ID.
 *
 * @param {string} id
 * @returns {CepDevice|null}
 */
export function getDevice(id) {
  return _registry.get(id) ?? null;
}

/**
 * Remove a device from the registry.
 *
 * @param {string} id
 * @returns {boolean}
 */
export function removeDevice(id) {
  return _registry.delete(id);
}

/**
 * Find all devices that provide a specific sensor measurement.
 * e.g. findByProvides("temperature") → devices with a BME280
 *
 * @param {string} measurement
 * @returns {CepDevice[]}
 */
export function findByProvides(measurement) {
  return [..._registry.values()].filter(d =>
    d.capabilities?.some(c =>
      Array.isArray(c.provides) && c.provides.includes(measurement)
    )
  );
}

/**
 * Summarise registry contents for the /devices endpoint.
 */
export function summary() {
  return {
    count:   _registry.size,
    devices: [..._registry.values()].map(d => ({
      id:           d.device.id,
      class:        d.device.class,
      model:        d.device.model ?? null,
      transport:    d.device.transport,
      capabilities: d.capabilities?.map(c => c.type) ?? [],
      registeredAt: d._registeredAt,
      ip:           d._ip,
    })),
  };
}
