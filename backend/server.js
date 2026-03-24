require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');

const db = require('./db/database');
const devicesRouter = require('./routes/devices');
const networkRouter = require('./routes/network');
const settingsRouter = require('./routes/settings');
const genieacs = require('./services/genieacs');

const PORT = process.env.PORT || 3001;
const POLL_INTERVAL = (parseInt(process.env.POLL_INTERVAL) || 30) * 1000;

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ──── DEFINITIVE CORE API ROUTES (Highest Priority) ────
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'JNetwork') {
    return res.json({ success: true, token: 'fake-jwt-token-for-jnetwork' });
  }
  res.status(401).json({ success: false, message: 'Username atau password salah' });
});

// ──── SUPER DEBUG BYPASS ────
app.get('/api/debug/all', async (req, res) => {
  try {
    const raw = await genieacs.fetchDevices();
    res.json(raw);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──── SUPER RAW BYPASS (Literal GenieACS Response) ────
app.get('/api/debug/super-raw', async (req, res) => {
  try {
    const axios = require('axios');
    const GENIEACS_URL = process.env.GENIEACS_API_URL || 'http://localhost:7557';
    const response = await axios.get(`${GENIEACS_URL}/devices`);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message, url: process.env.GENIEACS_API_URL });
  }
});

app.get('/api/debug/trace/:id', async (req, res) => {
  try {
    const device = db.prepare('SELECT serial_number, device_id FROM devices WHERE id = ?').get(req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not in DB', id: req.params.id });
    const raw = await genieacs.fetchDevice(device.device_id || device.serial_number);
    res.json(raw);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use('/api/devices', devicesRouter);
app.use('/api/network', networkRouter);
app.use('/api/settings', settingsRouter);

// Health check
app.get('/api/health', async (req, res) => {
  const genieStatus = await genieacs.healthCheck();
  const dbDevices = db.prepare('SELECT COUNT(*) as count FROM devices').get().count;

  res.json({
    status: 'running',
    timestamp: new Date().toISOString(),
    database: { devices: dbDevices },
    genieacs: genieStatus,
  });
});

// ==========================================
// WebSocket Real-time Updates
// ==========================================
let connectedClients = 0;

io.on('connection', (socket) => {
  connectedClients++;
  console.log(`🔌 Client connected (${connectedClients} total)`);
  // stats update...
  socket.on('disconnect', () => {
    connectedClients--;
  });
});

// ==========================================
// GenieACS Live Polling
// ==========================================
async function pollGenieACS() {
  try {
    const rawDevices = await genieacs.fetchDevices();
    const genieCount = rawDevices?.length || 0;
    console.log(`📡 Polling: GenieACS has ${genieCount} devices`);

    // DANGEROUS BUT NECESSARY: If GenieACS returns a valid list (even empty), 
    // we should sync our DB to match it exactly.
    if (!Array.isArray(rawDevices)) {
      console.log('⚠️ Polling: Invalid response from GenieACS, skipping sync');
      return;
    }

    // Nuke all existing devices to ensure we only show what's REAL in GenieACS right now
    // This removes the 119 "Ghost" devices that are causing blank columns.
    db.prepare('DELETE FROM devices').run();
    console.log('🧹 DB: Cleared stale devices for fresh sync');

    if (genieCount === 0) {
      io.emit('stats:update', { total: 0, online: 0, offline: 0, warning: 0 });
      return;
    }

    let syncedCount = 0;
    const insertStmt = db.prepare(`
      INSERT INTO devices (serial_number, name, vendor, model, firmware, ip_address, rx_power, tx_power, uptime, status, last_seen, device_id, lan_count, pppoe_user, wan_tx, wan_rx)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const raw of rawDevices) {
      const normalized = genieacs.normalizeDevice(raw);
      if (!normalized) continue;
      
      insertStmt.run(
        normalized.serial_number, normalized.name, normalized.vendor, normalized.model, normalized.firmware,
        normalized.ip_address, normalized.rx_power, normalized.tx_power, normalized.uptime, 'online', new Date().toISOString(), raw._id,
        normalized.lan_count, normalized.pppoe_user, normalized.wan_tx, normalized.wan_rx
      );
      syncedCount++;
    }

    const stats = {
      total: db.prepare('SELECT COUNT(*) as count FROM devices').get().count,
      online: db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'online'").get().count,
      offline: 0,
      warning: 0,
      // NEW: Aggregated Stats
      connected: db.prepare("SELECT SUM(lan_count) as total FROM devices").get().total || 0,
      users: db.prepare("SELECT COUNT(DISTINCT pppoe_user) as total FROM devices WHERE pppoe_user IS NOT NULL").get().total || 0,
      wan_traffic: db.prepare("SELECT SUM(wan_tx + wan_rx) as total FROM devices").get().total || 0
    };
    io.emit('stats:update', stats);
    io.emit('polling:success', { count: syncedCount });
    console.log(`✅ Polling: Successfully synced ${syncedCount}/${genieCount} devices`);
  } catch (error) {
    console.error('❌ Polling Error:', error.message);
  }
}
async function forcedInitialPoll() {
  console.log('🚀 SYSTEM: Starting initial heavy sync...');
  await pollGenieACS();
}
setInterval(pollGenieACS, POLL_INTERVAL);
forcedInitialPoll();

// ==========================================
// Serve Static Frontend (Fail-Proof)
// ==========================================
const distPath = path.join(__dirname, 'public');
if (fs.existsSync(path.join(distPath, 'index.html'))) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API_NOT_FOUND_CHECK_SERVER_JS' });
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Start Server
server.listen(PORT, () => {
  console.log(`🚀 Server: http://localhost:${PORT}`);
});
