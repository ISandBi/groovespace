import { useState } from 'react';
import { FaLock, FaChevronLeft, FaShieldAlt } from 'react-icons/fa';
import './StaffDashboard.css'; // <-- Inyectar la hoja para heredar la clase .btn-back-console y .input-corporate
import { API_URL } from '../api';

export default function StaffLogin({ onLoginSuccess, onCancel }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStaffSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${API_URL}/staff/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo autenticar al staff.');
      onLoginSuccess(data.token);
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-slide-transition" style={{ padding: '40px 24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', top: '24px', left: '24px' }}>
        <button onClick={onCancel} className="btn-back-console">
          <FaChevronLeft size={12} />
          <span>Regresar al catálogo</span>
        </button>
      </div>

      <div style={{ maxWidth: '400px', width: '100%', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(132, 73, 253, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', color: 'var(--color-brand-primary)' }}>
            <FaShieldAlt size={24} />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 6px 0', color: 'var(--color-text-title)' }}>Consola de Operadores</h2>
          <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '13px' }}>Área restringida para personal administrativo de GrooveSpace</p>
        </div>

        <form onSubmit={handleStaffSubmit} className="console-section-card" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <label className="form-label-lux">Identificador de Usuario</label>
            <input 
              type="text" 
              className="input-corporate" 
              required 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              autoComplete="username"
              placeholder="Usuario de staff" 
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label className="form-label-lux">Clave de Acceso Corporativa</label>
            <input 
              type="password" 
              className="input-corporate" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              autoComplete="current-password"
              placeholder="••••••••" 
            />
          </div>

          {errorMsg && (
            <div style={{ backgroundColor: 'rgba(220, 53, 69, 0.08)', border: '1px solid var(--color-state-error)', color: 'var(--color-state-error)', padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', marginBottom: '20px', textAlign: 'center' }}>
              {errorMsg}
            </div>
          )}

          <button type="submit" className="btn-action-submit-grand" disabled={loading}>
            <FaLock size={12} />
            <span>{loading ? 'Validando...' : 'Autenticar Operador'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
