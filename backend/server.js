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
// Periodic Status Simulation
// (In production, this would poll GenieACS)
// ==========================================
function simulateStatusUpdates() {
  // Randomly change some device statuses to simulate real-time changes
  const devices = db.prepare('SELECT id, status FROM devices').all();
  const statusChanges = [];

  for (const device of devices) {
    const roll = Math.random();
    let newStatus = device.status;

    if (roll < 0.02) {
      // 2% chance of status change
      if (device.status === 'online') {
        newStatus = Math.random() > 0.5 ? 'offline' : 'warning';
      } else {
        newStatus = 'online';
      }

      db.prepare('UPDATE devices SET status = ?, last_seen = ? WHERE id = ?').run(
        newStatus,
        newStatus === 'online' ? new Date().toISOString() : null,
        device.id
      );

      statusChanges.push({ id: device.id, status: newStatus });
    }
  }

  if (statusChanges.length > 0) {
    // Broadcast to all connected clients
    const stats = {
      total: db.prepare('SELECT COUNT(*) as count FROM devices').get().count,
      online: db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'online'").get().count,
      offline: db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'offline'").get().count,
      warning: db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'warning'").get().count,
    };

    io.emit('stats:update', stats);
    io.emit('devices:statusChange', statusChanges);
  }
}

// Start polling
setInterval(simulateStatusUpdates, POLL_INTERVAL);

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
