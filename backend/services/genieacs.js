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
      'Device.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress',
      'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress',
      'Device.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress',
      'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress',
      // Optical Power
      'VirtualParameters.RXPower', 'VirtualParameters.TXPower',
      'Device.Optical.Interface.1.Stats.OpticalSignalLevel', 'Device.Optical.Interface.1.OpticalSignalLevel',
      'Device.Optical.Interface.1.Stats.TransmitOpticalLevel', 'Device.Optical.Interface.1.TransmitOpticalLevel',
      'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANEthernetLinkConfig.OpticalSignalLevel',
      // WiFi / SSID
      'Device.WiFi.SSID.1.SSID', 'Device.WiFi.SSID.2.SSID',
      'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID', 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.2.SSID',
      // Uptime
      'Device.DeviceInfo.UpTime', 'InternetGatewayDevice.DeviceInfo.UpTime',
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
async function fetchDevice(deviceId) {
  try {
    const encodedId = encodeURIComponent(deviceId);
    const response = await api.get(`/devices/${encodedId}`);
    return response.data;
  } catch (error) {
    console.error(`❌ GenieACS fetchDevice(${deviceId}) error:`, error.message);
    return null;
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

  // Aggressive Vendor Detection: Check Manufacturer, then Description, then even the Serial Prefix
  let vendor = get('Device.DeviceInfo.Manufacturer') || 
               get('InternetGatewayDevice.DeviceInfo.Manufacturer') || 
               get('Device.DeviceInfo.Description') || 
               get('InternetGatewayDevice.DeviceInfo.Description') || 
               get('_Manufacturer') || 'Unknown';
               
  // Standardize Vendor naming (Clean up weird strings like "HUAWEI TECHNOLOGIES CO., LTD")
  const vLower = vendor.toLowerCase();
  if (vLower.includes('huawei')) vendor = 'Huawei';
  else if (vLower.includes('zte')) vendor = 'ZTE';
  else if (vLower.includes('fiberhome')) vendor = 'Fiberhome';
  else if (vLower.includes('nokia')) vendor = 'Nokia';
  else if (vLower.includes('tplink') || vLower.includes('tp-link')) vendor = 'TP-Link';

  // Aggressive Model Detection
  let model = get('Device.DeviceInfo.ModelName') || 
              get('InternetGatewayDevice.DeviceInfo.ModelName') || 
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
                    get('Device.ManagementServer.ConnectionRequestURL')?.split('://')[1]?.split(':')[0] || null;

  // Multi-vendor RX/TX Power Detection (Huawei, ZTE, Fiberhome, etc.)
  const rxPowerValue = get('VirtualParameters.RXPower') || 
                       get('Device.Optical.Interface.1.Stats.OpticalSignalLevel') ||
                       get('InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANEthernetLinkConfig.OpticalSignalLevel') ||
                       get('Device.Optical.Interface.1.OpticalSignalLevel') || null;

  const txPowerValue = get('VirtualParameters.TXPower') || 
                       get('Device.Optical.Interface.1.Stats.TransmitOpticalLevel') ||
                       get('Device.Optical.Interface.1.TransmitOpticalLevel') || null;

  // Smart detection for SSID (Wi-Fi Name)
  let ssid = get('Device.WiFi.SSID.1.SSID') || 
             get('InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID') || 
             get('Device.WiFi.SSID.2.SSID') || 
             get('InternetGatewayDevice.LANDevice.1.WLANConfiguration.2.SSID') ||
             get('Device.DeviceInfo.ModelName') || 'N/A';

  // Super Aggressive SSID Cleaning: Remove any 2.4 / 5G / 2G etc plus whatever follows
  if (typeof ssid === 'string') {
    // This will catch _2.4G, -2.4G,  2.4G, _2G, _5G, _2.4GHz, etc., and remove the entire suffix
    ssid = ssid.replace(/[_\-\s]*(2\.4G|5G|2\.4GHz|5GHz|2G|GHz).*$/i, '').trim();
  }

  // Smart detection for Uptime
  const uptime = get('Device.DeviceInfo.UpTime') || 
                 get('InternetGatewayDevice.DeviceInfo.UpTime') || 
                 get('Device.ManagementServer.UpTime') ||
                 get('Device.DeviceInfo.ProcessStatus.Process.1.CPUTime') || 0;

  return {
    device_id: genieDevice._id,
    serial_number: serialNumber,
    name: ssid, 
    vendor: vendor,
    model: model,
    firmware: get('Device.DeviceInfo.SoftwareVersion') || get('InternetGatewayDevice.DeviceInfo.SoftwareVersion') || 'N/A',
    ip_address: ipAddress,
    rx_power: rxPowerValue,
    tx_power: txPowerValue,
    uptime: parseInt(uptime) || 0,
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
