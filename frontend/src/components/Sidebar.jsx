import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Monitor, Map, Settings, Wifi, Activity, Power } from 'lucide-react';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/devices', icon: Monitor, label: 'Devices' },
  { path: '/map', icon: Map, label: 'Network Map' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ connected, appName, onLogout }) {
  const location = useLocation();
  const displayName = appName || 'JNetwork';

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-wrapper">
          <span className="brand-label">{displayName}</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            title={item.label}
          >
            <item.icon size={17} />
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-watermark">
          <span>JNetwork</span>
        </div>
      </div>

      <style>{`
        .sidebar {
          width: var(--sidebar-collapsed);
          height: 100vh;
          position: fixed;
          left: 0; top: 0;
          background: var(--bg-sidebar);
          display: flex;
          flex-direction: column;
          z-index: 100;
          overflow: hidden;
          transition: width 0.25s cubic-bezier(0.4,0,0.2,1);
        }
        .sidebar:hover {
          width: var(--sidebar-width);
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          padding: 0;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          height: 56px;
          min-height: 56px;
          overflow: hidden;
          white-space: nowrap;
        }
        .brand-wrapper {
          display: flex;
          align-items: baseline;
          justify-content: center;
          width: 17px;
          margin-left: 20px;
          transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .sidebar:hover .brand-wrapper {
          width: 100%;
          margin-left: 0;
        }
        .brand-label {
          font-size: 1.65rem;
          font-weight: 800;
          color: white;
          letter-spacing: -0.01em;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        
        .sidebar:hover .brand-wrapper {
          width: 100%;
        }
        .sidebar:hover .brand-label { opacity: 1; }

        .sidebar-nav { flex: 1; padding: 10px 8px; overflow-y: auto; }

        .nav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px; border-radius: var(--radius-sm);
          color: var(--text-sidebar); font-size: 0.85rem; font-weight: 500;
          margin-bottom: 2px; transition: all var(--transition-fast);
          position: relative; white-space: nowrap; overflow: hidden;
        }
        .nav-item svg { min-width: 17px; flex-shrink: 0; }
        .nav-item:hover { background: var(--bg-sidebar-hover); color: white; }
        .nav-item.active { background: var(--bg-sidebar-active); color: var(--text-sidebar-active); }

        .logout-item { margin-top: 10px; color: rgba(255,255,255,0.5); }
        .logout-item:hover { background: rgba(239, 68, 68, 0.1) !important; color: #f87171 !important; }

        .nav-label {
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .sidebar:hover .nav-label { opacity: 1; }



        .sidebar-watermark {
          text-align: center; margin-bottom: 8px;
          opacity: 0; transition: opacity 0.2s ease;
        }
        .sidebar-watermark span {
          font-size: 0.95rem; font-weight: 800; color: rgba(255, 255, 255, 0.4); letter-spacing: 0.05em;
        }
        .sidebar:hover .sidebar-watermark { opacity: 1; }

        @media (max-width: 768px) { .sidebar { display: none; } }
      `}</style>
    </aside>
  );
}
