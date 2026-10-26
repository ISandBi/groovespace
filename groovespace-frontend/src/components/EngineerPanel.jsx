import { useEffect, useState } from 'react';
import { FaChevronLeft, FaCalendarAlt, FaMapMarkerAlt, FaUsers, FaSyncAlt } from 'react-icons/fa';
import { API_URL } from '../api';
import './StaffDashboard.css';

const formatDate = (value) => new Date(`${value}T12:00:00`).toLocaleDateString('es-MX', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
});

const fetchSchedule = async (token, signal) => {
  const response = await fetch(`${API_URL}/engineers/me/schedule`, {
    headers: { Authorization: `Bearer ${token}` },
    signal
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'No se pudo cargar tu agenda.');
  return data;
};

export default function EngineerPanel({ session, onClose }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshSchedule = async () => {
    setLoading(true);
    setError('');
    try {
      setSessions(await fetchSchedule(session.token));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchSchedule(session.token, controller.signal)
      .then(setSessions)
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [session.token]);

  const groupedSessions = sessions.reduce((groups, item) => {
    (groups[item.date] ||= []).push(item);
    return groups;
  }, {});

  return (
    <main className="page-slide-transition" style={{ overflowY: 'auto' }}>
      <header className="premium-header">
        <div className="header-staff-flex">
          <button onClick={onClose} className="btn-back-console"><FaChevronLeft size={12} /><span>Salir</span></button>
          <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--color-brand-accent)', textTransform: 'uppercase' }}>Agenda de ingeniería</span>
        </div>
      </header>
      <section className="staff-layout">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '28px' }}>
          <div>
            <h1 style={{ margin: 0, color: 'var(--color-text-title)', fontSize: '26px' }}>{session.engineer.name}</h1>
            <p style={{ color: 'var(--color-text-muted)', margin: '6px 0 0' }}>{session.engineer.specialty}</p>
          </div>
          <button type="button" className="btn-grid-action" onClick={refreshSchedule} disabled={loading} aria-label="Actualizar agenda" title="Actualizar agenda"><FaSyncAlt /></button>
        </div>

        {error && <p role="alert" style={{ color: 'var(--color-state-error)' }}>{error}</p>}
        {loading ? <p role="status">Cargando agenda...</p> : sessions.length === 0 ? (
          <section className="console-section-card" style={{ textAlign: 'center', padding: '36px 20px' }}>
            <FaCalendarAlt size={24} color="var(--color-brand-primary)" />
            <p style={{ color: 'var(--color-text-muted)' }}>No tienes sesiones confirmadas próximas.</p>
          </section>
        ) : Object.entries(groupedSessions).map(([date, entries]) => (
          <section key={date} style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '16px', textTransform: 'capitalize', color: 'var(--color-text-title)' }}>{formatDate(date)}</h2>
            <div className="table-container-lux" style={{ overflowX: 'auto' }}>
              <table className="staff-table">
                <thead><tr><th>Hora</th><th>Sala</th><th>Banda</th><th>Integrantes</th><th>Backline</th></tr></thead>
                <tbody>{entries.map((item) => (
                  <tr key={item._id}>
                    <td style={{ fontWeight: '800' }}>{item.startTime} · {item.duration} h</td>
                    <td><FaMapMarkerAlt /> {item.roomName}</td>
                    <td>{item.bandId?.name || 'Banda'}</td>
                    <td><FaUsers /> {item.attendees}</td>
                    <td>{item.rentedGear?.length ? item.rentedGear.map((gear) => gear.name).join(', ') : 'Sin renta'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        ))}
      </section>
    </main>
  );
}