const axios = require('axios');
require('dotenv').config();

const GENIEACS_URL = process.env.GENIEACS_API_URL || 'http://localhost:7557';
const GENIEACS_USER = process.env.GENIEACS_USER;
const GENIEACS_PASS = process.env.GENIEACS_PASS;

const axiosConfig = {
  baseURL: GENIEACS_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
};

// Add basic auth if credentials provided
if (GENIEACS_USER && GENIEACS_PASS) {
  axiosConfig.auth = {
    username: GENIEACS_USER,
    password: GENIEACS_PASS,
  };
}

const api = axios.create(axiosConfig);

/**
 * Fetch all devices from GenieACS
 */
async function fetchDevices(query = {}) {
  try {
    const projection = [
      'DeviceID',
      '_id',
      // Serial & Basic Info
      'Device.DeviceInfo.SerialNumber', 'InternetGatewayDevice.DeviceInfo.SerialNumber',
      'Device.DeviceInfo.Manufacturer', 'InternetGatewayDevice.DeviceInfo.Manufacturer',
      'Device.DeviceInfo.ManufacturerOUI',
      'Device.DeviceInfo.ModelName', 'InternetGatewayDevice.DeviceInfo.ModelName',
      'Device.DeviceInfo.ModelNumber', 'Device.DeviceInfo.Description',
      'Device.DeviceInfo.SoftwareVersion', 'InternetGatewayDevice.DeviceInfo.SoftwareVersion',
      // Network & IP
      'Device.ManagementServer.ConnectionRequestURL',
      'InternetGatewayDevice.ManagementServer.ConnectionRequestURL',
      'Device.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress',
      'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress',
      'Device.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress',
      'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress',
      // Optical Power
      'VirtualParameters.RXPower', 'VirtualParameters.TXPower',
      'Device.Optical.Interface.1.Stats.OpticalSignalLevel', 'Device.Optical.Interface.1.OpticalSignalLevel',
      'Device.Optical.Interface.1.Stats.TransmitOpticalLevel', 'Device.Optical.Interface.1.TransmitOpticalLevel',
      'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANEthernetLinkConfig.OpticalSignalLevel',
      'InternetGatewayDevice.Optical.Interface.1.Stats.OpticalSignalLevel',
      'InternetGatewayDevice.WANDevice.1.X_FH_GponInterfaceConfig.RXPower',
      'InternetGatewayDevice.WANDevice.1.X_FH_GponInterfaceConfig.TXPower',
      'Device.DeviceInfo.X_HUAWEI_OpticalSignalLevel',
      'Device.DeviceInfo.X_HUAWEI_TransmitOpticalLevel',
      // WiFi / SSID
      'Device.WiFi.SSID.1.SSID', 'Device.WiFi.SSID.2.SSID',
      'Device.WiFi.SSID.1.SSIDName',
      'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID', 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.2.SSID',
      'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.X_HUAWEI_SSIDName',
      'InternetGatewayDevice.LANDevice.1.WLANConfiguration.3.SSID', // Fiberhome 5G
      'InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.SSID', // Fiberhome 5G alt
      // Uptime
      'Device.DeviceInfo.UpTime', 'InternetGatewayDevice.DeviceInfo.UpTime',
      'Device.ManagementServer.UpTime',
      'Device.DeviceInfo.ProcessStatus.Process.1.CPUTime',
      'Tags',
    ].join(',');

    const response = await api.get('/devices', {
      params: {
        query: JSON.stringify(query),
        projection,
      },
    });
    return response.data;
  } catch (error) {
    console.error('❌ GenieACS fetchDevices error:', error.message);
    return [];
  }
}

/**
 * Get single device details
 */
async function fetchDevice(identifier) {
  try {
    const encodedId = encodeURIComponent(identifier);
    let response = await api.get(`/devices/${encodedId}`);
    
    // Fallback: If not found by ID, try querying by Serial Number
    if (!response.data || (Array.isArray(response.data) && response.data.length === 0)) {
       console.log(`🔍 Trace: ${identifier} not found, trying Serial Number query...`);
       const query = { "Device.DeviceInfo.SerialNumber": identifier };
       const fallbackRes = await api.get('/devices', { params: { query: JSON.stringify(query) } });
       if (fallbackRes.data && fallbackRes.data.length > 0) return fallbackRes.data[0];
       
       const query2 = { "InternetGatewayDevice.DeviceInfo.SerialNumber": identifier };
       const fallbackRes2 = await api.get('/devices', { params: { query: JSON.stringify(query2) } });
       if (fallbackRes2.data && fallbackRes2.data.length > 0) return fallbackRes2.data[0];
    }
    
    return response.data;
  } catch (error) {
    console.error(`❌ GenieACS fetchDevice(${identifier}) error:`, error.message);
    return { error: error.message, identifier };
  }
}

