const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DB_PATH = process.env.DB_PATH || './db/msnetwork.db';
const absolutePath = path.resolve(__dirname, '..', DB_PATH);

const fs = require('fs');
const dir = path.dirname(absolutePath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(absolutePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  -- CLEAN UP: Hapus data contoh setiap kali aplikasi startup
  DELETE FROM devices;
  DELETE FROM olt;
  DELETE FROM vendors;

  CREATE TABLE IF NOT EXISTS odc (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    olt_name TEXT,
    capacity INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS odp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    odc_id INTEGER,
    capacity INTEGER DEFAULT 8,
    used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (odc_id) REFERENCES odc(id)
  );

  CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    serial_number TEXT UNIQUE NOT NULL,
    name TEXT,
    model TEXT,
    vendor TEXT,
    status TEXT DEFAULT 'offline',
    ip_address TEXT,
    mac_address TEXT,
    firmware TEXT,
    rx_power REAL,
    tx_power REAL,
    temperature REAL,
    uptime INTEGER,
    lat REAL,
    lng REAL,
    odp_id INTEGER,
    last_seen DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (odp_id) REFERENCES odp(id)
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    serial_number TEXT,
    lat REAL,
    lng REAL,
    odp_id INTEGER,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (odp_id) REFERENCES odp(id)
  );

  CREATE TABLE IF NOT EXISTS cables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_type TEXT NOT NULL,
    from_id INTEGER NOT NULL,
    to_type TEXT NOT NULL,
    to_id INTEGER NOT NULL,
    cable_type TEXT DEFAULT 'backbone',
    status TEXT DEFAULT 'active',
    waypoints TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT DEFAULT 'info',
    resolved INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(id)
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    wifi_security TEXT DEFAULT 'WPA2-PSK',
    encryption TEXT DEFAULT 'AES',
    auth_mode TEXT DEFAULT 'WPA2PSK',
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'viewer',
    status TEXT DEFAULT 'active',
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS olt (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    ip_address TEXT,
    vendor TEXT,
    model TEXT,
    ports INTEGER DEFAULT 16,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS virtual_params (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    script TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Add pppoe_username column if not exists
try { db.exec('ALTER TABLE devices ADD COLUMN pppoe_username TEXT'); } catch (e) { /* column already exists */ }
try { db.exec("ALTER TABLE cables ADD COLUMN waypoints TEXT DEFAULT '[]'"); } catch (e) { /* column already exists */ }

// Create device_configs table for persisting WAN/SSID/User configs
db.exec(`
  CREATE TABLE IF NOT EXISTS device_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER NOT NULL,
    config_type TEXT NOT NULL,
    config_data TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(device_id, config_type)
  );
`);

// Seed default settings if empty
const settingsCount = db.prepare("SELECT COUNT(*) as c FROM app_settings").get().c;
if (settingsCount === 0) {
  const seedSettings = db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)");
  seedSettings.run('app_name', 'MSNetwork');
  seedSettings.run('genieacs_url', 'http://localhost:7557');
  seedSettings.run('poll_interval', '30');
  seedSettings.run('rx_power_warning', '-25');
  seedSettings.run('rx_power_critical', '-28');
}

// Seed Essential Admin User ONLY
const userCount = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
if (userCount === 0) {
  db.prepare("INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)")
    .run('admin', 'JNetwork', 'Administrator', 'admin');
}

module.exports = db;
