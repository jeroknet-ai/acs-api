const db = require('./database');

console.log('🌱 Seeding database...');

// Clear existing data
db.exec(`
  DELETE FROM alerts;
  DELETE FROM cables;
  DELETE FROM customers;
  DELETE FROM devices;
  DELETE FROM odp;
  DELETE FROM odc;
`);

// ============================================
// Seed ODC (Optical Distribution Cabinet)
// Using coordinates around Jakarta area
// ============================================
const insertODC = db.prepare(`
  INSERT INTO odc (name, lat, lng, olt_name, capacity) VALUES (?, ?, ?, ?, ?)
`);

const odcData = [
  ['ODC-JKT-001', -6.2088, 106.8456, 'OLT-JAKARTA-01', 256],
  ['ODC-JKT-002', -6.2150, 106.8500, 'OLT-JAKARTA-01', 256],
  ['ODC-JKT-003', -6.2000, 106.8400, 'OLT-JAKARTA-02', 128],
];

const odcIds = [];
for (const odc of odcData) {
  const result = insertODC.run(...odc);
  odcIds.push(result.lastInsertRowid);
}

// ============================================
// Seed ODP (Optical Distribution Point)
// ============================================
const insertODP = db.prepare(`
  INSERT INTO odp (name, lat, lng, odc_id, capacity, used) VALUES (?, ?, ?, ?, ?, ?)
`);

const odpData = [
  // ODC-JKT-001 children
  ['ODP-JKT-FA01', -6.2100, 106.8470, odcIds[0], 8, 6],
  ['ODP-JKT-FA02', -6.2110, 106.8480, odcIds[0], 8, 5],
  ['ODP-JKT-FA03', -6.2095, 106.8440, odcIds[0], 16, 12],
  ['ODP-JKT-FA04', -6.2075, 106.8465, odcIds[0], 8, 8],
  // ODC-JKT-002 children
  ['ODP-JKT-FB01', -6.2160, 106.8510, odcIds[1], 8, 4],
  ['ODP-JKT-FB02', -6.2140, 106.8520, odcIds[1], 16, 10],
  ['ODP-JKT-FB03', -6.2155, 106.8490, odcIds[1], 8, 7],
  // ODC-JKT-003 children
  ['ODP-JKT-FC01', -6.2010, 106.8410, odcIds[2], 8, 3],
  ['ODP-JKT-FC02', -6.1990, 106.8390, odcIds[2], 8, 6],
  ['ODP-JKT-FC03', -6.2005, 106.8420, odcIds[2], 16, 9],
];

const odpIds = [];
for (const odp of odpData) {
  const result = insertODP.run(...odp);
  odpIds.push(result.lastInsertRowid);
}

