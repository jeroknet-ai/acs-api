import { useState, useEffect } from 'react';
import {
  Save, Server, Clock, Bell, Users, Shield, Tag, Wifi, X,
  Plus, Trash2, Edit2, Code, AlertTriangle, Settings as SettingsIcon
} from 'lucide-react';
import {
  getSettings, saveSettings, getHealth, getGenieacsStatus,
  getVendors, addVendor, updateVendor, deleteVendor,
  getUsers, addUser, updateUser, deleteUser,
  getVirtualParams, addVirtualParam, deleteVirtualParam,
} from '../services/api';

export default function Settings({ appName, setAppName }) {
  const [tab, setTab] = useState('general');
  const [config, setConfig] = useState({});
  const [vendors, setVendors] = useState([]);
  const [users, setUsers] = useState([]);
  const [virtualParams, setVirtualParams] = useState([]);
  const [health, setHealth] = useState(null);
  const [genieStatus, setGenieStatus] = useState(null);
  const [saved, setSaved] = useState(false);
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddVP, setShowAddVP] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingVendor, setEditingVendor] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const [s, h, g, v, u, vp] = await Promise.all([
        getSettings(), getHealth().catch(() => null), getGenieacsStatus().catch(() => null),
        getVendors(), getUsers(), getVirtualParams(),
      ]);
      setConfig(s.data);
      if (h?.data) setHealth(h.data);
      if (g?.data) setGenieStatus(g.data);
      setVendors(v.data);
      setUsers(u.data);
      setVirtualParams(vp.data);
    } catch (err) { console.error(err); }
  }

  async function handleSave() {
    try {
      await saveSettings(config);
      if (config.app_name) setAppName(config.app_name);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { alert('Failed to save settings'); }
  }

  async function handleAddVendor(data) {
    await addVendor(data);
    setShowAddVendor(false);
    const v = await getVendors();
    setVendors(v.data);
  }

  async function handleEditVendor(data) {
    await updateVendor(editingVendor.id, data);
    setEditingVendor(null);
    const v = await getVendors();
    setVendors(v.data);
  }

  async function handleDeleteVendor(id) {
    if (!confirm('Hapus vendor?')) return;
    await deleteVendor(id);
    const v = await getVendors();
    setVendors(v.data);
  }

  async function handleAddUser(data) {
    await addUser(data);
    setShowAddUser(false);
    const u = await getUsers();
    setUsers(u.data);
  }

  async function handleDeleteUser(id) {
    if (!confirm('Hapus user?')) return;
    try {
      await deleteUser(id);
      const u = await getUsers();
      setUsers(u.data);
    } catch (err) {
      console.error('Delete user error:', err);
      alert('Gagal menghapus user');
    }
  }

  async function handleEditUser(data) {
    await updateUser(editingUser.id, data);
    setEditingUser(null);
    const u = await getUsers();
    setUsers(u.data);
  }

  async function handleAddVP(data) {
    await addVirtualParam(data);
    setShowAddVP(false);
    const vp = await getVirtualParams();
    setVirtualParams(vp.data);
  }

  async function handleDeleteVP(id) {
    if (!confirm('Hapus virtual parameter?')) return;
    await deleteVirtualParam(id);
    const vp = await getVirtualParams();
    setVirtualParams(vp.data);
  }

  const tabs = [
    { id: 'general', label: 'General', icon: SettingsIcon },
    { id: 'vendors', label: 'Vendor Mgmt', icon: Wifi },
    { id: 'users', label: 'User Mgmt', icon: Users },
    { id: 'genieacs', label: 'GenieACS/ACS', icon: Server },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
        <p>Konfigurasi aplikasi monitoring</p>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {tabs.map(t => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            <t.icon size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />{t.label}
          </button>
        ))}
      </div>

      {/* ─── General Tab ─── */}
      {tab === 'general' && (
        <div className="grid-2">
          <div className="card">
            <div className="settings-section">
              <h3><Tag size={16} />Nama Aplikasi</h3>
              <div className="form-group">
                <label>Application Name</label>
                <input value={config.app_name || ''} onChange={e => setConfig({ ...config, app_name: e.target.value })} placeholder="MSNetwork" />
              </div>
            </div>

            <div className="settings-section">
              <h3><Clock size={16} />Polling</h3>
              <div className="form-group">
                <label>Polling Interval (seconds)</label>
                <input type="number" value={config.poll_interval || 30} onChange={e => setConfig({ ...config, poll_interval: e.target.value })} min={5} max={300} />
              </div>
            </div>

            <div className="settings-section">
              <h3><Bell size={16} />Notifications</h3>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--text-primary)' }}>
                  <input type="checkbox" defaultChecked style={{ accentColor: 'var(--accent-blue)' }} />
                  Enable Browser Notifications
                </label>
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleSave}>
              <Save size={14} />{saved ? 'Saved!' : 'Save Settings'}
            </button>
          </div>

          {/* System Status */}
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 14 }}>System Status</h3>
              {[
                ['Backend Server', health ? 'Running' : 'Down', health ? 'online' : 'offline'],
                ['GenieACS', genieStatus?.status === 'connected' ? 'Connected' : 'Disconnected', genieStatus?.status === 'connected' ? 'online' : 'offline'],
                ['Database Devices', health?.database?.devices ?? '—', null],
              ].map(([label, val, badge]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', marginBottom: 8 }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.83rem' }}>{label}</span>
                  {badge ? <span className={`status-badge ${badge}`}><span className="dot" />{val}</span> : <span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>{val}</span>}
                </div>
              ))}
            </div>
            <div className="card">
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 10 }}>About</h3>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.8 }}>
                <p><strong style={{ color: 'var(--text-primary)' }}>{appName}</strong> v2.0.0</p>
                <p>WiFi Monitoring Dashboard · GenieACS Integration</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Vendor Management Tab ─── */}
      {tab === 'vendors' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Vendor Management</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddVendor(true)}><Plus size={14} /> Add Vendor</button>
          </div>
          <table className="data-table">
            <thead><tr><th>Vendor</th><th>Description</th><th>WiFi Security</th><th>Encryption</th><th>Auth Mode</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {vendors.map(v => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 500 }}>{v.name}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{v.description}</td>
                  <td><span style={{ background: 'var(--accent-blue-glow)', color: 'var(--accent-blue)', padding: '2px 8px', borderRadius: 4, fontSize: '0.78rem', fontWeight: 500 }}>{v.wifi_security}</span></td>
                  <td style={{ fontSize: '0.83rem' }}>{v.encryption}</td>
                  <td style={{ fontSize: '0.83rem' }}>{v.auth_mode}</td>
                  <td><span className={`status-badge ${v.status}`}><span className="dot" />{v.status}</span></td>
                  <td style={{ display: 'flex', gap: 3 }}>
                    <button className="btn-icon" onClick={() => setEditingVendor(v)} title="Edit" style={{ color: 'var(--accent-blue)' }}><Edit2 size={14} /></button>
                    <button className="btn-icon" onClick={() => handleDeleteVendor(v.id)} style={{ color: 'var(--accent-red)' }}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Add Vendor Modal */}
          {showAddVendor && <FormModal title="Tambah Vendor" fields={[
            { name: 'name', label: 'Vendor Name', required: true },
            { name: 'description', label: 'Description' },
            { name: 'wifi_security', label: 'WiFi Security', placeholder: 'WPA2-PSK' },
            { name: 'encryption', label: 'Encryption', placeholder: 'AES' },
            { name: 'auth_mode', label: 'Auth Mode', placeholder: 'WPA2PSK' },
          ]} onSave={handleAddVendor} onClose={() => setShowAddVendor(false)} />}

          {editingVendor && <FormModal title="Edit Vendor" fields={[
            { name: 'name', label: 'Vendor Name', required: true },
            { name: 'description', label: 'Description' },
            { name: 'wifi_security', label: 'WiFi Security', placeholder: 'WPA2-PSK' },
            { name: 'encryption', label: 'Encryption', placeholder: 'AES' },
            { name: 'auth_mode', label: 'Auth Mode', placeholder: 'WPA2PSK' },
            { name: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'] },
          ]} initialData={editingVendor} onSave={handleEditVendor} onClose={() => setEditingVendor(null)} />}
        </div>
      )}

      {/* ─── User Management Tab ─── */}
      {tab === 'users' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>User Management</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddUser(true)}><Plus size={14} /> Add User</button>
          </div>
          <table className="data-table">
            <thead><tr><th>Username</th><th>Full Name</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.username}</td>
                  <td>{u.full_name}</td>
                  <td><span style={{ background: u.role === 'admin' ? 'rgba(124,58,237,0.08)' : u.role === 'operator' ? 'rgba(37,99,235,0.08)' : 'rgba(5,150,105,0.08)',
                    color: u.role === 'admin' ? '#7c3aed' : u.role === 'operator' ? '#2563eb' : '#059669',
                    padding: '2px 8px', borderRadius: 4, fontSize: '0.78rem', fontWeight: 500
                  }}>{u.role}</span></td>
                  <td><span className={`status-badge ${u.status}`}><span className="dot" />{u.status}</span></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{u.last_login || 'Never'}</td>
                  <td style={{ display: 'flex', gap: 3 }}>
                    <button className="btn-icon" onClick={() => setEditingUser(u)} title="Edit" style={{ color: 'var(--accent-blue)' }}><Edit2 size={14} /></button>
                    <button className="btn-icon" onClick={() => handleDeleteUser(u.id)} style={{ color: 'var(--accent-red)' }}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {showAddUser && <FormModal title="Tambah User" fields={[
            { name: 'username', label: 'Username', required: true },
            { name: 'password', label: 'Password', type: 'password', required: true },
            { name: 'full_name', label: 'Full Name' },
            { name: 'role', label: 'Role', type: 'select', options: ['admin', 'operator', 'viewer'] },
          ]} onSave={handleAddUser} onClose={() => setShowAddUser(false)} />}

          {editingUser && <FormModal title="Edit User" fields={[
            { name: 'username', label: 'Username', required: true },
            { name: 'full_name', label: 'Full Name' },
            { name: 'role', label: 'Role', type: 'select', options: ['admin', 'operator', 'viewer'] },
            { name: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'] },
            { name: 'password', label: 'Password (kosongkan jika tidak diubah)', type: 'password' },
          ]} initialData={editingUser} onSave={handleEditUser} onClose={() => setEditingUser(null)} />}
        </div>
      )}

      {/* ─── GenieACS/ACS Configuration Tab ─── */}
      {tab === 'genieacs' && (
        <div className="grid-2">
          <div className="card">
            <div className="settings-section">
              <h3><Server size={16} />GenieACS URL</h3>
              <div className="form-group">
                <label>GenieACS API URL</label>
                <input value={config.genieacs_url || ''} onChange={e => setConfig({ ...config, genieacs_url: e.target.value })} placeholder="http://localhost:7557" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <span className={`status-badge ${genieStatus?.status === 'connected' ? 'online' : 'offline'}`}>
                  <span className="dot" />{genieStatus?.status === 'connected' ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>

            <div className="settings-section">
              <h3><AlertTriangle size={16} />RX Power Configuration</h3>
              <div className="form-group">
                <label>Warning Threshold (dBm)</label>
                <input type="number" step="0.1" value={config.rx_power_warning || -25} onChange={e => setConfig({ ...config, rx_power_warning: e.target.value })} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>RX Power di bawah nilai ini = status Warning</span>
              </div>
              <div className="form-group">
                <label>Critical Threshold (dBm)</label>
                <input type="number" step="0.1" value={config.rx_power_critical || -28} onChange={e => setConfig({ ...config, rx_power_critical: e.target.value })} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>RX Power di bawah nilai ini = status Critical</span>
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleSave}>
              <Save size={14} />{saved ? 'Saved!' : 'Save Configuration'}
            </button>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><Code size={16} />Virtual Parameters</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddVP(true)}><Plus size={14} /> Add</button>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
              Virtual Parameters digunakan untuk normalisasi data multi-vendor (Huawei/ZTE/Fiberhome).
            </p>
            {virtualParams.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem', padding: 20, textAlign: 'center' }}>Belum ada virtual parameters</p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {virtualParams.map(vp => (
                  <div key={vp.id} style={{ background: 'var(--bg-input)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--accent-blue)' }}>{vp.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{vp.description || 'No description'}</div>
                      {vp.script && <pre style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 6, background: 'white', padding: 8, borderRadius: 4, overflow: 'auto', maxHeight: 60 }}>{vp.script}</pre>}
                    </div>
                    <button className="btn-icon" onClick={() => handleDeleteVP(vp.id)} style={{ color: 'var(--accent-red)', flexShrink: 0 }}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}

            {showAddVP && <FormModal title="Tambah Virtual Parameter" fields={[
              { name: 'name', label: 'Parameter Name', required: true, placeholder: 'e.g. RXPower' },
              { name: 'description', label: 'Description', placeholder: 'e.g. Normalized RX Power across vendors' },
              { name: 'script', label: 'Script', type: 'textarea', placeholder: 'let val = ...' },
            ]} onSave={handleAddVP} onClose={() => setShowAddVP(false)} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ──── Reusable Form Modal ────
function FormModal({ title, fields, onSave, onClose, initialData }) {
  const [form, setForm] = useState(initialData || {});

  function handleSubmit(e) {
    e.preventDefault();
    onSave(form);
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          {fields.map(f => (
            <div key={f.name} className="form-group">
              <label>{f.label}{f.required && ' *'}</label>
              {f.type === 'select' ? (
                <select value={form[f.name] || ''} onChange={e => setForm({ ...form, [f.name]: e.target.value })} required={f.required}>
                  <option value="">Select...</option>
                  {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea value={form[f.name] || ''} onChange={e => setForm({ ...form, [f.name]: e.target.value })} placeholder={f.placeholder} style={{ maxWidth: '100%' }} />
              ) : (
                <input type={f.type || 'text'} value={form[f.name] || ''} onChange={e => setForm({ ...form, [f.name]: e.target.value })} required={f.required} placeholder={f.placeholder} style={{ maxWidth: '100%' }} />
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="submit" className="btn btn-primary">Simpan</button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Batal</button>
          </div>
        </form>
      </div>
    </div>
  );
}
