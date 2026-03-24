import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Activity, Power } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import NetworkMap from './pages/NetworkMap';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { useSocket } from './hooks/useSocket';
import { getSettings } from './services/api';
import './index.css';

function App() {
  const { connected, stats } = useSocket();
  const [appName, setAppName] = useState('JNetwork');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Global Error Catcher
    const handleError = (e) => {
      console.error('GLOBAL ERROR:', e);
      setError(e.error || new Error(e.message));
    };
    window.addEventListener('error', handleError);

    try {
      console.log('🔐 AUTH: Checking localStorage...');
      const auth = localStorage.getItem('jnetwork_auth');
      if (auth === 'true') {
        console.log('🔐 AUTH: Authenticated via storage');
        setIsAuthenticated(true);
      }
    } catch (e) {
      console.error('Auth check failed:', e);
    }

    getSettings().then(res => {
      console.log('📡 SETTINGS: Loaded', res.data?.app_name);
      if (res && res.data && res.data.app_name) setAppName(res.data.app_name);
    }).catch(err => {
      console.error('Settings fetch failed:', err);
    });

    return () => window.removeEventListener('error', handleError);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('jnetwork_auth');
    setIsAuthenticated(false);
  };

  // Emergency Bypass: Siapapun yang pegang Shift saat klik Logo akan masuk
  const handleLogoClick = (e) => {
    if (e.shiftKey) {
      console.warn('🔓 EMERGENCY BYPASS ACTIVATED');
      localStorage.setItem('jnetwork_auth', 'true');
      setIsAuthenticated(true);
    }
  };

  if (error) {
    return (
      <div style={{ padding: 40, background: '#1a0000', color: '#ff4d4f', minHeight: '100vh', fontFamily: 'monospace' }}>
        <h1 style={{ borderBottom: '2px solid #ff4d4f', paddingBottom: 10 }}>🚨 CRITICAL APP CRASH</h1>
        <p style={{ fontSize: '1.2rem', margin: '20px 0' }}>Sistem Dashboard tidak bisa dimuat karena kesalahan fatal.</p>
        <pre style={{ background: '#000', padding: 20, borderRadius: 8, overflow: 'auto', color: '#0f0' }}>
          {error.stack || error.message}
        </pre>
        <button 
          onClick={() => { localStorage.clear(); window.location.reload(); }}
          style={{ padding: '12px 24px', background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}
        >
          RESET & REFRESH
        </button>
      </div>
    );
  }

  return (
    <BrowserRouter>
      {!isAuthenticated ? (
        <Login onLogin={() => setIsAuthenticated(true)} />
      ) : (
        <div className="app-layout">
          <Sidebar connected={connected} appName={appName} onLogout={handleLogout} />
          <main className="main-content">
            <div className="top-header-actions">
              <div 
                className={`global-connection-status ${connected ? 'connected' : 'disconnected'}`}
                onClick={handleLogoClick}
                style={{ cursor: 'pointer' }}
                title="Shift+Click for Emergency Bypass"
              >
                <Activity size={12} />
                <span>{connected ? 'Connected' : 'Offline'}</span>
              </div>
              <button className="global-logout-btn" onClick={handleLogout} title="Logout">
                <Power size={14} />
                <span>Logout</span>
              </button>
            </div>
            <Routes>
              <Route path="/" element={<Dashboard socketStats={stats} />} />
              <Route path="/devices" element={<Devices />} />
              <Route path="/map" element={<NetworkMap />} />
              <Route path="/settings" element={<Settings appName={appName} setAppName={setAppName} />} />
            </Routes>
          </main>
        </div>
      )}
    </BrowserRouter>
  );
}


export default App;
