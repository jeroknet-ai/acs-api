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
  const [isAuthenticated, setIsAuthenticated] = useState(localStorage.getItem('jnetwork_auth') === 'true');

  const handleLogout = () => {
    localStorage.removeItem('jnetwork_auth');
    setIsAuthenticated(false);
  };

  useEffect(() => {
    getSettings().then(res => {
      if (res.data.app_name) setAppName(res.data.app_name);
    }).catch(() => {});
  }, []);

  return (
    <BrowserRouter>
      {!isAuthenticated ? (
        <Login onLogin={() => setIsAuthenticated(true)} />
      ) : (
        <div className="app-layout">
          <Sidebar connected={connected} appName={appName} onLogout={handleLogout} />
          <main className="main-content">
            <div className="top-header-actions">
            <div className={`global-connection-status ${connected ? 'connected' : 'disconnected'}`}>
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
