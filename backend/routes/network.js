const express = require('express');
const db = require('../db/database');

const router = express.Router();

/**
 * GET /api/network/topology - Full network topology
 */
router.get('/topology', (req, res) => {
  try {
    const odcs = db.prepare('SELECT * FROM odc ORDER BY name').all();
    const odps = db.prepare('SELECT * FROM odp ORDER BY name').all();
    const customers = db.prepare('SELECT * FROM customers ORDER BY name').all();
    const devices = db.prepare('SELECT * FROM devices').all();
    const cables = db.prepare('SELECT * FROM cables').all();

    const olts = db.prepare('SELECT * FROM olt ORDER BY name').all();
    const primaryOlt = olts[0] || { id: 1, name: 'OLT-JAKARTA', lat: -6.2050, lng: 106.8430, type: 'olt' };

    // Build topology tree
    const topology = {
      olt: primaryOlt,
      allOlts: olts,
      allOdps: odps,
      allDevices: devices,
      odcs: odcs.map((odc) => ({
        ...odc,
        type: 'odc',
        odps: odps
          .filter((o) => o.odc_id === odc.id)
          .map((odp) => ({
            ...odp,
            type: 'odp',
            devices: devices.filter((d) => d.odp_id === odp.id),
            customers: customers.filter((c) => c.odp_id === odp.id),
          })),
      })),
      cables: cables.map((cable) => {
        // Resolve coordinates for cable endpoints
        let fromCoords = null;
        let toCoords = null;

        if (cable.from_type === 'olt') {
          const olt = olts.find(o => Number(o.id) === Number(cable.from_id)) || primaryOlt;
          fromCoords = { lat: olt.lat, lng: olt.lng };
        } else if (cable.from_type === 'odc') {
          const odc = odcs.find((o) => Number(o.id) === Number(cable.from_id));
          if (odc) fromCoords = { lat: odc.lat, lng: odc.lng };
        } else if (cable.from_type === 'odp') {
          const odp = odps.find((o) => Number(o.id) === Number(cable.from_id));
          if (odp) fromCoords = { lat: odp.lat, lng: odp.lng };
        } else if (cable.from_type === 'customer' || cable.from_type === 'devices') {
          const deviceMatch = devices.find((d) => Number(d.id) === Number(cable.from_id));
          const customerMatch = customers.find((c) => Number(c.id) === Number(cable.from_id));
          let target = (cable.from_type === 'devices') ? (deviceMatch || customerMatch) : (customerMatch || deviceMatch);
          if (target) fromCoords = { lat: target.lat, lng: target.lng };
        }

        if (cable.to_type === 'odc') {
          const odc = odcs.find((o) => Number(o.id) === Number(cable.to_id));
          if (odc) toCoords = { lat: odc.lat, lng: odc.lng };
        } else if (cable.to_type === 'odp') {
          const odp = odps.find((o) => Number(o.id) === Number(cable.to_id));
          if (odp) toCoords = { lat: odp.lat, lng: odp.lng };
        } else if (cable.to_type === 'customer' || cable.to_type === 'devices') {
          const deviceMatch = devices.find((d) => Number(d.id) === Number(cable.to_id));
          const customerMatch = customers.find((c) => Number(c.id) === Number(cable.to_id));
          
          // Prioritize by explicit type match
          let target = null;
          if (cable.to_type === 'devices') target = deviceMatch || customerMatch;
          else target = customerMatch || deviceMatch;
          
          if (target) toCoords = { lat: target.lat, lng: target.lng };
        }

        let parsedWaypoints = [];
        try { parsedWaypoints = JSON.parse(cable.waypoints) || []; } catch {}

        if (!fromCoords || !toCoords) {
          console.warn(`[Topology] Cable #${cable.id} mapping fail: From ${cable.from_type}#${cable.from_id} (${!!fromCoords}), To ${cable.to_type}#${cable.to_id} (${!!toCoords})`);
        } else {
          console.log(`[Topology] Cable #${cable.id} OK: From ${cable.from_type}#${cable.from_id}, To ${cable.to_type}#${cable.to_id}`);
        }

        return {
          ...cable,
          fromCoords,
          toCoords,
          waypoints: parsedWaypoints
        };
      }).filter((c) => c.fromCoords && c.toCoords),
    };

    res.json(topology);
  } catch (error) {
    console.error('Error fetching topology:', error);
    res.status(500).json({ error: 'Failed to fetch topology' });
  }
});

/**
 * GET /api/odc - List all ODC
 */
router.get('/odc', (req, res) => {
  try {
    const odcs = db.prepare(`
      SELECT o.*, 
        (SELECT COUNT(*) FROM odp WHERE odc_id = o.id) as odp_count,
        (SELECT COUNT(*) FROM devices d JOIN odp p ON d.odp_id = p.id WHERE p.odc_id = o.id) as device_count
      FROM odc o ORDER BY o.name
    `).all();
    res.json(odcs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ODCs' });
  }
});

/**
 * GET /api/odp - List all ODP
 */
router.get('/odp', (req, res) => {
  try {
    const odps = db.prepare(`
      SELECT o.*, c.name as odc_name,
        (SELECT COUNT(*) FROM devices WHERE odp_id = o.id) as device_count,
        (SELECT COUNT(*) FROM devices WHERE odp_id = o.id AND status = 'online') as online_count
      FROM odp o LEFT JOIN odc c ON o.odc_id = c.id ORDER BY o.name
    `).all();
    res.json(odps);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ODPs' });
  }
});

/**
 * GET /api/customers - List all customers
 */
router.get('/customers', (req, res) => {
  try {
    const { search, status, page = 1, limit = 50 } = req.query;
    let query = 'SELECT c.*, o.name as odp_name FROM customers c LEFT JOIN odp o ON c.odp_id = o.id';
    const conditions = [];
    const params = [];

    if (search) {
      conditions.push('(c.name LIKE ? OR c.serial_number LIKE ? OR c.address LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) {
      conditions.push('c.status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY c.name';

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const countQuery = query.replace('SELECT c.*, o.name as odp_name', 'SELECT COUNT(*) as total');
    const total = db.prepare(countQuery).get(...params)?.total || 0;

    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const customers = db.prepare(query).all(...params);

    res.json({
      data: customers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

module.exports = router;