// ============================================
// Seed Devices (ONT)
// ============================================
const insertDevice = db.prepare(`
  INSERT INTO devices (serial_number, name, model, vendor, status, ip_address, mac_address, firmware, rx_power, tx_power, temperature, uptime, lat, lng, odp_id, last_seen, pppoe_username)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const vendors = ['Huawei', 'ZTE', 'Fiberhome'];
const models = {
  Huawei: ['HG8245H5', 'HG8145V5', 'EG8145V5'],
  ZTE: ['F670L', 'F660', 'F680'],
  Fiberhome: ['AN5506-04-F', 'HG6245D', 'AN5506-02-B'],
};
const statuses = ['online', 'online', 'online', 'online', 'offline', 'warning'];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomMAC() {
  return 'XX:XX:XX:XX:XX:XX'.replace(/X/g, () =>
    '0123456789ABCDEF'.charAt(Math.floor(Math.random() * 16))
  );
}

function randomIP() {
  return `192.168.1.${Math.floor(Math.random() * 254) + 1}`;
}

const deviceIds = [];
let deviceIndex = 0;

for (let odpIdx = 0; odpIdx < odpIds.length; odpIdx++) {
  const odp = odpData[odpIdx];
  const used = odp[5]; // used count
  for (let i = 0; i < used; i++) {
    deviceIndex++;
    const vendor = randomItem(vendors);
    const model = randomItem(models[vendor]);
    const status = randomItem(statuses);
    const serial = `ALCL${String(deviceIndex).padStart(8, '0')}`;
    const name = `ONT-${String(deviceIndex).padStart(3, '0')}`;
    const latOffset = (Math.random() - 0.5) * 0.003;
    const lngOffset = (Math.random() - 0.5) * 0.003;

    const result = insertDevice.run(
      serial,
      name,
      model,
      vendor,
      status,
      status === 'offline' ? null : randomIP(),
      randomMAC(),
      `V${Math.floor(Math.random() * 5) + 1}.0.${Math.floor(Math.random() * 20)}`,
      status === 'offline' ? null : -(Math.random() * 15 + 10).toFixed(2),
      status === 'offline' ? null : (Math.random() * 3 + 1).toFixed(2),
      status === 'offline' ? null : Math.floor(Math.random() * 30 + 30),
      status === 'offline' ? 0 : Math.floor(Math.random() * 86400 * 30),
      odp[1] + latOffset,
      odp[2] + lngOffset,
      odpIds[odpIdx],
      status === 'offline' ? null : new Date().toISOString(),
      `pppoe${String(deviceIndex).padStart(3, '0')}@isp.net`
    );
    deviceIds.push(result.lastInsertRowid);
  }
}

// ============================================
// Seed Customers
// ============================================
const insertCustomer = db.prepare(`
  INSERT INTO customers (name, address, phone, serial_number, lat, lng, odp_id, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const firstNames = ['Budi', 'Siti', 'Ahmad', 'Dewi', 'Rudi', 'Ani', 'Joko', 'Rina', 'Hadi', 'Wati', 'Eko', 'Sri', 'Agus', 'Lina', 'Deni', 'Maya', 'Fajar', 'Nita', 'Yoga', 'Putri'];
const lastNames = ['Santoso', 'Wijaya', 'Rahayu', 'Pratama', 'Hidayat', 'Kusuma', 'Sari', 'Purnama', 'Setiawan', 'Lestari'];
const streets = ['Jl. Sudirman', 'Jl. Thamrin', 'Jl. Gatot Subroto', 'Jl. Rasuna Said', 'Jl. Kuningan', 'Jl. Casablanca', 'Jl. HR Muhammad', 'Jl. Merdeka'];

let custIndex = 0;
for (let odpIdx = 0; odpIdx < odpIds.length; odpIdx++) {
  const odp = odpData[odpIdx];
  const used = odp[5];
  for (let i = 0; i < used; i++) {
    const firstName = randomItem(firstNames);
    const lastName = randomItem(lastNames);
    const serial = `ALCL${String(custIndex + 1).padStart(8, '0')}`;

    insertCustomer.run(
      `${firstName} ${lastName}`,
      `${randomItem(streets)} No. ${Math.floor(Math.random() * 200) + 1}`,
      `08${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
      serial,
      odp[1] + (Math.random() - 0.5) * 0.003,
      odp[2] + (Math.random() - 0.5) * 0.003,
      odpIds[odpIdx],
      Math.random() > 0.1 ? 'active' : 'inactive'
    );
    custIndex++;
  }
}

// ============================================
// Seed Cables
// ============================================
const insertCable = db.prepare(`
  INSERT INTO cables (from_type, from_id, to_type, to_id, cable_type, status)
  VALUES (?, ?, ?, ?, ?, ?)
`);

// OLT -> ODC cables (backbone)
for (const odcId of odcIds) {
  insertCable.run('olt', 1, 'odc', odcId, 'backbone', 'active');
}

// ODC -> ODP cables (backbone)
for (let i = 0; i < odpData.length; i++) {
  const odcId = odpData[i][3]; // odc_id
  insertCable.run('odc', odcId, 'odp', odpIds[i], 'distribution', 'active');
}

// ODP -> Customer cables (drop)
let cableCustomerIndex = 0;
for (let odpIdx = 0; odpIdx < odpIds.length; odpIdx++) {
  const used = odpData[odpIdx][5];
  for (let i = 0; i < used; i++) {
    cableCustomerIndex++;
    insertCable.run('odp', odpIds[odpIdx], 'customer', cableCustomerIndex, 'drop', 'active');
  }
}

// ============================================
// Seed Alerts
// ============================================
const insertAlert = db.prepare(`
  INSERT INTO alerts (device_id, type, message, severity, resolved, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const alertTypes = [
  { type: 'power_loss', message: 'RX Power below threshold (-25dBm)', severity: 'critical' },
  { type: 'device_offline', message: 'Device went offline', severity: 'critical' },
  { type: 'high_temperature', message: 'Temperature above 60°C', severity: 'warning' },
  { type: 'firmware_outdated', message: 'Firmware update available', severity: 'info' },
  { type: 'signal_degradation', message: 'Signal quality degraded', severity: 'warning' },
];

for (let i = 0; i < 15; i++) {
  const alert = randomItem(alertTypes);
  const deviceId = randomItem(deviceIds);
  const hoursAgo = Math.floor(Math.random() * 72);
  const date = new Date(Date.now() - hoursAgo * 3600000);

  insertAlert.run(
    deviceId,
    alert.type,
    alert.message,
    alert.severity,
    Math.random() > 0.6 ? 1 : 0,
    date.toISOString()
  );
}

// Count results
const totalDevices = db.prepare('SELECT COUNT(*) as count FROM devices').get().count;
const totalCustomers = db.prepare('SELECT COUNT(*) as count FROM customers').get().count;
const totalODC = db.prepare('SELECT COUNT(*) as count FROM odc').get().count;
const totalODP = db.prepare('SELECT COUNT(*) as count FROM odp').get().count;
const totalCables = db.prepare('SELECT COUNT(*) as count FROM cables').get().count;
const totalAlerts = db.prepare('SELECT COUNT(*) as count FROM alerts').get().count;

console.log('✅ Seeding complete!');
console.log(`   ODC: ${totalODC}`);
console.log(`   ODP: ${totalODP}`);
console.log(`   Devices: ${totalDevices}`);
console.log(`   Customers: ${totalCustomers}`);
console.log(`   Cables: ${totalCables}`);
console.log(`   Alerts: ${totalAlerts}`);

db.close();
