import { useEffect, useState } from 'react';
import { FaUsers } from 'react-icons/fa';
import './BookingScreen.css';
import { API_URL } from '../api';

export default function InviteScreen({ token }) {
  const [bandName, setBandName] = useState('');
  const [name, setName] = useState('');
  const [instrument, setInstrument] = useState('');
  const [error, setError] = useState('');
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/bands/invite/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'La invitación no está disponible.');
        setBandName(data.bandName);
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [token]);

  const joinBand = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/bands/invite/${encodeURIComponent(token)}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, instrument })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo aceptar la invitación.');
      setJoined(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-slide-transition" style={{ justifyContent: 'center', padding: '24px' }}>
      <form onSubmit={joinBand} className="console-section-card" style={{ width: 'min(100%, 460px)', margin: '0 auto' }}>
        <FaUsers size={28} color="var(--color-brand-primary)" />
        <h1 style={{ fontSize: '24px', color: 'var(--color-text-title)' }}>{loading && !bandName ? 'Verificando invitación' : bandName || 'Invitación GrooveSpace'}</h1>
        {joined ? (
          <p>Ya formas parte de {bandName}. Puedes cerrar esta ventana.</p>
        ) : (
          <>
            <label className="form-label-lux" htmlFor="member-name">Tu nombre</label>
            <input id="member-name" className="input-corporate" value={name} onChange={(event) => setName(event.target.value)} required disabled={loading || !bandName} />
            <label className="form-label-lux" htmlFor="member-instrument" style={{ marginTop: '16px' }}>Instrumento o rol</label>
            <input id="member-instrument" className="input-corporate" value={instrument} onChange={(event) => setInstrument(event.target.value)} required disabled={loading || !bandName} />
            {error && <p role="alert" style={{ color: 'var(--color-state-error)' }}>{error}</p>}
            <button className="btn-action-submit-grand" style={{ marginTop: '20px' }} disabled={loading || !bandName}>
              {loading ? 'Procesando...' : 'Unirme a la banda'}
            </button>
          </>
        )}
      </form>
    </main>
  );
}