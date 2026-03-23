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
      'Device.DeviceInfo.SerialNumber',
      'Device.DeviceInfo.Manufacturer',
      'Device.DeviceInfo.ModelName',
      'Device.DeviceInfo.SoftwareVersion',
      'Device.ManagementServer.ConnectionRequestURL',
      'Device.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress',
      'VirtualParameters.RXPower',
      'VirtualParameters.TXPower',
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
    return obj?._value ?? obj;
  };

  return {
    device_id: genieDevice._id,
    serial_number: get('Device.DeviceInfo.SerialNumber') || get('InternetGatewayDevice.DeviceInfo.SerialNumber') || 'N/A',
    vendor: get('Device.DeviceInfo.Manufacturer') || get('InternetGatewayDevice.DeviceInfo.Manufacturer') || 'Unknown',
    model: get('Device.DeviceInfo.ModelName') || get('InternetGatewayDevice.DeviceInfo.ModelName') || 'Unknown',
    firmware: get('Device.DeviceInfo.SoftwareVersion') || get('InternetGatewayDevice.DeviceInfo.SoftwareVersion') || 'N/A',
    ip_address: get('Device.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress') || null,
    rx_power: get('VirtualParameters.RXPower') || null,
    tx_power: get('VirtualParameters.TXPower') || null,
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
