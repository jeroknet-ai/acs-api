import { useState, useEffect } from 'react';
import {
  Monitor,
  Wifi,
  WifiOff,
  AlertTriangle,
  Activity,
  Clock,
  AlertCircle,
  Info,
  TrendingUp,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { getDeviceStats } from '../services/api';

const VENDOR_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

export default function Dashboard({ socketStats }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const res = await getDeviceStats();
      setStats(res.data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  }

  // Use WebSocket stats if available for real-time counts
  const liveTotal = socketStats?.total ?? stats?.total ?? 0;
  const liveOnline = socketStats?.online ?? stats?.online ?? 0;
  const liveOffline = socketStats?.offline ?? stats?.offline ?? 0;
  const liveWarning = socketStats?.warning ?? stats?.warning ?? 0;

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
      </div>
    );
  }

  const trendData = stats?.hourlyTrend?.map((item) => ({
    time: item.hour.slice(11, 16),
    Online: Math.max(0, Math.round(item.online)),
    Offline: Math.max(0, Math.round(item.offline)),
  })) || [];

  const vendorData = stats?.vendorStats?.map((v) => ({
    name: v.vendor,
    value: v.count,
  })) || [];

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function cleanName(name) {
    if (!name || typeof name !== 'string') return '-';
    return name.replace(/[_\-\s]*(2\.4|5|2)G(Hz)?.*$/i, '').trim();
  }

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Monitor status jaringan WiFi secara real-time</p>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-icon"><Monitor size={22} /></div>
          <div className="stat-value">{liveTotal}</div>
          <div className="stat-label">Total Devices</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon"><Wifi size={22} /></div>
          <div className="stat-value">{liveOnline}</div>
          <div className="stat-label">Online</div>
        </div>
        <div className="stat-card red">
          <div className="stat-icon"><WifiOff size={22} /></div>
          <div className="stat-value">{liveOffline}</div>
          <div className="stat-label">Offline</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-icon"><AlertTriangle size={22} /></div>
          <div className="stat-value">{liveWarning}</div>
          <div className="stat-label">Warning</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid-3">
        {/* Online/Offline Trend Chart */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <TrendingUp size={18} style={{ color: 'var(--accent-blue)' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Device Status Trend (24h)</h3>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="gradOnline" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradOffline" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,115,171,0.1)" />
              <XAxis dataKey="time" stroke="#5a647a" fontSize={11} tickLine={false} />
              <YAxis stroke="#5a647a" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: '#1a1f36',
                  border: '1px solid rgba(99,115,171,0.2)',
                  borderRadius: 8,
                  color: '#e8ecf4',
                  fontSize: 12,
                }}
              />
              <Area type="monotone" dataKey="Online" stroke="#10b981" fill="url(#gradOnline)" strokeWidth={2} />
              <Area type="monotone" dataKey="Offline" stroke="#ef4444" fill="url(#gradOffline)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Vendor Distribution Pie */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <Activity size={18} style={{ color: 'var(--accent-purple)' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Vendor</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={vendorData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
              >
                {vendorData.map((_, idx) => (
                  <Cell key={idx} fill={VENDOR_COLORS[idx % VENDOR_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#1a1f36',
                  border: '1px solid rgba(99,115,171,0.2)',
                  borderRadius: 8,
                  color: '#e8ecf4',
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            {vendorData.map((v, i) => (
              <div key={v.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: VENDOR_COLORS[i] }} />
                <span style={{ color: 'var(--text-secondary)' }}>{v.name}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{v.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <AlertCircle size={18} style={{ color: 'var(--accent-orange)' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Recent Alerts</h3>
        </div>
        <div>
          {stats?.recentAlerts?.length === 0 && (
            <p style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>No recent alerts</p>
          )}
          {stats?.recentAlerts?.slice(0, 8).map((alert) => (
            <div key={alert.id} className="alert-item">
              <div className={`alert-icon ${alert.severity}`}>
                {alert.severity === 'critical' && <AlertTriangle size={16} />}
                {alert.severity === 'warning' && <AlertTriangle size={16} />}
                {alert.severity === 'info' && <Info size={16} />}
              </div>
              <div className="alert-content">
                <div className="alert-title">{alert.message}</div>
                <div className="alert-meta">
                  {cleanName(alert.device_name) || `Device #${alert.device_id}`} · <Clock size={11} style={{ verticalAlign: 'middle' }} /> {timeAgo(alert.created_at)}
                  {alert.resolved ? ' · ✅ Resolved' : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
