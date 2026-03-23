import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Devices
export const getDevices = (params = {}) => api.get('/devices', { params });
export const getDeviceStats = () => api.get('/devices/stats');
export const getDevice = (id) => api.get(`/devices/${id}`);
export const rebootDevice = (id) => api.post(`/devices/${id}/reboot`);
export const refreshDevice = (id) => api.post(`/devices/${id}/refresh`);

// Network
export const getTopology = () => api.get('/network/topology');
export const getODCs = () => api.get('/network/odc');
export const getODPs = () => api.get('/network/odp');
export const getCustomers = (params = {}) => api.get('/network/customers', { params });

// Settings
export const getSettings = () => api.get('/settings');
export const saveSettings = (data) => api.put('/settings', data);
export const getVendors = () => api.get('/settings/vendors');
export const addVendor = (data) => api.post('/settings/vendors', data);
export const updateVendor = (id, data) => api.put(`/settings/vendors/${id}`, data);
export const deleteVendor = (id) => api.delete(`/settings/vendors/${id}`);
export const getUsers = () => api.get('/settings/users');
export const addUser = (data) => api.post('/settings/users', data);
export const updateUser = (id, data) => api.put(`/settings/users/${id}`, data);
export const deleteUser = (id) => api.delete(`/settings/users/${id}`);
export const getVirtualParams = () => api.get('/settings/virtual-params');
export const addVirtualParam = (data) => api.post('/settings/virtual-params', data);
export const deleteVirtualParam = (id) => api.delete(`/settings/virtual-params/${id}`);

// OLT
export const getOLTs = () => api.get('/settings/olt');
export const addOLT = (data) => api.post('/settings/olt', data);
export const deleteOLT = (id) => api.delete(`/settings/olt/${id}`);

// CRUD ODC/ODP/Cable/Device (for map)
export const addODC = (data) => api.post('/settings/odc', data);
export const deleteODC = (id) => api.delete(`/settings/odc/${id}`);
export const addODP = (data) => api.post('/settings/odp', data);
export const deleteODP = (id) => api.delete(`/settings/odp/${id}`);
export const addCable = (data) => api.post('/settings/cables', data);
export const deleteCable = (id) => api.delete(`/settings/cables/${id}`);
export const addDevice = (data) => api.post('/settings/devices', data);

// Export / Import
export const exportData = () => api.get('/settings/export');
export const importData = (data) => api.post('/settings/import', data);

// Health
export const getHealth = () => api.get('/health');
export const getGenieacsStatus = () => api.get('/genieacs/status');

export default api;