/**
 * Send a task to a device via GenieACS
 */
async function sendTask(deviceId, task) {
  try {
    const encodedId = encodeURIComponent(deviceId);
    const response = await api.post(`/devices/${encodedId}/tasks`, task, {
      params: { connection_request: '' },
    });
    return response.data;
  } catch (error) {
    console.error(`❌ GenieACS sendTask error:`, error.message);
    throw error;
  }
}

/**
 * Reboot a device
 */
async function rebootDevice(deviceId) {
  return sendTask(deviceId, { name: 'reboot' });
}

/**
 * Refresh device parameters
 */
async function refreshDevice(deviceId) {
  return sendTask(deviceId, {
    name: 'getParameterValues',
    parameterNames: ['Device', 'InternetGatewayDevice'],
  });
}

/**
 * Set parameter value on a device
 */
async function setParameter(deviceId, parameterName, value) {
  return sendTask(deviceId, {
    name: 'setParameterValues',
    parameterValues: [[parameterName, value, 'xsd:string']],
  });
}

/**
 * Check if GenieACS API is reachable
 */
async function healthCheck() {
  try {
    const response = await api.get('/devices', {
      params: { limit: 1 },
      timeout: 5000,
    });
    return { status: 'connected', deviceCount: response.data.length };
  } catch (error) {
    return { status: 'disconnected', error: error.message };
  }
}

/**
 * Map vendor-specific parameters to unified format
 */
