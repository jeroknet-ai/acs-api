import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import NetworkMap from './pages/NetworkMap';
import Settings from './pages/Settings';
import { useSocket } from './hooks/useSocket';
import { getSettings } from './services/api';
import './index.css';

function App() {
  const { connected, stats } = useSocket();
  const [appName, setAppName] = useState('MSNetwork');

  useEffect(() => {
    getSettings().then(res => {
      if (res.data.app_name) setAppName(res.data.app_name);
    }).catch(() => {});
  }, []);

  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar connected={connected} appName={appName} />
        <main className="main-content">
          <div className={`global-connection-status ${connected ? 'connected' : 'disconnected'}`}>
            <Activity size={12} />
            <span>{connected ? 'Connected' : 'Offline'}</span>
          </div>
          <Routes>
            <Route path="/" element={<Dashboard socketStats={stats} />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/map" element={<NetworkMap />} />
            <Route path="/settings" element={<Settings appName={appName} setAppName={setAppName} />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
