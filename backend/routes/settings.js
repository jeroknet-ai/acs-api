const express = require('express');
const db = require('../db/database');

const router = express.Router();

// ============ APP SETTINGS ============

router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM app_settings').all();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/', (req, res) => {
  try {
    const del = db.prepare('DELETE FROM app_settings WHERE key = ?');
    const ins = db.prepare('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
    const transaction = db.transaction((entries) => {
      for (const [key, value] of Object.entries(entries)) {
        if (value === undefined || value === null) continue;
        del.run(key);
        ins.run(key, String(value));
      }
    });
    transaction(req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('Settings PUT error:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// ============ VENDORS ============

router.get('/vendors', (req, res) => {
  try {
    const vendors = db.prepare('SELECT * FROM vendors ORDER BY name').all();
    res.json(vendors);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

router.post('/vendors', (req, res) => {
  try {
    const { name, description, wifi_security, encryption, auth_mode } = req.body;
    const result = db.prepare('INSERT INTO vendors (name, description, wifi_security, encryption, auth_mode) VALUES (?, ?, ?, ?, ?)').run(name, description || '', wifi_security || 'WPA2-PSK', encryption || 'AES', auth_mode || 'WPA2PSK');
    res.json({ id: result.lastInsertRowid, success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add vendor' });
  }
});

router.put('/vendors/:id', (req, res) => {
  try {
    const { name, description, wifi_security, encryption, auth_mode, status } = req.body;
    db.prepare('UPDATE vendors SET name=?, description=?, wifi_security=?, encryption=?, auth_mode=?, status=? WHERE id=?').run(name, description, wifi_security, encryption, auth_mode, status, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update vendor' });
  }
});

router.delete('/vendors/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM vendors WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete vendor' });
  }
});

// ============ USERS ============

router.get('/users', (req, res) => {
  try {
    const users = db.prepare('SELECT id, username, full_name, role, status, last_login, created_at FROM users ORDER BY created_at').all();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/users', (req, res) => {
  try {
    const { username, password, full_name, role } = req.body;
    const result = db.prepare('INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)').run(username, password, full_name || '', role || 'viewer');
    res.json({ id: result.lastInsertRowid, success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add user' });
  }
});

router.put('/users/:id', (req, res) => {
  try {
    const { username, full_name, role, status, password } = req.body;
    if (password) {
      db.prepare('UPDATE users SET username=?, full_name=?, role=?, status=?, password=? WHERE id=?').run(username, full_name, role, status, password, req.params.id);
    } else {
      db.prepare('UPDATE users SET username=?, full_name=?, role=?, status=? WHERE id=?').run(username, full_name, role, status, req.params.id);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/users/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ============ VIRTUAL PARAMETERS ============

router.get('/virtual-params', (req, res) => {
  try {
    const params = db.prepare('SELECT * FROM virtual_params ORDER BY name').all();
    res.json(params);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch virtual params' });
  }
});

router.post('/virtual-params', (req, res) => {
  try {
    const { name, script, description } = req.body;
    const result = db.prepare('INSERT INTO virtual_params (name, script, description) VALUES (?, ?, ?)').run(name, script || '', description || '');
    res.json({ id: result.lastInsertRowid, success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add virtual param' });
  }
});

router.delete('/virtual-params/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM virtual_params WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete virtual param' });
  }
});

// ============ OLT CRUD ============

router.get('/olt', (req, res) => {
  try {
    const olts = db.prepare('SELECT * FROM olt ORDER BY name').all();
    res.json(olts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch OLTs' });
  }
});

router.post('/olt', (req, res) => {
  try {
    const { name, lat, lng, ip_address, vendor, model, ports } = req.body;
    const result = db.prepare('INSERT INTO olt (name, lat, lng, ip_address, vendor, model, ports) VALUES (?,?,?,?,?,?,?)').run(name, lat, lng, ip_address || null, vendor || null, model || null, ports || 16);
    res.json({ id: result.lastInsertRowid, success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add OLT' });
  }
});

router.put('/olt/:id', (req, res) => {
  try {
    const { name, lat, lng, notes } = req.body;
    db.prepare('UPDATE olt SET name=COALESCE(?,name), lat=COALESCE(?,lat), lng=COALESCE(?,lng) WHERE id=?').run(name || null, lat !== undefined ? lat : null, lng !== undefined ? lng : null, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update OLT' });
  }
});

router.delete('/olt/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM olt WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete OLT' });
  }
});

// ============ ODC CRUD ============

router.post('/odc', (req, res) => {
  try {
    const { name, lat, lng, olt_name, capacity } = req.body;
    const result = db.prepare('INSERT INTO odc (name, lat, lng, olt_name, capacity) VALUES (?,?,?,?,?)').run(name, lat, lng, olt_name || null, capacity || 256);
    res.json({ id: result.lastInsertRowid, success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add ODC' });
  }
});

router.put('/odc/:id', (req, res) => {
  try {
    const { name, lat, lng } = req.body;
    db.prepare('UPDATE odc SET name=COALESCE(?,name), lat=COALESCE(?,lat), lng=COALESCE(?,lng) WHERE id=?').run(name || null, lat !== undefined ? lat : null, lng !== undefined ? lng : null, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update ODC' });
  }
});

router.delete('/odc/:id', (req, res) => {
  try {
    db.transaction(() => {
      const odpIds = db.prepare('SELECT id FROM odp WHERE odc_id=?').all(req.params.id).map(r => r.id);
      for (const odpId of odpIds) {
        const devIds = db.prepare('SELECT id FROM devices WHERE odp_id=?').all(odpId).map(r => r.id);
        for (const devId of devIds) {
          db.prepare('DELETE FROM device_configs WHERE device_id=?').run(devId);
          db.prepare('DELETE FROM alerts WHERE device_id=?').run(devId);
        }
        db.prepare('DELETE FROM devices WHERE odp_id=?').run(odpId);
        db.prepare('DELETE FROM customers WHERE odp_id=?').run(odpId);
      }
      db.prepare('DELETE FROM odp WHERE odc_id=?').run(req.params.id);
      db.prepare('DELETE FROM odc WHERE id=?').run(req.params.id);
    })();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete ODC Error:', error);
    res.status(500).json({ error: 'Failed to delete ODC' });
  }
});

// ============ ODP CRUD ============

router.post('/odp', (req, res) => {
  try {
    const { name, lat, lng, odc_id, capacity } = req.body;
    const result = db.prepare('INSERT INTO odp (name, lat, lng, odc_id, capacity) VALUES (?,?,?,?,?)').run(name, lat, lng, odc_id || null, capacity || 8);
    res.json({ id: result.lastInsertRowid, success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add ODP' });
  }
});

router.put('/odp/:id', (req, res) => {
  try {
    const { name, lat, lng } = req.body;
    db.prepare('UPDATE odp SET name=COALESCE(?,name), lat=COALESCE(?,lat), lng=COALESCE(?,lng) WHERE id=?').run(name || null, lat !== undefined ? lat : null, lng !== undefined ? lng : null, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update ODP' });
  }
});

router.delete('/odp/:id', (req, res) => {
  try {
    db.transaction(() => {
      const devIds = db.prepare('SELECT id FROM devices WHERE odp_id=?').all(req.params.id).map(r => r.id);
      for (const devId of devIds) {
        db.prepare('DELETE FROM device_configs WHERE device_id=?').run(devId);
        db.prepare('DELETE FROM alerts WHERE device_id=?').run(devId);
      }
      db.prepare('DELETE FROM devices WHERE odp_id=?').run(req.params.id);
      db.prepare('DELETE FROM customers WHERE odp_id=?').run(req.params.id);
      db.prepare('DELETE FROM odp WHERE id=?').run(req.params.id);
    })();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete ODP Error:', error);
    res.status(500).json({ error: 'Failed to delete ODP' });
  }
});

// ============ CABLE CRUD ============

router.post('/cables', (req, res) => {
  try {
    const { from_type, from_id, to_type, to_id, cable_type, waypoints } = req.body;
    const result = db.prepare('INSERT INTO cables (from_type, from_id, to_type, to_id, cable_type, waypoints) VALUES (?,?,?,?,?,?)').run(from_type, from_id || null, to_type, to_id || null, cable_type || 'backbone', JSON.stringify(waypoints || []));
    res.json({ id: result.lastInsertRowid, success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add cable' });
  }
});

router.delete('/cables/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM cables WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete cable' });
  }
});

// ============ ONT/Device CRUD (for map) ============

router.post('/devices', (req, res) => {
  try {
    const { serial_number, name, model, vendor, lat, lng, odp_id } = req.body;
    const result = db.prepare('INSERT INTO devices (serial_number, name, model, vendor, lat, lng, odp_id, status) VALUES (?,?,?,?,?,?,?,?)').run(serial_number, name, model || null, vendor || null, lat, lng, odp_id || null, 'offline');
    res.json({ id: result.lastInsertRowid, success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add device' });
  }
});

router.put('/devices/:id', (req, res) => {
  try {
    const { name, lat, lng } = req.body;
    db.prepare('UPDATE devices SET name=COALESCE(?,name), lat=COALESCE(?,lat), lng=COALESCE(?,lng) WHERE id=?').run(name || null, lat !== undefined ? lat : null, lng !== undefined ? lng : null, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update device' });
  }
});

router.delete('/devices/:id', (req, res) => {
  try {
    db.transaction(() => {
      db.prepare('DELETE FROM device_configs WHERE device_id=?').run(req.params.id);
      db.prepare('DELETE FROM alerts WHERE device_id=?').run(req.params.id);
      db.prepare('DELETE FROM devices WHERE id=?').run(req.params.id);
    })();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete Device Error:', error);
    res.status(500).json({ error: 'Failed to delete device' });
  }
});

// ============ EXPORT / IMPORT ============

router.get('/export', (req, res) => {
  try {
    const data = {
      olt: db.prepare('SELECT * FROM olt').all(),
      odc: db.prepare('SELECT * FROM odc').all(),
      odp: db.prepare('SELECT * FROM odp').all(),
      devices: db.prepare('SELECT * FROM devices').all(),
      customers: db.prepare('SELECT * FROM customers').all(),
      cables: db.prepare('SELECT * FROM cables').all(),
      vendors: db.prepare('SELECT * FROM vendors').all(),
      settings: db.prepare('SELECT * FROM app_settings').all(),
    };
    res.setHeader('Content-Disposition', 'attachment; filename=msnetwork-export.json');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export' });
  }
});

router.post('/import', (req, res) => {
  try {
    const data = req.body;
    const transaction = db.transaction(() => {
      if (data.olt) {
        for (const item of data.olt) {
          db.prepare('INSERT OR REPLACE INTO olt (id, name, lat, lng, ip_address, vendor, model, ports, status) VALUES (?,?,?,?,?,?,?,?,?)').run(item.id, item.name, item.lat, item.lng, item.ip_address, item.vendor, item.model, item.ports, item.status);
        }
      }
      if (data.odc) {
        for (const item of data.odc) {
          db.prepare('INSERT OR REPLACE INTO odc (id, name, lat, lng, olt_name, capacity) VALUES (?,?,?,?,?,?)').run(item.id, item.name, item.lat, item.lng, item.olt_name, item.capacity);
        }
      }
      if (data.odp) {
        for (const item of data.odp) {
          db.prepare('INSERT OR REPLACE INTO odp (id, name, lat, lng, odc_id, capacity, used) VALUES (?,?,?,?,?,?,?)').run(item.id, item.name, item.lat, item.lng, item.odc_id, item.capacity, item.used);
        }
      }
    });
    transaction();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to import' });
  }
});

module.exports = router;