function normalizeDevice(genieDevice) {
  if (!genieDevice) return null;

  const get = (path) => {
    const parts = path.split('.');
    let obj = genieDevice;
    for (const part of parts) {
      if (!obj || !obj[part]) return null;
      obj = obj[part];
    }
    // Return _value if exists, otherwise the text representation if available
    if (obj && typeof obj === 'object') {
      return obj._value !== undefined ? obj._value : (obj.toString() === '[object Object]' ? null : obj);
    }
    return obj;
  };

  // Smart detection for Serial Number (supports TR-069 and vendor-specific)
  const serialNumber = get('Device.DeviceInfo.SerialNumber') || 
                       get('InternetGatewayDevice.DeviceInfo.SerialNumber') || 
                       get('DeviceID.ID') || 
                       genieDevice._id || 'N/A';

  // Ultra-Aggressive Catch-all Vendor Detection
  const rawJson = JSON.stringify(genieDevice).toLowerCase();
  let vendor = 'Unknown';
  if (rawJson.includes('huawei')) vendor = 'Huawei';
  else if (rawJson.includes('zte')) vendor = 'ZTE';
  else if (rawJson.includes('fiberhome') || rawJson.includes('fh_')) vendor = 'Fiberhome';
  else if (rawJson.includes('nokia') || rawJson.includes('alcatel-lucent')) vendor = 'Nokia';
  else if (rawJson.includes('tplink') || rawJson.includes('tp-link')) vendor = 'TP-Link';
  else if (rawJson.includes('totolink')) vendor = 'TOTOLINK';
  else {
      // Fallback to literal Manufacturer field if exists
      const manufacturer = get('Device.DeviceInfo.Manufacturer') || 
                           get('InternetGatewayDevice.DeviceInfo.Manufacturer') || 
                           genieDevice._deviceId?._Manufacturer || '';
      if (manufacturer) vendor = manufacturer;
  }

  // Aggressive Model Detection
  let model = get('Device.DeviceInfo.ModelName') || 
              get('InternetGatewayDevice.DeviceInfo.ModelName') || 
              genieDevice._deviceId?._ProductClass ||
              get('Device.DeviceInfo.ModelNumber') ||
              get('Device.DeviceInfo.ModelDescription') ||
              get('Device.DeviceInfo.Description') || 
              get('InternetGatewayDevice.DeviceInfo.Description') ||
              get('_ModelName') || 'Unknown';
              
  // Clean model string if it repeats vendor name
  if (model.toLowerCase().startsWith(vendor.toLowerCase())) {
     model = model.substring(vendor.length).trim().replace(/^[-_]/, '').trim();
  }

  // Smart detection for IP Address
  const ipAddress = get('Device.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress') ||
                    get('InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress') ||
                    get('Device.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress') ||
                    get('InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress') ||
                    get('Device.ManagementServer.ConnectionRequestURL')?.split('://')[1]?.split(':')[0] || 
                    get('InternetGatewayDevice.ManagementServer.ConnectionRequestURL')?.split('://')[1]?.split(':')[0] || null;

  // Multi-vendor RX/TX Power Detection (Huawei, ZTE, Fiberhome, etc.)
  const rxPowerValue = get('VirtualParameters.RXPower') || 
                       get('InternetGatewayDevice.WANDevice.1.X_FH_GponInterfaceConfig.RXPower') ||
                       get('Device.Optical.Interface.1.Stats.OpticalSignalLevel') ||
                       get('InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANEthernetLinkConfig.OpticalSignalLevel') ||
                       get('Device.Optical.Interface.1.OpticalSignalLevel') ||
                       get('InternetGatewayDevice.Optical.Interface.1.Stats.OpticalSignalLevel') ||
                       get('Device.DeviceInfo.X_HUAWEI_OpticalSignalLevel') || null;

  const txPowerValue = get('VirtualParameters.TXPower') || 
                       get('InternetGatewayDevice.WANDevice.1.X_FH_GponInterfaceConfig.TXPower') ||
                       get('Device.Optical.Interface.1.Stats.TransmitOpticalLevel') ||
                       get('Device.Optical.Interface.1.OpticalSignalLevel') ||
                       get('InternetGatewayDevice.Optical.Interface.1.Stats.TransmitOpticalLevel') ||
                       get('Device.DeviceInfo.X_HUAWEI_TransmitOpticalLevel') || null;

  // Smart detection for SSID (Wi-Fi Name)
  let ssid = get('Device.WiFi.SSID.1.SSID') || 
             get('InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID') || 
             get('Device.WiFi.SSID.1.SSIDName') ||
             get('InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.X_HUAWEI_SSIDName') ||
             get('InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.SSID') || // FH 5G
             get('Device.WiFi.SSID.2.SSID') || 
             get('InternetGatewayDevice.LANDevice.1.WLANConfiguration.2.SSID') ||
             get('Device.DeviceInfo.ModelName') || 'N/A';

  // Super Aggressive SSID Cleaning: Remove any 2.4 / 5G / 2G etc plus whatever follows
  if (typeof ssid === 'string' && ssid !== 'N/A') {
    ssid = ssid.replace(/[_\-\s]*(2\.4G|5G|2\.4GHz|5GHz|2G|GHz|2\.4).*$/i, '').trim();
  }

  // Final fallback if name is still generic
  const finalName = (ssid === 'N/A' || !ssid) ? (model !== 'Unknown' ? model : serialNumber) : ssid;

  // Smart detection for Uptime
  const uptime = get('Device.DeviceInfo.UpTime') || 
                 get('InternetGatewayDevice.DeviceInfo.UpTime') || 
                 get('Device.ManagementServer.UpTime') ||
                 get('Device.DeviceInfo.ProcessStatus.Process.1.CPUTime') || 0;

  // LAN Device Count (Clients)
  const lanDeviceCount = (get('Device.Hosts.HostNumberOfEntries') || 
                          get('InternetGatewayDevice.LANDevice.1.Hosts.HostNumberOfEntries') || 0);

  // PPPoE User (Username) - Used for 'User' count
  const pppoeUser = get('Device.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username') ||
                    get('InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username') || null;

  // WAN Traffic (Bytes Sent/Received)
  const txBytes = get('Device.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Stats.EthernetBytesSent') ||
                  get('InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Stats.EthernetBytesSent') || 0;
  const rxBytes = get('Device.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Stats.EthernetBytesReceived') ||
                  get('InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Stats.EthernetBytesReceived') || 0;

  return {
    device_id: genieDevice._id,
    serial_number: serialNumber,
    name: finalName, 
    vendor: vendor,
    model: model,
    firmware: get('Device.DeviceInfo.SoftwareVersion') || get('InternetGatewayDevice.DeviceInfo.SoftwareVersion') || 'N/A',
    ip_address: ipAddress,
    rx_power: rxPowerValue,
    tx_power: txPowerValue,
    uptime: parseInt(uptime) || 0,
    lan_count: parseInt(lanDeviceCount) || 0,
    pppoe_user: pppoeUser,
    wan_tx: parseInt(txBytes) || 0,
    wan_rx: parseInt(rxBytes) || 0
  };
}

module.exports = {
  fetchDevices,
  fetchDevice,
  sendTask,
  rebootDevice,
  refreshDevice,
  setParameter,
  healthCheck,
  normalizeDevice,
};
