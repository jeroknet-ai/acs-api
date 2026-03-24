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

// API Routes
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'JNetwork') {
    return res.json({ success: true, token: 'fake-jwt-token-for-jnetwork' });
  }
  res.status(401).json({ success: false, message: 'Username atau password salah' });
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

// GenieACS proxy endpoint
app.get('/api/genieacs/status', async (req, res) => {
  const status = await genieacs.healthCheck();
  res.json(status);
});

// ==========================================
// WebSocket Real-time Updates
// ==========================================
let connectedClients = 0;

io.on('connection', (socket) => {
  connectedClients++;
  console.log(`🔌 Client connected (${connectedClients} total)`);

  // Send initial data
  const stats = {
    total: db.prepare('SELECT COUNT(*) as count FROM devices').get().count,
    online: db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'online'").get().count,
    offline: db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'offline'").get().count,
    warning: db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'warning'").get().count,
  };
  socket.emit('stats:update', stats);

  socket.on('disconnect', () => {
    connectedClients--;
    console.log(`🔌 Client disconnected (${connectedClients} total)`);
  });
});

// ==========================================
// GenieACS Live Polling
// ==========================================

/**
 * Poll real devices from GenieACS
 */
async function pollGenieACS() {
  try {
    const rawDevices = await genieacs.fetchDevices();
    if (!rawDevices || rawDevices.length === 0) {
      console.log('⚠️ Polling: No devices found in GenieACS');
      return;
    }

    const currentSerials = rawDevices.map(d => genieacs.normalizeDevice(d)?.serial_number).filter(Boolean);

    for (const raw of rawDevices) {
      const normalized = genieacs.normalizeDevice(raw);
      if (!normalized) continue;

      const lastSeen = new Date().toISOString();
      db.prepare(`
        INSERT INTO devices (serial_number, name, vendor, model, firmware, ip_address, rx_power, tx_power, uptime, status, last_seen)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(serial_number) DO UPDATE SET
          name=excluded.name, vendor=excluded.vendor, model=excluded.model, 
          firmware=excluded.firmware, ip_address=excluded.ip_address, 
          rx_power=excluded.rx_power, tx_power=excluded.tx_power, 
          uptime=excluded.uptime, status=excluded.status, last_seen=excluded.last_seen
      `).run(
        normalized.serial_number, normalized.name, normalized.vendor, normalized.model, normalized.firmware,
        normalized.ip_address, normalized.rx_power, normalized.tx_power, normalized.uptime, 'online', lastSeen
      );
    }

    if (currentSerials.length > 0) {
      const placeholders = currentSerials.map(() => '?').join(',');
      db.prepare(`DELETE FROM devices WHERE serial_number NOT IN (${placeholders})`).run(...currentSerials);
    }

    const stats = {
      total: db.prepare('SELECT COUNT(*) as count FROM devices').get().count,
      online: db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'online'").get().count,
      offline: db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'offline'").get().count,
      warning: db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'warning'").get().count,
    };
    io.emit('stats:update', stats);
    io.emit('polling:success', { count: rawDevices.length });
    console.log(`✅ Polling: Synced ${rawDevices.length} devices`);
  } catch (error) {
    console.error('❌ GenieACS Polling Error:', error.message);
  }
}

// Start polling REAL data every POLL_INTERVAL (30s)
setInterval(pollGenieACS, POLL_INTERVAL);
// Also run once immediately
pollGenieACS();

// ==========================================
// Diagnostic Endpoint (Check /public)
// ==========================================
app.get('/diag/public', (req, res) => {
  const distPath = path.join(__dirname, 'public');
  if (fs.existsSync(distPath)) {
    const files = fs.readdirSync(distPath);
    const assets = fs.existsSync(path.join(distPath, 'assets')) ? fs.readdirSync(path.join(distPath, 'assets')) : 'MISSING';
    res.json({ status: 'OK', path: distPath, files, assets });
  } else {
    res.json({ status: 'ERROR', path: distPath, message: 'Not Found' });
  }
});

// ==========================================
// Serve Static Frontend (Fail-Proof)
// ==========================================
const distPath = path.join(__dirname, 'public');

// ──── Debug Endpoints ────
app.get('/api/debug/genieacs', async (req, res) => {
  try {
    const raw = await genieacs.fetchDevices();
    res.json({ count: raw.length, last_update: new Date().toISOString(), data: raw });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/debug/db', (req, res) => {
  try {
    const devices = db.prepare('SELECT * FROM devices').all();
    res.json({ count: devices.length, devices });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──── Static Serving ────
if (fs.existsSync(path.join(distPath, 'index.html'))) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API Not Found' });
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.log('⚠️ Warning: Frontend public folder not found');
}


// ==========================================
// Start Server
// ==========================================
server.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║       MSNetwork Monitoring Backend       ║');
  console.log('  ╠══════════════════════════════════════════╣');
  console.log(`  ║  🚀 Server:    http://localhost:${PORT}      ║`);
  console.log(`  ║  📡 WebSocket: ws://localhost:${PORT}        ║`);
  console.log(`  ║  🔄 Polling:   Every ${POLL_INTERVAL / 1000}s              ║`);
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
});

module.exports = { app, server, io };
