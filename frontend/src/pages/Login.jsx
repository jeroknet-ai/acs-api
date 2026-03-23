import React, { useState } from 'react';
import { Lock, User, LogIn, Wifi } from 'lucide-react';
import api from '../services/api';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.post('/auth/login', { username, password });
      if (res.data.success) {
        localStorage.setItem('jnetwork_auth', 'true');
        onLogin();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal terhubung ke server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <span>JNetwork</span>
          </div>
          <p>Monitoring & Management System</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          {error && <div className="login-error">{error}</div>}
          
          <div className="login-group">
            <label>Username</label>
            <div className="input-with-icon">
              <User size={18} />
              <input 
                type="text" 
                placeholder="Masukkan username" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="login-group">
            <label>Password</label>
            <div className="input-with-icon">
              <Lock size={18} />
              <input 
                type="password" 
                placeholder="Masukkan password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Masuk...' : (
              <>
                <span>Login</span>
                <LogIn size={18} />
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>© 2026 JNetwork · Secure Access</p>
        </div>
      </div>

      <style>{`
        .login-page {
          height: 100vh;
          width: 100vw;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #eef3fa;
          background-image: radial-gradient(circle at 20% 30%, rgba(33, 150, 243, 0.05) 0%, transparent 40%);
          font-family: 'Inter', sans-serif;
        }

        .login-card {
          width: 100%;
          max-width: 400px;
          background: #ffffff;
          border: 1px solid #d0ddef;
          border-radius: 20px;
          padding: 40px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
        }

        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .login-logo {
          margin-bottom: 8px;
        }

        .login-logo span {
          font-size: 2.2rem;
          font-weight: 800;
          color: #1e40af;
          letter-spacing: -0.02em;
        }

        .login-header p {
          color: #5a7394;
          font-size: 0.9rem;
          font-weight: 500;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .login-error {
          background: #fff5f5;
          color: #e53e3e;
          padding: 12px;
          border-radius: 10px;
          font-size: 0.85rem;
          text-align: center;
          border: 1px solid #fed7d7;
        }

        .login-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .login-group label {
          color: #1a2d45;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .input-with-icon {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-with-icon svg {
          position: absolute;
          left: 14px;
          color: #5a7394;
        }

        .input-with-icon input {
          width: 100%;
          background: #ffffff;
          border: 1px solid #d0ddef;
          border-radius: 10px;
          padding: 12px 12px 12px 42px;
          color: #1a2d45;
          font-size: 0.95rem;
          transition: all 0.2s ease;
        }

        .input-with-icon input:focus {
          outline: none;
          border-color: #1e40af;
          box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.1);
        }

        .login-btn {
          margin-top: 10px;
          background: #1e40af;
          color: white;
          border: none;
          border-radius: 10px;
          padding: 14px;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.2s ease;
        }

        .login-btn:hover {
          background: #1d368b;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(30, 64, 175, 0.2);
        }

        .login-footer {
          margin-top: 32px;
          text-align: center;
          color: #5a7394;
          font-size: 0.8rem;
        }
      `}</style>
    </div>
  );
}
