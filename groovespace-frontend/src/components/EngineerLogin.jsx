import { useEffect, useState } from 'react';
import { FaChevronLeft, FaHeadphones, FaLock } from 'react-icons/fa';
import { API_URL } from '../api';
import './StaffDashboard.css';

export default function EngineerLogin({ onLoginSuccess, onCancel }) {
  const [engineers, setEngineers] = useState([]);
  const [engineerId, setEngineerId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/bands/engineers`)
      .then(async (response) => {
        if (!response.ok) throw new Error('No se pudieron cargar los perfiles de ingeniería.');
        setEngineers(await response.json());
      })
      .catch((requestError) => setError(requestError.message));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/engineers/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engineerId, username, password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo iniciar sesión.');
      onLoginSuccess(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-slide-transition" style={{ justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: 'min(100%, 420px)', margin: '0 auto' }}>
        <button onClick={onCancel} className="btn-back-console"><FaChevronLeft size={12} /><span>Volver al catálogo</span></button>
        <section className="console-section-card" style={{ marginTop: '24px' }}>
          <FaHeadphones size={24} color="var(--color-brand-primary)" />
          <h1 style={{ fontSize: '24px', color: 'var(--color-text-title)' }}>Acceso de ingeniería</h1>
          <form onSubmit={submit}>
            <label className="form-label-lux" htmlFor="engineer-profile">Perfil</label>
            <select id="engineer-profile" className="input-corporate" value={engineerId} onChange={(event) => setEngineerId(event.target.value)} required>
              <option value="">Selecciona tu perfil</option>
              {engineers.map((engineer) => <option key={engineer.id} value={engineer.id}>{engineer.name} · {engineer.specialty}</option>)}
            </select>
            <label className="form-label-lux" htmlFor="engineer-username" style={{ marginTop: '16px' }}>Usuario</label>
            <input id="engineer-username" className="input-corporate" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
            <label className="form-label-lux" htmlFor="engineer-password" style={{ marginTop: '16px' }}>Contraseña</label>
            <input id="engineer-password" type="password" className="input-corporate" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            {error && <p role="alert" style={{ color: 'var(--color-state-error)' }}>{error}</p>}
            <button type="submit" className="btn-action-submit-grand" style={{ marginTop: '20px' }} disabled={loading}>
              <FaLock size={12} /><span>{loading ? 'Validando...' : 'Entrar a mi agenda'}</span>
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}