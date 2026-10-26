import { useEffect, useState } from 'react';
import { FaUsers, FaMoneyBillWave, FaClock, FaChevronLeft, FaHeadphones, FaTrash } from 'react-icons/fa';
import './StaffDashboard.css';
import { API_ORIGIN, API_URL } from '../api';

const formatDate = (date, time) => `${new Date(`${date}T${time}:00`).toLocaleDateString('es-MX', { dateStyle: 'medium' })} · ${time}`;
const getCollected = (reservation) => reservation.isDemo ? 0 : reservation.paymentStatus === 'paid'
  ? reservation.totalPrice
  : reservation.paymentStatus === 'deposit_paid' ? reservation.depositAmount : 0;

export default function StaffDashboard({ onClose, token }) {
  const [bands, setBands] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingBandId, setDeletingBandId] = useState('');

  useEffect(() => {
    const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API_URL}/bands/all`, { headers }),
      fetch(`${API_URL}/reservations/all`, { headers }),
      fetch(`${API_URL}/bands/engineers`)
    ]).then(async ([bandsResponse, reservationsResponse, engineersResponse]) => {
      const [bandsData, reservationsData, engineersData] = await Promise.all([
        bandsResponse.json(), reservationsResponse.json(), engineersResponse.json()
      ]);
      if (!bandsResponse.ok || !reservationsResponse.ok) {
        throw new Error(bandsData.error || reservationsData.error || 'No se pudo cargar la consola de operaciones.');
      }
      setBands(bandsData);
      setReservations(reservationsData);
      setEngineers(engineersResponse.ok ? engineersData : []);
    }).catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [token]);

  const today = new Date().toISOString().slice(0, 10);
  const upcomingReservations = reservations.filter((reservation) => !reservation.isDemo && reservation.date >= today && reservation.paymentStatus !== 'expired');
  const collected = reservations.reduce((total, reservation) => total + getCollected(reservation), 0);
  const pendingBalances = reservations.filter((reservation) => !reservation.isDemo && reservation.paymentStatus === 'deposit_paid')
    .reduce((total, reservation) => total + reservation.balanceAmount, 0);

  const deleteBand = async (band) => {
    const confirmed = window.confirm(
      `¿Eliminar permanentemente a "${band.name}"? También se borrarán sus integrantes, instrumentos, archivos, reservas, horarios y el historial local de pagos asociado. No se enviarán reembolsos a Stripe. Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;
    setDeletingBandId(band._id);
    setError('');
    try {
      const response = await fetch(`${API_URL}/bands/${encodeURIComponent(band._id)}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo eliminar la banda.');
      setBands((current) => current.filter((item) => item._id !== band._id));
      setReservations((current) => current.filter((reservation) => String(reservation.bandId?._id || reservation.bandId) !== band._id));
      if (result.warning) setError(result.warning);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDeletingBandId('');
    }
  };

  return (
    <div style={{ backgroundColor: 'var(--color-surface-background)', minHeight: '100vh' }}>
      <header className="premium-header">
        <div className="header-staff-flex">
          <button onClick={onClose} className="btn-back-console"><FaChevronLeft size={12} /><span>Volver al catálogo</span></button>
          <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--color-brand-accent)', textTransform: 'uppercase' }}>Consola de Operaciones</span>
        </div>
      </header>

      <main className="staff-layout">
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: '800', margin: '0 0 6px', color: 'var(--color-text-title)' }}>Operación GrooveSpace</h1>
          <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '14px' }}>Reservas, ingresos y asignaciones de ingeniería.</p>
        </div>

        {error && <div role="alert" style={{ backgroundColor: 'rgba(220,53,69,.08)', color: 'var(--color-state-error)', padding: '14px', marginBottom: '20px' }}>{error}</div>}

        <div className="metrics-row">
          <div className="metric-card"><h2><FaMoneyBillWave color="var(--color-booking-available)" /> Cobrado</h2><p className="metric-number">{loading ? '...' : `$${collected.toLocaleString('es-MX')} MXN`}</p></div>
          <div className="metric-card"><h2><FaUsers color="var(--color-brand-primary)" /> Bandas</h2><p className="metric-number">{loading ? '...' : bands.length}</p></div>
          <div className="metric-card"><h2><FaClock color="var(--color-booking-maintenance)" /> Sesiones futuras</h2><p className="metric-number">{loading ? '...' : upcomingReservations.length}</p></div>
        </div>
        <p style={{ marginTop: '-18px', marginBottom: '28px', color: 'var(--color-text-muted)', fontSize: '13px' }}>Saldo pendiente de reservas apartadas: ${pendingBalances.toLocaleString('es-MX')} MXN</p>

        <section style={{ marginBottom: '36px' }}>
          <h2 style={{ fontSize: '18px', color: 'var(--color-text-title)' }}>Perfiles de ingeniería</h2>
          <div className="metrics-row">
            {engineers.map((engineer) => (
              <article className="metric-card" key={engineer.id}>
                <h3 style={{ margin: '0 0 8px', color: 'var(--color-text-title)' }}><FaHeadphones /> {engineer.name}</h3>
                <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '13px' }}>{engineer.specialty}</p>
                <p style={{ margin: '12px 0 0', fontSize: '12px' }}>{upcomingReservations.filter((reservation) => reservation.engineerId === engineer.id).length} sesiones próximas</p>
              </article>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: '36px' }}>
          <h2 style={{ fontSize: '18px', color: 'var(--color-text-title)' }}>Calendario de sesiones</h2>
          <div className="table-container-lux" style={{ overflowX: 'auto' }}>
            <table className="staff-table">
              <thead><tr><th>Fecha y hora</th><th>Sala</th><th>Banda</th><th>Ingeniero</th><th>Pago</th></tr></thead>
              <tbody>
                {upcomingReservations.map((reservation) => (
                  <tr key={reservation._id}>
                    <td>{formatDate(reservation.date, reservation.startTime)}</td>
                    <td>{reservation.roomName}</td>
                    <td>{reservation.bandId?.name || 'Banda'}</td>
                    <td>{engineers.find((engineer) => engineer.id === reservation.engineerId)?.name || 'No requiere'}</td>
                    <td><span className={`badge-status ${reservation.paymentStatus === 'paid' ? 'success' : ''}`}>{reservation.paymentStatus === 'paid' ? 'Liquidado' : reservation.paymentStatus === 'deposit_paid' ? 'Anticipo' : 'Pendiente'}</span></td>
                  </tr>
                ))}
                {!loading && upcomingReservations.length === 0 && <tr><td colSpan="5">No hay sesiones futuras.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: '18px', color: 'var(--color-text-title)' }}>Directorio de bandas</h2>
          <div className="table-container-lux" style={{ overflowX: 'auto' }}>
            <table className="staff-table">
              <thead><tr><th>Identidad</th><th>Banda</th><th>Líder</th><th>Equipo registrado</th><th>Ingeniero</th><th>Acciones</th></tr></thead>
              <tbody>
                {bands.map((band) => (
                  <tr key={band._id}>
                    <td><img src={`${API_ORIGIN}${band.logoPath}`} alt={band.name} className="band-mini-logo" onError={(event) => { event.currentTarget.src = '/logo-banda-placeholder.png'; }} /></td>
                    <td style={{ fontWeight: '700', color: 'var(--color-text-title)' }}>{band.name}</td>
                    <td>{band.leaderName}</td>
                    <td>{(band.instruments || []).length} instrumentos · {(band.members || []).length} integrantes</td>
                    <td>{engineers.find((engineer) => engineer.id === band.engineerId)?.name || 'No requiere'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-delete-band"
                        onClick={() => deleteBand(band)}
                        disabled={Boolean(deletingBandId)}
                        aria-label={`Eliminar banda ${band.name}`}
                      >
                        <FaTrash aria-hidden="true" /> {deletingBandId === band._id ? 'Eliminando…' : 'Eliminar'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && bands.length === 0 && <tr><td colSpan="6">No hay bandas registradas.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}