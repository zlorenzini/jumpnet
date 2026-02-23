/**
 * server/routes/devices.js
 *
 * REST API for CEP device registration and discovery.
 *
 * POST  /devices/register         — device submits its CEP document
 * GET   /devices                  — list all registered devices
 * GET   /devices/:id              — get full CEP document for one device
 * DELETE /devices/:id             — remove a device
 * GET   /devices/query/capability/:type    — filter by capability type
 * GET   /devices/query/provides/:measure   — filter by sensor measurement
 */

import { Router }         from 'express';
import {
  registerDevice,
  listDevices,
  getDevice,
  removeDevice,
  findByProvides,
  summary,
} from '../lib/cepRegistry.js';

const router = Router();

// ── POST /devices/register ───────────────────────────────────────────────────

router.post('/register', (req, res, next) => {
  try {
    const doc = req.body;

    if (!doc?.device?.id) {
      return res.status(400).json({ error: 'CEP document must include device.id' });
    }
    if (!Array.isArray(doc.capabilities)) {
      return res.status(400).json({ error: 'CEP document must include capabilities array' });
    }

    const ip    = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
               ?? req.socket.remoteAddress;
    const entry = registerDevice(doc, ip);

    console.log(`[CEP] Registered: ${doc.device.id}  (${doc.device.model ?? doc.device.class})`);

    res.status(201).json({
      status:       'registered',
      id:           doc.device.id,
      registeredAt: entry._registeredAt,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /devices ─────────────────────────────────────────────────────────────

router.get('/', (_req, res) => {
  res.json(summary());
});

// ── GET /devices/query/capability/:type ───────────────────────────────────────

router.get('/query/capability/:type', (req, res) => {
  const devices = listDevices(req.params.type);
  res.json({ count: devices.length, devices });
});

// ── GET /devices/query/provides/:measure ─────────────────────────────────────

router.get('/query/provides/:measure', (req, res) => {
  const devices = findByProvides(req.params.measure);
  res.json({ count: devices.length, devices });
});

// ── GET /devices/:id ──────────────────────────────────────────────────────────
// Note: keep parameterised routes after specific sub-paths above

router.get('/:id', (req, res) => {
  const device = getDevice(req.params.id);
  if (!device) {
    return res.status(404).json({ error: `Device '${req.params.id}' not found` });
  }
  res.json(device);
});

// ── DELETE /devices/:id ───────────────────────────────────────────────────────

router.delete('/:id', (req, res) => {
  const removed = removeDevice(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: `Device '${req.params.id}' not found` });
  }
  res.json({ status: 'removed', id: req.params.id });
});

export { router };
