import { useState, useEffect } from 'react';
import {
  Search, RefreshCw, Power, Eye, ChevronLeft, ChevronRight,
  Wifi, Users, Globe, Shield, X, Trash2, Plus, Save, Signal
} from 'lucide-react';
import { getDevices, rebootDevice, refreshDevice } from '../services/api';
import api from '../services/api';

// ──── Helpers ────
function cleanName(name) {
  if (!name || typeof name !== 'string') return '-';
  // Deep clean SSID: remove common suffixes _2.4G, -5G, etc
  return name.replace(/[_\-\s]*(2\.4|5|2)G(Hz)?.*$/i, '').trim();
}

// ──── Device Detail Modal ────
function DeviceDetailModal({ device, onClose, onSave }) {
  const [tab, setTab] = useState('info');
  const [loading, setLoading] = useState(true);

  // Default configs (used if nothing saved yet)
  const defaultWan = [
    { id: 1, mode: 'PPPoE', username: 'user@isp.net', vlan: '100', ip: '100.64.1.15', gateway: '10.0.0.1', dns1: '8.8.8.8', dns2: '8.8.4.4', mtu: '1492', nat: 'Enabled' },
  ];
  const defaultSsid = [
    { id: 1, ssid: `${device?.name || 'WiFi'}`, band: '2.4 GHz', security: 'WPA2-PSK', channel: 'Auto', width: '20/40 MHz', password: 'password123', enabled: true },
    { id: 2, ssid: `${device?.name || 'WiFi'}`, band: '5 GHz', security: 'WPA2-PSK', channel: 'Auto', width: '80 MHz', password: 'password123', enabled: true },
  ];
  const defaultUsers = [
    { id: 1, username: 'admin', password: 'password123', role: 'Administrator', access: 'Full', status: 'active' },
    { id: 2, username: 'user', password: 'user123', role: 'User', access: 'Limited', status: 'active' },
  ];

  const [wanList, setWanList] = useState(defaultWan);
  const [ssidList, setSsidList] = useState(defaultSsid);
  const [userList, setUserList] = useState(defaultUsers);
  const [connectedDevices] = useState([
    { hostname: 'iPhone-Budi', mac: 'AA:BB:CC:11:22:33', ip: '192.168.1.101', type: 'Phone', rssi: '-45 dBm' },
    { hostname: 'Laptop-Siti', mac: 'DD:EE:FF:44:55:66', ip: '192.168.1.102', type: 'Laptop', rssi: '-52 dBm' },
    { hostname: 'SmartTV-LG', mac: '11:22:33:AA:BB:CC', ip: '192.168.1.103', type: 'TV', rssi: '-60 dBm' },
  ]);
  const [showAddWan, setShowAddWan] = useState(false);
  const [newWan, setNewWan] = useState({ mode: 'PPPoE', username: '', vlan: '', mtu: '1492' });
  const [saveMsg, setSaveMsg] = useState('');

  // Load saved configs from backend
  useEffect(() => {
    if (!device?.id) return;
    setLoading(true);
    api.get(`/devices/${device.id}/config`)
      .then(res => {
        const cfg = res.data;
        if (cfg.wan && cfg.wan.length > 0) setWanList(cfg.wan);
        if (cfg.ssid && cfg.ssid.length > 0) setSsidList(cfg.ssid);
        if (cfg.users && cfg.users.length > 0) setUserList(cfg.users);
      })
      .catch(() => { /* use defaults */ })
      .finally(() => setLoading(false));
  }, [device?.id]);

  function showSaved(msg) { setSaveMsg(msg); setTimeout(() => setSaveMsg(''), 2000); }

  function updateSsid(id, field, val) {

    setSsidList(prev => prev.map(s => s.id === id ? { ...s, [field]: val } : s));
  }

  function updateUser(id, field, val) {
    setUserList(prev => prev.map(u => u.id === id ? { ...u, [field]: val } : u));
  }

  function updateWan(id, field, val) {
    setWanList(prev => prev.map(w => w.id === id ? { ...w, [field]: val } : w));
  }

  function addWan() {
    setWanList(prev => [...prev, { id: Date.now(), ...newWan, ip: '-', gateway: '-', dns1: '8.8.8.8', dns2: '8.8.4.4', nat: 'Enabled' }]);
    setShowAddWan(false);
    setNewWan({ mode: 'PPPoE', username: '', vlan: '', mtu: '1492' });
  }

  const tabs = [
    { id: 'info', label: 'Info', icon: Eye },
    { id: 'connected', label: 'Connected', icon: Users },
    { id: 'wan', label: 'WAN', icon: Globe },
    { id: 'ssid', label: 'SSID', icon: Wifi },
    { id: 'users', label: 'Users', icon: Shield },
  ];

  return (
    <div className="modal-overlay">
      <div className="modal-content wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {cleanName(device.name)}
            <span className={`status-badge ${device.status}`}><span className="dot" />{device.status}</span>
          </h3>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="tabs">
          {tabs.map(t => (
            <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              <t.icon size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />{t.label}
            </button>
          ))}
        </div>

        {/* Info */}
        {tab === 'info' && (
          <div style={{ display: 'grid', gap: 6 }}>
            {[['Serial Number', device.serial_number], ['Vendor', device.vendor], ['Model', device.model], ['Firmware', device.firmware || '-'],
              ['IP Address', device.ip_address || '-'], ['MAC', device.mac_address || '-'],
              ['RX Power', device.rx_power ? `${device.rx_power} dBm` : '-'], ['TX Power', device.tx_power ? `${device.tx_power} dBm` : '-'],
              ['Temp', device.temperature ? `${device.temperature}°C` : '-'], ['Uptime', formatUptime(device.uptime)],
              ['ODP', device.odp_name || '-'], ['Last Seen', device.last_seen || '-'],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.83rem' }}>{l}</span>
                <span style={{ fontWeight: 500, fontSize: '0.83rem' }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        {/* Connected */}
        {tab === 'connected' && (
          <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 10 }}>{connectedDevices.length} devices terhubung</p>
            <table className="data-table">
              <thead><tr><th>Hostname</th><th>MAC</th><th>IP</th><th>Type</th><th>RSSI</th></tr></thead>
              <tbody>
                {connectedDevices.map((d, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{d.hostname}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{d.mac}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{d.ip}</td>
                    <td>{d.type}</td>
                    <td style={{ color: parseInt(d.rssi) > -50 ? 'var(--accent-green)' : 'var(--accent-orange)' }}>{d.rssi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* WAN — Editable + Add */}
        {tab === 'wan' && (
          <div>
            {wanList.map(w => (
              <div key={w.id} className="card" style={{ marginBottom: 10, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, color: 'var(--accent-blue)', fontSize: '0.88rem' }}>
                    <Globe size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />{w.mode}
                  </span>
                  <button className="btn-icon" style={{ width: 24, height: 24, color: 'var(--accent-red)' }} onClick={() => setWanList(prev => prev.filter(x => x.id !== w.id))}><Trash2 size={12} /></button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.82rem' }}>
                  {w.mode === 'PPPoE' && (
                    <div className="form-group" style={{ marginBottom: 4 }}>
                      <label style={{ fontSize: '0.72rem' }}>Username</label>
                      <input value={w.username} onChange={e => updateWan(w.id, 'username', e.target.value)} style={{ padding: '5px 8px', fontSize: '0.8rem', maxWidth: '100%' }} />
                    </div>
                  )}
                  <div className="form-group" style={{ marginBottom: 4 }}>
                    <label style={{ fontSize: '0.72rem' }}>VLAN ID</label>
                    <input value={w.vlan} onChange={e => updateWan(w.id, 'vlan', e.target.value)} style={{ padding: '5px 8px', fontSize: '0.8rem', maxWidth: '100%' }} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 4 }}>
                    <label style={{ fontSize: '0.72rem' }}>MTU</label>
                    <input value={w.mtu} onChange={e => updateWan(w.id, 'mtu', e.target.value)} style={{ padding: '5px 8px', fontSize: '0.8rem', maxWidth: '100%' }} />
                  </div>
                </div>
              </div>
            ))}

            {showAddWan ? (
              <div className="card" style={{ padding: 14, border: '1px dashed var(--accent-blue)' }}>
                <h4 style={{ fontSize: '0.88rem', marginBottom: 10 }}>Tambah WAN</h4>
                <div className="form-group" style={{ marginBottom: 8 }}><label style={{ fontSize: '0.72rem' }}>Mode</label>
                  <select value={newWan.mode} onChange={e => setNewWan({ ...newWan, mode: e.target.value })} style={{ padding: '5px 8px', fontSize: '0.8rem', maxWidth: '100%' }}>
                    <option value="PPPoE">PPPoE</option><option value="Bridge">Bridge</option>
                  </select>
                </div>
                {newWan.mode === 'PPPoE' && <div className="form-group" style={{ marginBottom: 8 }}><label style={{ fontSize: '0.72rem' }}>Username</label><input value={newWan.username} onChange={e => setNewWan({ ...newWan, username: e.target.value })} style={{ padding: '5px 8px', fontSize: '0.8rem', maxWidth: '100%' }} /></div>}
                <div className="form-group" style={{ marginBottom: 8 }}><label style={{ fontSize: '0.72rem' }}>VLAN</label><input value={newWan.vlan} onChange={e => setNewWan({ ...newWan, vlan: e.target.value })} style={{ padding: '5px 8px', fontSize: '0.8rem', maxWidth: '100%' }} /></div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-primary btn-sm" onClick={addWan}><Save size={12} /> Simpan</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowAddWan(false)}>Batal</button>
                </div>
              </div>
            ) : (
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddWan(true)} style={{ marginTop: 6 }}><Plus size={12} /> Tambah WAN</button>
            )}
            <div style={{ marginTop: 10, textAlign: 'right' }}>
              <button className="btn btn-primary btn-sm" onClick={async () => { try { await api.post(`/devices/${device.id}/config`, { type: 'wan', data: wanList }); showSaved('✓ WAN tersimpan'); if (onSave) onSave(); setTimeout(onClose, 800); } catch(e) { console.error(e); showSaved('✗ Gagal menyimpan'); } }}><Save size={12} /> Simpan WAN</button>
              {saveMsg && <span style={{ marginLeft: 10, fontSize: '0.8rem', color: saveMsg.includes('✓') ? '#43a047' : '#e53935', fontWeight: 600 }}>{saveMsg}</span>}
            </div>
          </div>
        )}

        {/* SSID — Editable */}
        {tab === 'ssid' && (
          <div>
            {ssidList.map(s => (
              <div key={s.id} className="card" style={{ marginBottom: 10, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                    <label style={{ fontSize: '0.72rem' }}>SSID Name</label>
                    <input value={s.ssid} onChange={e => updateSsid(s.id, 'ssid', e.target.value)} style={{ padding: '5px 8px', fontSize: '0.85rem', fontWeight: 600, maxWidth: '100%' }} />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', marginLeft: 12, cursor: 'pointer', whiteSpace: 'nowrap', color: s.enabled ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    <input type="checkbox" checked={s.enabled} onChange={e => updateSsid(s.id, 'enabled', e.target.checked)} style={{ accentColor: 'var(--accent-green)' }} />
                    {s.enabled ? 'ON' : 'OFF'}
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.82rem' }}>
                  <div className="form-group" style={{ marginBottom: 4 }}><label style={{ fontSize: '0.72rem' }}>Band</label><span style={{ fontSize: '0.83rem', fontWeight: 500, display: 'block', padding: '5px 0' }}>{s.band}</span></div>
                  <div className="form-group" style={{ marginBottom: 4 }}><label style={{ fontSize: '0.72rem' }}>Security</label>
                    <select value={s.security} onChange={e => updateSsid(s.id, 'security', e.target.value)} style={{ padding: '5px 8px', fontSize: '0.8rem', maxWidth: '100%' }}>
                      <option>WPA2-PSK</option><option>WPA/WPA2-PSK</option><option>WPA3-PSK</option><option>Open</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 4 }}><label style={{ fontSize: '0.72rem' }}>Channel</label>
                    <input value={s.channel} onChange={e => updateSsid(s.id, 'channel', e.target.value)} style={{ padding: '5px 8px', fontSize: '0.8rem', maxWidth: '100%' }} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 4 }}><label style={{ fontSize: '0.72rem' }}>Password</label>
                    <input value={s.password} onChange={e => updateSsid(s.id, 'password', e.target.value)} style={{ padding: '5px 8px', fontSize: '0.8rem', maxWidth: '100%' }} />
                  </div>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 10, textAlign: 'right' }}>
              <button className="btn btn-primary btn-sm" onClick={async () => { try { await api.post(`/devices/${device.id}/config`, { type: 'ssid', data: ssidList }); showSaved('✓ SSID tersimpan'); if (onSave) onSave(); setTimeout(onClose, 800); } catch(e) { console.error(e); showSaved('✗ Gagal menyimpan'); } }}><Save size={12} /> Simpan SSID</button>
              {saveMsg && <span style={{ marginLeft: 10, fontSize: '0.8rem', color: saveMsg.includes('✓') ? '#43a047' : '#e53935', fontWeight: 600 }}>{saveMsg}</span>}
            </div>
          </div>
        )}

        {/* Users — Editable */}
        {tab === 'users' && (
          <div>
            <table className="data-table">
              <thead><tr><th>Username</th><th>Password</th><th>Role</th><th>Access</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {userList.map(u => (
                  <tr key={u.id}>
                    <td><input value={u.username} onChange={e => updateUser(u.id, 'username', e.target.value)} style={{ background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 4, padding: '3px 6px', fontSize: '0.82rem', width: 90 }} /></td>
                    <td><input value={u.password || ''} onChange={e => updateUser(u.id, 'password', e.target.value)} style={{ background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 4, padding: '3px 6px', fontSize: '0.82rem', width: 90 }} /></td>
                    <td>
                      <select value={u.role} onChange={e => updateUser(u.id, 'role', e.target.value)} style={{ background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 4, padding: '3px 6px', fontSize: '0.82rem' }}>
                        <option>Administrator</option><option>User</option><option>Guest</option>
                      </select>
                    </td>
                    <td>
                      <select value={u.access} onChange={e => updateUser(u.id, 'access', e.target.value)} style={{ background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 4, padding: '3px 6px', fontSize: '0.82rem' }}>
                        <option>Full</option><option>Limited</option><option>View Only</option>
                      </select>
                    </td>
                    <td><span className={`status-badge ${u.status}`}><span className="dot" />{u.status}</span></td>
                    <td><button className="btn-icon" style={{ width: 24, height: 24, color: 'var(--accent-red)' }} onClick={() => setUserList(prev => prev.filter(x => x.id !== u.id))}><Trash2 size={12} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 10, textAlign: 'right' }}>
              <button className="btn btn-primary btn-sm" onClick={async () => { try { await api.post(`/devices/${device.id}/config`, { type: 'users', data: userList }); showSaved('✓ Users tersimpan'); if (onSave) onSave(); setTimeout(onClose, 800); } catch(e) { console.error(e); showSaved('✗ Gagal menyimpan'); } }}><Save size={12} /> Simpan Users</button>
              {saveMsg && <span style={{ marginLeft: 10, fontSize: '0.8rem', color: saveMsg.includes('✓') ? '#43a047' : '#e53935', fontWeight: 600 }}>{saveMsg}</span>}
            </div>
          </div>
        )}

        {/* Reboot / Refresh */}
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border-color)', display: 'flex', gap: 8 }}>
          <button className="btn btn-danger" onClick={async () => { if (confirm('Reboot device?')) { try { await api.post(`/devices/${device.id}/reboot`); alert('Reboot sent!'); } catch { alert('Gagal reboot'); } } }}><Power size={13} /> Reboot</button>
          <button className="btn btn-secondary" onClick={async () => { try { await api.post(`/devices/${device.id}/refresh`); alert(`Summon berhasil dikirim ke perangkat ${device.name}!`); } catch { alert('Gagal melakukan summon'); } }}><RefreshCw size={13} /> Summon Device</button>
        </div>
      </div>
    </div>
  );
}

// ──── Devices Page ────
export default function Devices() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [limit, setLimit] = useState(15);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [allDevices, setAllDevices] = useState([]);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      if (search !== debouncedSearch) setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch devices whenever filters change
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const params = { page, limit };
        if (statusFilter) params.status = statusFilter;
        if (vendorFilter) params.vendor = vendorFilter;
        if (debouncedSearch) params.search = debouncedSearch;
        
        console.log('📡 FETCH DEVICES:', params);
        const res = await getDevices(params);
        console.log('📡 FETCH SUCCESS:', res.data?.data?.length, 'devices found');
        
        setDevices(res.data?.data || []);
        setPagination(res.data?.pagination || {});
      } catch (err) { 
        console.error('📡 FETCH ERROR:', err);
      } finally { 
        setLoading(false); 
      }
    })();
  }, [page, statusFilter, vendorFilter, debouncedSearch, limit]);

  useEffect(() => { fetchAll(); }, []);

  async function fetchDevices() {
    try {
      setLoading(true);
      const params = { page, limit };
      if (statusFilter) params.status = statusFilter;
      if (vendorFilter) params.vendor = vendorFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      const res = await getDevices(params);
      setDevices(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function fetchAll() {
    try {
      const res = await getDevices({ limit: 999 });
      setAllDevices(res.data.data);
    } catch {}
  }

  async function handleDelete(id) {
    if (!window.confirm('Hapus perangkat dari database?')) return;
    try {
      await api.delete(`/devices/${id}`);
      fetchDevices();
      fetchAll();
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Gagal menghapus perangkat');
    }
  }

  // RX Power statistics
  const rxValues = (allDevices || []).filter(d => d && d.rx_power != null).map(d => d.rx_power);
  const rxGood = rxValues.filter(v => v >= -20).length;
  const rxFair = rxValues.filter(v => v < -20 && v >= -25).length;
  const rxWarn = rxValues.filter(v => v < -25 && v >= -28).length;
  const rxCrit = rxValues.filter(v => v < -28).length;

  // ──── Ultimate Defensive Render ────
  try {
    return (
      <div className="devices-page">
        <div className="page-header">
          <h1>Device Management</h1>
          <p>Kelola dan monitoring semua perangkat ONT</p>
        </div>

        <div className="table-container">
          <div className="table-header">
            <h3>ONT Devices ({pagination?.total || devices?.length || 0})</h3>
            <div className="table-actions">
              <div className="search-input">
                <Search size={14} />
                <input 
                  placeholder="Cari serial, ssid..." 
                  value={search || ''} 
                  onChange={e => setSearch(e.target.value)} 
                />
              </div>
              <select 
                className="filter-select" 
                value={statusFilter || ''} 
                onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Status</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="warning">Warning</option>
              </select>
              <button className="btn btn-secondary btn-sm" onClick={() => { fetchDevices(); fetchAll(); }}>
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="loading-container"><div className="spinner" /></div>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>SSID</th>
                    <th>Serial</th>
                    <th>PPPoE</th>
                    <th>Vendor</th>
                    <th>Status</th>
                    <th>RX Power</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(devices) && devices.length > 0 ? (
                    devices.map((d, idx) => {
                      if (!d) return <tr key={idx}><td colSpan={7}>Invalid Device Data</td></tr>;
                      return (
                        <tr key={d.id || idx}>
                          <td style={{ fontWeight: 500, fontSize: '0.95rem' }}>
                            <Wifi size={14} style={{ marginRight: 6, verticalAlign: 'middle', color: 'var(--accent-blue)' }} />
                            {cleanName(d.ssid_name || d.name || 'Unnamed')}
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{d.serial_number || '-'}</td>
                          <td style={{ color: 'var(--accent-blue)', fontSize: '0.85rem' }}>{d.pppoe_username || '-'}</td>
                          <td>
                            <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, background: 'rgba(0,0,0,0.05)' }}>
                              {d.vendor || '-'}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge ${d.status || 'offline'}`}>
                              <span className="dot" />{d.status || 'offline'}
                            </span>
                          </td>
                          <td style={{ color: (d.rx_power && d.rx_power < -25) ? 'var(--accent-red)' : 'var(--accent-green)', fontFamily: 'monospace' }}>
                            {d.rx_power ? `${d.rx_power} dBm` : '-'}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn-icon" title="Detail" onClick={() => setSelectedDevice(d)}><Eye size={14} /></button>
                              <button className="btn-icon" title="Summon" onClick={() => api.post(`/devices/${d.id}/refresh`).catch(() => {})}><RefreshCw size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>No devices found</td></tr>
                  )}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Showing {devices?.length || 0} of {pagination?.total || 0}
                </span>
                <div style={{ display: 'flex', gap: 5 }}>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    disabled={page <= 1} 
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <span style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                    {page}/{pagination?.totalPages || 1}
                  </span>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    disabled={page >= (pagination?.totalPages || 1)} 
                    onClick={() => setPage(p => p + 1)}
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {selectedDevice && (
          <DeviceDetailModal 
            device={selectedDevice} 
            onClose={() => setSelectedDevice(null)} 
            onSave={() => { fetchDevices(); fetchAll(); }} 
          />
        )}
      </div>
    );
  } catch (err) {
    console.error('DEVICE RENDER ERROR:', err);
    return (
      <div style={{ padding: 20, color: 'red' }}>
        <h3>Render Error</h3>
        <pre>{err.stack}</pre>
      </div>
    );
  }
}
}

