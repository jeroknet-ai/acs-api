const express = require('express');
const db = require('../db/database');
const genieacs = require('../services/genieacs');

const router = express.Router();

/**
 * GET /api/devices - List all devices
 */
router.get('/', (req, res) => {
  try {
    const { status, vendor, search, page = 1, limit = 50 } = req.query;
    let query = "SELECT d.*, o.name as odp_name FROM devices d LEFT JOIN odp o ON d.odp_id = o.id";
    const conditions = [];
    const params = [];

    if (status) {
      conditions.push('d.status = ?');
      params.push(status);
    }
    if (vendor) {
      conditions.push('d.vendor = ?');
      params.push(vendor);
    }
    if (search) {
      conditions.push(`(d.name LIKE ? OR d.serial_number LIKE ? OR d.model LIKE ? OR d.pppoe_username LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const countQuery = query.replace('SELECT d.*, o.name as odp_name', 'SELECT COUNT(DISTINCT d.id) as total');
    const total = db.prepare(countQuery).get(...params)?.total || 0;

    query += ` GROUP BY d.id ORDER BY d.last_seen DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const devices = db.prepare(query).all(...params);

    // Enrich devices with SSID name from saved configs
    const getConfig = db.prepare('SELECT config_data FROM device_configs WHERE device_id = ? AND config_type = ?');
    const enriched = devices.map(d => {
      const row = getConfig.get(d.id, 'ssid');
      let ssid_name = d.name;
      if (row) {
        try {
          const ssids = JSON.parse(row.config_data);
          if (ssids.length > 0 && ssids[0].ssid) ssid_name = ssids[0].ssid;
        } catch {}
      }
      return { ...d, ssid_name };
    });

    res.json({
      data: enriched,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

/**
 * GET /api/devices/stats - Device statistics
 */
router.get('/stats', (req, res) => {
  try {
    const stats = {
      total: db.prepare('SELECT COUNT(*) as count FROM devices').get().count,
      online: db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'online'").get().count,
      offline: db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'offline'").get().count,
      warning: db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'warning'").get().count,
    };

    const vendorStats = db.prepare(
      'SELECT vendor, COUNT(*) as count FROM devices GROUP BY vendor'
    ).all();

    const recentAlerts = db.prepare(
      'SELECT a.*, d.name as device_name, d.serial_number FROM alerts a LEFT JOIN devices d ON a.device_id = d.id ORDER BY a.created_at DESC LIMIT 10'
    ).all();

    // Hourly online/offline trend
    const hourlyTrend = [];
    for (let i = 23; i >= 0; i--) {
      const hour = new Date();
      hour.setHours(hour.getHours() - i);
      hourlyTrend.push({
        hour: hour.toISOString().slice(0, 13) + ':00',
        online: stats.online,
        offline: stats.offline,
      });
    }

    res.json({
      ...stats,
      vendorStats,
      recentAlerts,
      hourlyTrend,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/devices/:id - Device detail
 */
router.get('/:id', (req, res) => {
  try {
    const device = db.prepare(
      'SELECT d.*, o.name as odp_name FROM devices d LEFT JOIN odp o ON d.odp_id = o.id WHERE d.id = ?'
    ).get(req.params.id);

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const customer = db.prepare(
      'SELECT * FROM customers WHERE serial_number = ?'
    ).get(device.serial_number);

    res.json({ ...device, customer });
  } catch (error) {
    console.error('Error fetching device:', error);
    res.status(500).json({ error: 'Failed to fetch device' });
  }
});

/**
 * GET /api/devices/:id/trace - Trace ALL raw parameters from GenieACS
 */
router.get('/:id/trace', async (req, res) => {
  try {
    const device = db.prepare('SELECT serial_number, device_id FROM devices WHERE id = ?').get(req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found in SQLite', id: req.params.id });
    
    console.log(`🔍 DEBUG TRACE: id=${req.params.id} serial=${device.serial_number} device_id=${device.device_id}`);
    
    // Attempt 1: Using the provided ID
    let raw = await genieacs.fetchDevice(device.device_id || device.serial_number);
    
    // FINAL FALLBACK: Health check the API and list sample if failed
    if (!raw || raw.error || (Array.isArray(raw) && raw.length === 0)) {
       const health = await genieacs.healthCheck();
       const sample = await genieacs.fetchDevices({ limit: 10 });
       return res.json({ 
         error: 'DEVICE_NOT_FOUND_IN_GENIEACS', 
         health, 
         db_record: device,
         tip: 'Try /api/devices/debug/all to see all devices in GenieACS',
         sample_available_device_ids: sample.map(d => ({ id: d._id, sn: d.Device?.DeviceInfo?.SerialNumber?._value }))
       });
    }

    res.json(raw);
  } catch (err) {
    res.status(500).json({ error: 'TRACE_ROUTE_CRASH', message: err.message });
  }
});

/**
 * GET /api/devices/debug/all - List ALL devices raw from GenieACS
 */
router.get('/debug/all', async (req, res) => {
  try {
    const raw = await genieacs.fetchDevices();
    res.json(raw);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/devices/:id/reboot - Reboot device
 */
router.post('/:id/reboot', async (req, res) => {
  try {
    const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    await genieacs.rebootDevice(device.serial_number);
    res.json({ success: true, message: `Reboot command sent to ${device.name}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reboot device' });
  }
});

/**
 * POST /api/devices/:id/refresh - Refresh device parameters
 */
router.post('/:id/refresh', async (req, res) => {
  try {
    const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    await genieacs.refreshDevice(device.serial_number);
    res.json({ success: true, message: `Refresh command sent to ${device.name}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to refresh device' });
  }
});

/**
 * DELETE /api/devices/:id - Delete device
 */
router.delete('/:id', (req, res) => {
  try {
    db.transaction(() => {
      db.prepare('DELETE FROM device_configs WHERE device_id=?').run(req.params.id);
      db.prepare('DELETE FROM alerts WHERE device_id=?').run(req.params.id);
      db.prepare('DELETE FROM devices WHERE id=?').run(req.params.id);
    })();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete device' });
  }
});

/**
 * GET /api/devices/:id/config - Get device configs
 */
router.get('/:id/config', (req, res) => {
  try {
    const rows = db.prepare('SELECT config_type, config_data FROM device_configs WHERE device_id = ?').all(req.params.id);
    const result = {};
    for (const row of rows) {
      try { result[row.config_type] = JSON.parse(row.config_data); } catch { result[row.config_type] = []; }
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get config' });
  }
});

/**
 * POST /api/devices/:id/config - Save device config
 */
router.post('/:id/config', (req, res) => {
  try {
    const { type, data } = req.body;
    const deviceId = req.params.id;
    db.prepare('DELETE FROM device_configs WHERE device_id = ? AND config_type = ?').run(deviceId, type);
    db.prepare('INSERT INTO device_configs (device_id, config_type, config_data, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)').run(deviceId, type, JSON.stringify(data));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save config' });
  }
});

module.exports = router;
