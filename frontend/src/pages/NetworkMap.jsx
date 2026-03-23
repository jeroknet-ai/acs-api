import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, useMapEvents, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  Layers, RefreshCw, List, Settings, Download, Upload, X,
  Radio, Box, MapPin, Monitor, Cable, Trash2, Edit2, Move, Save
} from 'lucide-react';
import {
  getTopology, addOLT, addODC, addODP, addDevice, addCable,
  exportData, importData, saveSettings
} from '../services/api';
import api from '../services/api';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const COLORS = { olt: '#7e57c2', odc: '#2196F3', odp: '#43a047', customer: '#ef6c00' };
const SIZES = { olt: 38, odc: 30, odp: 26, customer: 18 };
const LABELS = { olt: 'OLT', odc: 'C', odp: 'P', customer: '●' };

function createIcon(type, offline = false) {
  const c = offline ? '#e53935' : COLORS[type], s = SIZES[type];
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="width:${s}px;height:${s}px;border-radius:50%;background:${c};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:${s*.3}px;box-shadow:0 2px 8px ${c}88;border:2px solid rgba(255,255,255,.6);font-family:Inter,sans-serif;cursor:pointer">${LABELS[type]}</div>`,
    iconSize: [s, s], iconAnchor: [s/2, s/2], popupAnchor: [0, -s/2],
  });
}

function AnimatedPath({ positions, color, weight = 3 }) {
  const map = useMap();
  useEffect(() => {
    if (!map || positions.length < 2) return;
    // Layer 1: The 'data packets' (white dashes) flowing over the base colored cable, toned down
    const poly = L.polyline(positions, { 
      color: '#ffffff', 
      weight: Math.max(weight - 2, 1), 
      opacity: 0.5, 
      dashArray: '8 16', 
      lineCap: 'round', 
      interactive: false 
    }).addTo(map);
    
    let off = 0;
    // Faster animation interval for a more active look
    const iv = setInterval(() => { 
      off = (off + 2) % 24; 
      poly.setStyle({ dashOffset: -off }); 
    }, 45);
    
    return () => { clearInterval(iv); map.removeLayer(poly); };
  }, [map, positions, weight]);
  return null;
}

// Calculate distance in meters between two latlngs
function calcDistance(a, b) {
  const R = 6371e3;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const x = Math.sin(dLat/2)**2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}

// Map click handler (for cable & adding items)
function MapClickHandler({ active, cableStart, onMapClick, onPreviewMove, onZoom, onUndo }) {
  useMapEvents({
    click: (e) => { if (active) onMapClick(e.latlng); },
    mousemove: (e) => { if (active && cableStart) onPreviewMove(e.latlng); },
    zoomend: (e) => { onZoom(e.target.getZoom()); },
    contextmenu: (e) => { if (active && cableStart) { L.DomEvent.stop(e); onUndo(); } }
  });
  return null;
}

// Fix map being "cut off" by ensuring size is invalidated when needed
function ResizeFixer() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => { map.invalidateSize(); }, 500);
    window.addEventListener('resize', () => map.invalidateSize());
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', () => map.invalidateSize());
    };
  }, [map]);
  return null;
}

// Zoom setter
function ZoomSetter({ zoom }) {
  const map = useMap();
  useEffect(() => { if (zoom) map.setZoom(zoom); }, [zoom, map]);
  return null;
}

// ──── Draggable Marker ────
function DraggableMarker({ position, icon, type, name, details, entityId, entityType, onRefresh, cableMode, onCableClick }) {
  const [dragging, setDragging] = useState(false);
  const markerRef = useRef(null);

  async function handleDragEnd() {
    const marker = markerRef.current;
    if (!marker) return;
    const pos = marker.getLatLng();
    try {
      const url = entityType === 'devices' ? `/settings/devices/${entityId}` : `/settings/${entityType}/${entityId}`;
      await api.put(url, { lat: pos.lat, lng: pos.lng, name });
      setDragging(false);
      onRefresh();
    } catch { alert('Gagal menggeser'); setDragging(false); }
  }

  async function handleDelete() {
    if (!confirm(`Hapus ${name}?`)) return;
    const marker = markerRef.current;
    if (marker) marker.closePopup();
    try {
      const url = entityType === 'devices' ? `/settings/devices/${entityId}` : `/settings/${entityType}/${entityId}`;
      await api.delete(url);
      onRefresh();
    } catch { alert('Gagal menghapus'); }
  }

  function startDrag() {
    setDragging(true);
    const marker = markerRef.current;
    if (marker) {
      marker.dragging.enable();
      marker.closePopup();
    }
  }

  return (
    <Marker
      position={position}
      icon={icon}
      ref={markerRef}
      draggable={dragging}
      interactive={!cableMode}
      eventHandlers={{
        dragend: handleDragEnd,
        add: (e) => { if (!dragging) e.target.dragging?.disable(); }
      }}
    >
      {!cableMode && (
        <Popup>
          <h4>{name}</h4>
          {details}
          <div style={{ display: 'flex', gap: 4, marginTop: 8, borderTop: '1px solid #d0ddef', paddingTop: 6 }}>
            <button onClick={startDrag} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', fontSize: '0.72rem', fontWeight: 600, background: '#2196F3', color: '#fff', borderRadius: 4, border: 'none', cursor: 'pointer' }}><Move size={10} /> Geser</button>
            <button onClick={handleDelete} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', fontSize: '0.72rem', fontWeight: 600, background: '#e53935', color: '#fff', borderRadius: 4, border: 'none', cursor: 'pointer' }}><Trash2 size={10} /> Hapus</button>
          </div>
        </Popup>
      )}
    </Marker>
  );
}

// ── Add Item Modal ──
function AddItemModal({ type, onClose, onSave, mapCenter }) {
  const [form, setForm] = useState({
    name: '', lat: String(mapCenter?.[0] || -6.205), lng: String(mapCenter?.[1] || 106.843),
    notes: '', splitter: '1:8', pppoe: '', serial_number: '', mode: 'pppoe'
  });
  const labels = { olt: 'OLT', odc: 'ODC', odp: 'ODP', ont: 'ONT' };

  function handleSubmit(e) {
    e.preventDefault();
    const data = { name: form.name, lat: parseFloat(form.lat), lng: parseFloat(form.lng), notes: form.notes };
    if (type === 'odc' || type === 'odp') data.capacity = parseInt(form.splitter.split(':')[1]) || 8;
    if (type === 'ont') { data.serial_number = form.mode === 'serial' ? form.serial_number : `PPPoE-${form.pppoe}`; data.vendor = ''; data.model = ''; }
    onSave(data);
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h3><span style={{ width: 22, height: 22, borderRadius: '50%', background: COLORS[type === 'ont' ? 'customer' : type], display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.6rem', fontWeight: 700, marginRight: 8, verticalAlign: 'middle' }}>{type === 'ont' ? '●' : type.charAt(0).toUpperCase()}</span>Tambah {labels[type]}</h3>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label>Nama *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required style={{ maxWidth: '100%' }} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-group"><label>Latitude</label><input type="number" step="any" value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })} required style={{ maxWidth: '100%' }} /></div>
            <div className="form-group"><label>Longitude</label><input type="number" step="any" value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })} required style={{ maxWidth: '100%' }} /></div>
          </div>
          {(type === 'odc' || type === 'odp') && (<div className="form-group"><label>Splitter</label><select value={form.splitter} onChange={e => setForm({ ...form, splitter: e.target.value })} style={{ maxWidth: '100%' }}><option>1:2</option><option>1:4</option><option>1:8</option><option>1:16</option><option>1:32</option></select></div>)}
          {type === 'ont' && (<>
            <div className="form-group"><label>Mode</label><div style={{ display: 'flex', gap: 10, marginTop: 4 }}><label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: '0.83rem' }}><input type="radio" name="mode" checked={form.mode === 'pppoe'} onChange={() => setForm({ ...form, mode: 'pppoe' })} style={{ accentColor: '#2196F3' }} /> PPPoE</label><label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: '0.83rem' }}><input type="radio" name="mode" checked={form.mode === 'serial'} onChange={() => setForm({ ...form, mode: 'serial' })} style={{ accentColor: '#2196F3' }} /> Serial Number</label></div></div>
            {form.mode === 'pppoe' ? (<div className="form-group"><label>PPPoE Username</label><input value={form.pppoe} onChange={e => setForm({ ...form, pppoe: e.target.value })} required style={{ maxWidth: '100%' }} placeholder="user@isp.net" /></div>) : (<div className="form-group"><label>Serial Number</label><input value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} required style={{ maxWidth: '100%' }} placeholder="ALCL00000001" /></div>)}
          </>)}
          <div className="form-group"><label>Notes</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ maxWidth: '100%', minHeight: 50 }} placeholder="Catatan..." /></div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}><button type="submit" className="btn btn-primary">Simpan</button><button type="button" className="btn btn-secondary" onClick={onClose}>Batal</button></div>
        </form>
      </div>
    </div>
  );
}

// ── Clickable Cable with length + delete ──
function CableLine({ cable, positions, color, weight, onDelete }) {
  const totalDist = positions.reduce((acc, curr, i, arr) => i > 0 ? acc + calcDistance(arr[i-1], curr) : 0, 0);
  const label = totalDist >= 1000 ? `${(totalDist/1000).toFixed(2)} km` : `${Math.round(totalDist)} m`;
  return (
    <>
      {/* Invisible wider hit area for easier clicking */}
      <Polyline positions={positions} pathOptions={{ color: 'transparent', weight: 15, interactive: true }}>
        <Popup>
          <h4 style={{ fontSize: '0.85rem' }}>🔌 {cable.cable_type}</h4>
          <div className="popup-row"><span>Panjang</span><span style={{ fontWeight: 600 }}>{label}</span></div>
          <div className="popup-row"><span>From</span><span>{cable.from_type} #{cable.from_id}</span></div>
          <div className="popup-row"><span>To</span><span>{cable.to_type} #{cable.to_id}</span></div>
          <button onClick={() => onDelete(cable.id)} style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', fontSize: '0.72rem', fontWeight: 600, background: '#e53935', color: '#fff', borderRadius: 4, border: 'none', cursor: 'pointer' }}><Trash2 size={10} /> Hapus Kabel</button>
        </Popup>
      </Polyline>

      {/* Visible line */}
      <Polyline positions={positions} pathOptions={{ color, weight, opacity: 0.8, interactive: false }} />
      <AnimatedPath positions={positions} color={color} weight={weight - 1} />
    </>
  );
}

// ── List Panel ──
function ListPanel({ topology, onClose }) {
  const [tab, setTab] = useState('olt');
  const olts = topology?.allOlts?.length > 0 ? topology.allOlts : (topology?.olt ? [topology.olt] : []);
  const odcs = topology?.odcs || [];
  const allOdps = topology?.allOdps || [];
  const allDevs = topology?.allDevices || [];
  const stats = { olt: olts.length, odc: odcs.length, odp: allOdps.length, ont: allDevs.length, on: allDevs.filter(d => d.status === 'online').length, off: allDevs.filter(d => d.status === 'offline').length };
  return (
    <div className="map-side-panel">
      <h4><span><List size={15} style={{ marginRight: 5, verticalAlign: 'middle' }} />Infrastruktur</span><button className="btn-icon" onClick={onClose} style={{ width: 26, height: 26 }}><X size={13} /></button></h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
        {[['OLT', stats.olt, '#7e57c2'], ['ODC', stats.odc, '#2196F3'], ['ODP', stats.odp, '#43a047'], ['ONT', stats.ont, '#ef6c00'], ['On', stats.on, '#43a047'], ['Off', stats.off, '#e53935']].map(([l, v, c]) => (
          <div key={l} style={{ background: '#eef3fa', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}><div style={{ fontSize: '1rem', fontWeight: 700, color: c }}>{v}</div><div style={{ fontSize: '0.65rem', color: '#9ab0c8', fontWeight: 500 }}>{l}</div></div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #d0ddef', marginBottom: 8 }}>
        {['olt', 'odc', 'odp', 'ont'].map(t => (<button key={t} onClick={() => setTab(t)} style={{ padding: '5px 10px', fontSize: '0.75rem', fontWeight: tab === t ? 600 : 500, color: tab === t ? '#2196F3' : '#5a7394', borderBottom: tab === t ? '2px solid #2196F3' : '2px solid transparent', marginBottom: -2, background: 'transparent', cursor: 'pointer' }}>{t.toUpperCase()}</button>))}
      </div>
      <div style={{ maxHeight: 330, overflowY: 'auto' }}>
        {tab === 'olt' && olts.map((o, i) => <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #d0ddef', fontSize: '0.82rem' }}><div style={{ fontWeight: 600, color: '#7e57c2' }}>{o.name}</div><div style={{ color: '#9ab0c8', fontSize: '0.72rem' }}>{o.lat?.toFixed(4)}, {o.lng?.toFixed(4)}</div></div>)}
        {tab === 'odc' && odcs.map(o => <div key={o.id} style={{ padding: '6px 0', borderBottom: '1px solid #d0ddef', fontSize: '0.82rem' }}><div style={{ fontWeight: 600, color: '#2196F3' }}>{o.name}</div><div style={{ color: '#9ab0c8', fontSize: '0.72rem' }}>ODP: {o.odps?.length || 0} · Cap: {o.capacity}</div></div>)}
        {tab === 'odp' && allOdps.map(o => <div key={o.id} style={{ padding: '6px 0', borderBottom: '1px solid #d0ddef', fontSize: '0.82rem' }}><div style={{ fontWeight: 600, color: '#43a047' }}>{o.name}</div><div style={{ color: '#9ab0c8', fontSize: '0.72rem' }}>Used: {o.used}/{o.capacity}</div></div>)}
        {tab === 'ont' && allDevs.map(d => <div key={d.id} style={{ padding: '6px 0', borderBottom: '1px solid #d0ddef', fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><div style={{ fontWeight: 500 }}>{d.name}</div><div style={{ color: '#9ab0c8', fontSize: '0.72rem' }}>{d.serial_number}</div></div><span className={`status-badge ${d.status}`}><span className="dot" />{d.status}</span></div>)}
      </div>
    </div>
  );
}

// ── Map Settings Panel ──
function MapSettingsPanel({ onClose, mapCenter, currentZoom, setZoomLevel }) {
  const [lat, setLat] = useState(String(mapCenter?.[0] || -6.205));
  const [lng, setLng] = useState(String(mapCenter?.[1] || 106.843));
  const [zoom, setZoom] = useState(String(currentZoom || 18));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await saveSettings({ map_center_lat: lat, map_center_lng: lng, map_zoom: zoom });
      setZoomLevel(parseInt(zoom));
      setSaving(false);
      alert('Settings disimpan!');
    } catch { setSaving(false); alert('Gagal menyimpan'); }
  }

  async function handleExport() {
    try {
      const res = await exportData();
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'msnetwork-export.json'; a.click(); URL.revokeObjectURL(url);
    } catch { alert('Export failed'); }
  }

  function handleImport() {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
    input.onchange = async (e) => { try { const text = await e.target.files[0].text(); await importData(JSON.parse(text)); alert('Import berhasil!'); window.location.reload(); } catch { alert('Import failed'); } };
    input.click();
  }

  return (
    <div className="map-side-panel" style={{ width: 270 }}>
      <h4><span><Settings size={15} style={{ marginRight: 5, verticalAlign: 'middle' }} />Settings</span><button className="btn-icon" onClick={onClose} style={{ width: 26, height: 26 }}><X size={13} /></button></h4>
      <div className="form-group"><label>Center Lat</label><input type="number" step="any" value={lat} onChange={e => setLat(e.target.value)} style={{ maxWidth: '100%' }} /></div>
      <div className="form-group"><label>Center Lng</label><input type="number" step="any" value={lng} onChange={e => setLng(e.target.value)} style={{ maxWidth: '100%' }} /></div>
      <div className="form-group"><label>Zoom Level</label><input type="number" min={1} max={22} value={zoom} onChange={e => setZoom(e.target.value)} style={{ maxWidth: '100%' }} /></div>
      <button className="btn btn-primary btn-sm" onClick={handleSave} style={{ marginBottom: 12 }}><Save size={12} /> {saving ? 'Saving...' : 'Save Settings'}</button>
      <div style={{ borderTop: '1px solid #d0ddef', paddingTop: 10, marginTop: 6 }}>
        <p style={{ fontSize: '0.75rem', color: '#5a7394', marginBottom: 8, fontWeight: 600 }}>Export / Import</p>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleExport}><Download size={12} /> Export</button>
          <button className="btn btn-secondary btn-sm" onClick={handleImport}><Upload size={12} /> Import</button>
        </div>
      </div>
    </div>
  );
}

// ──── Main ────
export default function NetworkMap() {
  const [topology, setTopology] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showList, setShowList] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [addMode, setAddMode] = useState(null); // 'olt', 'odc', etc., waiting for click
  const [addType, setAddType] = useState(null); // actually shows the modal
  const [addCoordinates, setAddCoordinates] = useState(null);
  const [showLayers, setShowLayers] = useState({ backbone: true, distribution: true, drop: true, customers: true });
  const [zoomLevel, setZoomLevel] = useState(18);
  // Cable drawing
  const [cableMode, setCableMode] = useState(false);
  const [cableStart, setCableStart] = useState(null); // { latlng, type, id, name }
  const [cableWaypoints, setCableWaypoints] = useState([]);
  const [previewLine, setPreviewLine] = useState(null);

  useEffect(() => { fetchTopology(); }, []);

  async function fetchTopology() {
    try { if (!topology) setLoading(true); const res = await getTopology(); setTopology(res.data); } catch (err) { console.error(err); } finally { setLoading(false); }
  }

  async function handleAddSave(data) {
    try {
      if (addType === 'olt') await addOLT(data);
      else if (addType === 'odc') await addODC(data);
      else if (addType === 'odp') await addODP(data);
      else if (addType === 'ont') await addDevice({ ...data, serial_number: data.serial_number || `ONT-${Date.now()}` });
      setAddType(null); fetchTopology();
    } catch { alert('Gagal menyimpan'); }
  }

  async function handleDeleteCable(id) {
    if (!confirm('Hapus kabel ini?')) return;
    try { await api.delete(`/settings/cables/${id}`); fetchTopology(); } catch { alert('Gagal menghapus'); }
  }

  // Find nearest infrastructure point for cable click
  function findNearestNode(latlng) {
    const threshold = 50; // meters
    let best = null, bestDist = Infinity;

    // Priority 1: Devices (Customers/ONTs) - Priority for drop cables
    (topology?.allDevices || []).forEach(d => {
      if (d.lat && d.lng) {
        const dist = calcDistance([latlng.lat, latlng.lng], [d.lat, d.lng]);
        if (dist < bestDist) { bestDist = dist; best = { type: 'devices', id: d.id, name: d.name, lat: d.lat, lng: d.lng }; }
      }
    });
    // OLT
    (topology?.allOlts || (topology?.olt ? [topology.olt] : [])).forEach(o => {
      if (o.lat && o.lng) {
        const d = calcDistance([latlng.lat, latlng.lng], [o.lat, o.lng]);
        if (d < bestDist) { bestDist = d; best = { type: 'olt', id: o.id || 1, name: o.name, lat: o.lat, lng: o.lng }; }
      }
    });
    // ODC
    (topology?.odcs || []).forEach(o => {
      if (o.lat && o.lng) {
        const d = calcDistance([latlng.lat, latlng.lng], [o.lat, o.lng]);
        if (d < bestDist) { bestDist = d; best = { type: 'odc', id: o.id, name: o.name, lat: o.lat, lng: o.lng }; }
      }
    });
    // ODP
    (topology?.allOdps || []).forEach(o => {
      if (o.lat && o.lng) {
        const d = calcDistance([latlng.lat, latlng.lng], [o.lat, o.lng]);
        if (d < bestDist) { bestDist = d; best = { type: 'odp', id: o.id, name: o.name, lat: o.lat, lng: o.lng }; }
      }
    });

    return bestDist < threshold ? best : null;
  }

  function handleCableClick(latlng) {
    const node = findNearestNode(latlng);
    if (!node) { alert('Klik tepat pada marker OLT/ODC/ODP/ONT!'); return; }

    if (!cableStart) {
      setCableStart(node);
      setCableWaypoints([]);
    } else {
      // Create cable
      if (node.id === cableStart.id && node.type === cableStart.type) { alert('Titik awal dan akhir tidak boleh sama'); return; }
      const cableType = cableStart.type === 'olt' ? 'backbone' : cableStart.type === 'odc' ? 'distribution' : 'drop';
      addCable({ from_type: cableStart.type, from_id: cableStart.id, to_type: node.type, to_id: node.id, cable_type: cableType, waypoints: cableWaypoints })
        .then(() => { 
          alert(`Kabel tersimpan!\nDari: ${cableStart.type}#${cableStart.id}\nKe: ${node.type}#${node.id}`);
          fetchTopology(); 
          setCableStart(null); 
          setCableWaypoints([]); 
          setCableMode(false); 
          setPreviewLine(null); 
        })
        .catch(() => { alert('Gagal menambah kabel'); });
    }
  }

  function handleMapClick(latlng) {
    if (cableMode) {
      if (!cableStart) {
        handleCableClick(latlng);
      } else {
        const node = findNearestNode(latlng);
        // Jika node tujuan sama dengan titik awal, abaikan deteksi node dan anggap sebagai titik belok (waypoint) saja
        if (node && !(node.id === cableStart.id && node.type === cableStart.type)) {
          handleCableClick(latlng);
        } else {
          setCableWaypoints(prev => [...prev, { lat: latlng.lat, lng: latlng.lng }]);
        }
      }
    } else if (addMode) {
      setAddCoordinates([latlng.lat, latlng.lng]);
      setAddType(addMode);
      setAddMode(null);
    }
  }

  if (loading || !topology) {
    return (<div><div className="page-header"><h1>Network Map</h1><p>Visualisasi jaringan fiber optik</p></div><div className="loading-container"><div className="spinner" /></div></div>);
  }

  const center = [topology.olt.lat, topology.olt.lng];
  const bC = topology.cables.filter(c => c.cable_type === 'backbone');
  const dC = topology.cables.filter(c => c.cable_type === 'distribution');
  const drC = topology.cables.filter(c => c.cable_type === 'drop');

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div><h1>Network Map</h1><p>Visualisasi jaringan fiber optik — Google Maps Satellite</p></div>
        <button className="btn btn-secondary" onClick={fetchTopology}><RefreshCw size={13} /> Refresh</button>
      </div>

      {/* Mode Banners */}
      {cableMode && (
        <div style={{ background: cableStart ? '#ef6c00' : '#2196F3', color: '#fff', padding: '8px 16px', borderRadius: 8, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', fontWeight: 500 }}>
          <span>{cableStart ? `✓ Jalur: ${cableStart.name} ➜ Klik Map: Belok (Kanan: Undo), Klik Marker: Selesai` : '🔌 Mode Cable: Klik titik awal (OLT/ODC/ODP)'}</span>
          <button onClick={() => { setCableMode(false); setCableStart(null); setCableWaypoints([]); setPreviewLine(null); }} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>Batal</button>
        </div>
      )}
      {addMode && (
        <div style={{ background: '#7e57c2', color: '#fff', padding: '8px 16px', borderRadius: 8, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', fontWeight: 500 }}>
          <span>📍 Mode Tambah {addMode.toUpperCase()}: Klik titik lokasi di peta</span>
          <button onClick={() => setAddMode(null)} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>Batal</button>
        </div>
      )}

      <div className="map-container" style={{ cursor: (cableMode || addMode) ? 'crosshair' : undefined }}>
        <MapContainer center={center} zoom={zoomLevel} style={{ height: '100%', width: '100%' }} zoomControl={true} maxZoom={22}>
          <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" attribution="&copy; Google" maxZoom={22} maxNativeZoom={20} />
          <TileLayer url="https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}" opacity={0.6} maxZoom={22} maxNativeZoom={20} />
          <ResizeFixer />
          <ZoomSetter zoom={zoomLevel} />
          <MapClickHandler 
            active={cableMode || addMode} 
            cableStart={cableStart} 
            onMapClick={handleMapClick} 
            onPreviewMove={setPreviewLine} 
            onZoom={setZoomLevel} 
            onUndo={() => setCableWaypoints(prev => prev.slice(0, -1))} 
          />

          {/* Points pinned while drawing */}
          {cableMode && cableWaypoints.map((w, idx) => (
            <CircleMarker key={`wp-${idx}`} center={[w.lat, w.lng]} radius={4} pathOptions={{ color: '#fff', fillColor: '#ef6c00', fillOpacity: 1, weight: 2 }} />
          ))}

          {/* Preview line while drawing */}
          {cableStart && previewLine && <Polyline positions={[[cableStart.lat, cableStart.lng], ...cableWaypoints.map(w => [w.lat, w.lng]), [previewLine.lat, previewLine.lng]]} pathOptions={{ color: '#fff', weight: 2, dashArray: '5 5', opacity: 0.6 }} />}

          {/* Cables — clickable with info */}
          {showLayers.backbone && bC.map(c => <CableLine key={`bb-${c.id}`} cable={c} positions={[[c.fromCoords.lat, c.fromCoords.lng], ...(c.waypoints || []).map(w=>[w.lat, w.lng]), [c.toCoords.lat, c.toCoords.lng]]} color="#42a5f5" weight={7} onDelete={handleDeleteCable} />)}
          {showLayers.distribution && dC.map(c => <CableLine key={`d-${c.id}`} cable={c} positions={[[c.fromCoords.lat, c.fromCoords.lng], ...(c.waypoints || []).map(w=>[w.lat, w.lng]), [c.toCoords.lat, c.toCoords.lng]]} color="#4dd0e1" weight={5} onDelete={handleDeleteCable} />)}
          {showLayers.drop && drC.map(c => <CableLine key={`dr-${c.id}`} cable={c} positions={[[c.fromCoords.lat, c.fromCoords.lng], ...(c.waypoints || []).map(w=>[w.lat, w.lng]), [c.toCoords.lat, c.toCoords.lng]]} color="#66bb6a" weight={5} onDelete={handleDeleteCable} />)}

          {/* OLT */}
          {(topology.allOlts || []).map(o => (
            <DraggableMarker key={`olt-${o.id}`} position={[o.lat, o.lng]} icon={createIcon('olt')} type="olt" name={o.name} entityId={o.id} entityType="olt" onRefresh={fetchTopology} cableMode={cableMode} onCableClick={handleCableClick}
              details={<><div className="popup-row"><span>Type</span><span>OLT</span></div><div className="popup-row"><span>ODC</span><span>{topology.odcs?.length || 0}</span></div></>} />
          ))}

          {/* ODC */}
          {topology.odcs.map(odc => (
            <DraggableMarker key={`odc-${odc.id}`} position={[odc.lat, odc.lng]} icon={createIcon('odc')} type="odc" name={odc.name} entityId={odc.id} entityType="odc" onRefresh={fetchTopology} cableMode={cableMode} onCableClick={handleCableClick}
              details={<><div className="popup-row"><span>Cap</span><span>{odc.capacity}</span></div><div className="popup-row"><span>ODP</span><span>{odc.odps.length}</span></div></>} />
          ))}

          {/* ODP */}
          {(topology.allOdps || []).map(odp => {
            const onl = (topology.allDevices || []).filter(d => d.odp_id === odp.id && d.status === 'online').length || 0;
            const tot = (topology.allDevices || []).filter(d => d.odp_id === odp.id).length || 0;
            return (
              <DraggableMarker key={`odp-${odp.id}`} position={[odp.lat, odp.lng]} icon={createIcon('odp', tot > 0 && onl === 0)} type="odp" name={odp.name} entityId={odp.id} entityType="odp" onRefresh={fetchTopology} cableMode={cableMode} onCableClick={handleCableClick}
                details={<><div className="popup-row"><span>Used</span><span>{odp.used}/{odp.capacity}</span></div><div className="popup-row"><span>Online</span><span style={{ color: '#43a047' }}>{onl}</span></div></>} />
            );
          })}

          {/* ONT */}
          {showLayers.customers && (topology.allDevices || []).map(d => {
            // Find parent ODP coordinate fallback just in case lat/lng is missing
            const odp = (topology.allOdps || []).find(o => o.id === d.odp_id);
            const fallbackLat = odp ? odp.lat + (Math.random()-0.5)*0.001 : center[0];
            const fallbackLng = odp ? odp.lng + (Math.random()-0.5)*0.001 : center[1];
            return (
              <DraggableMarker key={`dev-${d.id}`} position={[d.lat || fallbackLat, d.lng || fallbackLng]} icon={createIcon('customer', d.status === 'offline')} type="customer" name={d.name} entityId={d.id} entityType="devices" onRefresh={fetchTopology} cableMode={cableMode} onCableClick={handleCableClick}
                details={<>
                  <div className="popup-row"><span>S/N</span><span style={{ fontFamily: 'monospace', fontSize: '0.76rem' }}>{d.serial_number}</span></div>
                  <div className="popup-row"><span>Status</span><span style={{ color: d.status === 'online' ? '#43a047' : '#e53935', fontWeight: 600 }}>{d.status}</span></div>
                  <div className="popup-row"><span>RX Power</span><span style={{ fontWeight: 600, fontFamily: 'monospace', color: d.rx_power && d.rx_power < -25 ? '#e53935' : d.rx_power ? '#43a047' : '#9ab0c8' }}>{d.rx_power ? `${d.rx_power} dBm` : '-'}</span></div>
                  <div className="popup-row"><span>PPPoE</span><span>{d.pppoe_username || '-'}</span></div>
                  <div className="popup-row"><span>ODP</span><span>{odp ? odp.name : '-'}</span></div>
                </>} />
            );
          })}
        </MapContainer>

        {/* Toolbar */}
        <div className="map-toolbar">
          <button className="tbtn" style={{ background: '#7e57c2', color: '#fff', borderColor: '#7e57c2' }} onClick={() => { setAddMode('olt'); setCableMode(false); }}><Radio size={12} /> + OLT</button>
          <button className="tbtn" style={{ background: '#2196F3', color: '#fff', borderColor: '#2196F3' }} onClick={() => { setAddMode('odc'); setCableMode(false); }}><Box size={12} /> + ODC</button>
          <button className="tbtn" style={{ background: '#43a047', color: '#fff', borderColor: '#43a047' }} onClick={() => { setAddMode('odp'); setCableMode(false); }}><MapPin size={12} /> + ODP</button>
          <button className="tbtn" style={{ background: '#ef6c00', color: '#fff', borderColor: '#ef6c00' }} onClick={() => { setAddMode('ont'); setCableMode(false); }}><Monitor size={12} /> + ONT</button>
          <button className="tbtn" style={{ background: cableMode ? '#e53935' : '#1a3a5c', color: '#fff', borderColor: cableMode ? '#e53935' : '#1a3a5c' }} onClick={() => { setCableMode(!cableMode); setCableStart(null); setCableWaypoints([]); setPreviewLine(null); setAddMode(null); }}><Cable size={12} /> {cableMode ? '✕ Cancel' : '+ Cable'}</button>
          <span className="sep" />
          <button className="tbtn" style={showList ? { background: '#2196F3', color: '#fff', borderColor: '#2196F3' } : { background: '#fff', color: '#1a2d45' }} onClick={() => { setShowList(!showList); setShowSettings(false); }}><List size={12} /> List</button>
          <button className="tbtn" style={showSettings ? { background: '#2196F3', color: '#fff', borderColor: '#2196F3' } : { background: '#fff', color: '#1a2d45' }} onClick={() => { setShowSettings(!showSettings); setShowList(false); }}><Settings size={12} /> Settings</button>
        </div>

        {showList && <ListPanel topology={topology} onClose={() => setShowList(false)} />}
        {showSettings && <MapSettingsPanel onClose={() => setShowSettings(false)} mapCenter={center} currentZoom={zoomLevel} setZoomLevel={setZoomLevel} />}

        {!showList && !showSettings && (
          <div className="map-legend">
            <h4>Legend</h4>
            {[['OLT', '#7e57c2'], ['ODC', '#2196F3'], ['ODP', '#43a047'], ['Customer', '#ef6c00'], ['Offline', '#e53935']].map(([l, c]) => (<div key={l} className="legend-item"><span className="legend-dot" style={{ background: c }} />{l}</div>))}
            <div style={{ borderTop: '1px solid #d0ddef', margin: '5px 0', paddingTop: 5 }}>
              {[['Backbone', '#42a5f5'], ['Distribution', '#4dd0e1'], ['Drop', '#66bb6a']].map(([l, c]) => (<div key={l} className="legend-item"><span className="legend-line" style={{ background: c }} />{l}</div>))}
            </div>
          </div>
        )}

        <div style={{ position: 'absolute', bottom: 24, left: 10, zIndex: 1000, background: '#fff', border: '1px solid #d0ddef', borderRadius: 12, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,.06)' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#5a7394', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 3 }}><Layers size={11} />LAYERS</div>
          {[['backbone', 'Backbone', '#2196F3'], ['distribution', 'Distribution', '#00acc1'], ['drop', 'Drop', '#43a047'], ['customers', 'Customers', '#ef6c00']].map(([k, l, c]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.76rem', cursor: 'pointer', padding: '1px 0' }}>
              <input type="checkbox" checked={showLayers[k]} onChange={() => setShowLayers(p => ({ ...p, [k]: !p[k] }))} style={{ accentColor: c }} />{l}
            </label>
          ))}
        </div>
      </div>

      {addType && <AddItemModal type={addType} onClose={() => { setAddType(null); setAddCoordinates(null); }} onSave={handleAddSave} mapCenter={addCoordinates || center} />}
    </div>
  );
}
