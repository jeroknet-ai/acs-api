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
    // FORCE CLEAR: Hapus semua data lama sebelum mengambil data baru dari GenieACS
    db.prepare('DELETE FROM devices').run();

    const rawDevices = await genieacs.fetchDevices();
    const statusChanges = [];

    for (const raw of rawDevices) {
      const normalized = genieacs.normalizeDevice(raw);
      if (!normalized) continue;

      // Update or insert into database
      const existing = db.prepare('SELECT id, status FROM devices WHERE serial_number = ?').get(normalized.serial_number);
      
      const lastSeen = new Date().toISOString();
      const status = 'online'; // If it's in the list from GenieACS, it's generally considered online

      if (existing) {
        db.prepare(`
          UPDATE devices 
          SET status = ?, name = ?, vendor = ?, model = ?, ip_address = ?, rx_power = ?, tx_power = ?, uptime = ?, last_seen = ?
          WHERE id = ?
        `).run(status, normalized.name, normalized.vendor, normalized.model, normalized.ip_address, normalized.rx_power, normalized.tx_power, normalized.uptime, lastSeen, existing.id);
        
        if (existing.status !== status) {
          statusChanges.push({ id: existing.id, status });
        }
      } else {
        const result = db.prepare(`
          INSERT INTO devices (serial_number, name, vendor, model, firmware, ip_address, rx_power, tx_power, uptime, status, last_seen)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          normalized.serial_number, normalized.name, normalized.vendor, normalized.model, normalized.firmware,
          normalized.ip_address, normalized.rx_power, normalized.tx_power, normalized.uptime, status, lastSeen
        );
        statusChanges.push({ id: result.lastInsertRowid, status });
      }
    }

    // Broadcast updates
    const stats = {
      total: db.prepare('SELECT COUNT(*) as count FROM devices').get().count,
      online: db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'online'").get().count,
      offline: db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'offline'").get().count,
      warning: db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'warning'").get().count,
    };
    io.emit('stats:update', stats);
    if (statusChanges.length > 0) {
      io.emit('devices:statusChange', statusChanges);
    }
  } catch (error) {
    console.error('❌ GenieACS Polling Error:', error.message);
  }
}

// Start polling REAL data every POLL_INTERVAL (30s)
setInterval(pollGenieACS, POLL_INTERVAL);
// Also run once immediately
pollGenieACS();

// ==========================================
// Serve Static Frontend (Single Container / Docker Mode)
// ==========================================
// Try multiple paths to find the built frontend (Docker vs Local)
let distPath = path.join(__dirname, '../frontend/dist');
if (!fs.existsSync(distPath)) {
  distPath = path.join(__dirname, 'frontend/dist');
}

if (fs.existsSync(distPath)) {
  console.log(`📦 Serving static files from: ${distPath}`);
  app.use(express.static(distPath));
  // Catch-all for React Router
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.log('⚠️ Warning: Frontend dist folder not found.');
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
