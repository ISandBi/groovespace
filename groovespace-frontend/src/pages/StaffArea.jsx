import { useState } from 'react';
import { IcLock } from '../ui/icons.jsx';
import { api, formatDate, mxn } from '../lib/http';
import { clearSession, readSession, saveSession, useSessions } from '../lib/session';
import { Empty, ErrorNote, Field, Modal, Skeleton, Tabs, toast, useAsync } from '../ui/kit.jsx';
import LiveRooms from '../components/LiveRooms.jsx';
import QrScanner from '../components/QrScanner.jsx';
import ChatBox from '../components/ChatBox.jsx';
import { assetUrl } from '../lib/http';

function Login() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try { const data = await api('/staff/login', { method: 'POST', body: form }); saveSession('staff', data.token); } catch (requestError) { setError(requestError.message); setBusy(false); }
  };
  return (
    <div className="gs-page" style={{ maxWidth: 440 }}>
      <form className="gs-card" onSubmit={submit}><IcLock color="var(--color-brand-primary)" size={24} /><h1 className="gs-h1" style={{ fontSize: 28, margin: '10px 0 16px' }}>Administración</h1>
        <Field label="Usuario"><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="username" required /></Field>
        <Field label="Contraseña"><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="current-password" required /></Field>
        <ErrorNote error={error} /><button className="gs-btn gs-btn--primary gs-btn--block" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button></form>
    </div>
  );
}

function Today({ token, refreshKey, onChange }) {
  const today = useAsync(() => api('/staff/checkin/today', { token }), [token, refreshKey]);
  if (today.loading) return <Skeleton rows={2} />;
  if (!today.data?.length) return <Empty>No hay sesiones confirmadas hoy.</Empty>;
  return <div className="gs-list">{today.data.map((item) => <div className="gs-item" key={item.id}><div><b style={{ color: 'var(--color-text-title)' }}>{item.bandName}</b><div className="gs-hint">{item.roomName} · {item.startTime} · {item.duration} h{item.balanceAmount ? ` · saldo ${mxn(item.balanceAmount)}` : ''}</div></div><span className={`gs-badge ${item.checkedInAt ? 'gs-badge--violet' : 'gs-badge--ok'}`}>{item.checkedInAt ? 'Ya ingresó' : 'Esperando'}</span></div>)}</div>;
}

function EventForm({ token, onDone, onClose }) {
  const [form, setForm] = useState({ title: '', description: '', date: '', startTime: '20:00', venue: 'GrooveSpace · Sala principal', requirements: '', applicationDeadline: '', lineupSlots: 4, ticketPrice: 150, ticketCapacity: 100, status: 'open' });
  const [error, setError] = useState('');
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const submit = async () => { try { await api('/events', { method: 'POST', token, body: { ...form, lineupSlots: Number(form.lineupSlots), ticketPrice: Number(form.ticketPrice), ticketCapacity: Number(form.ticketCapacity), applicationDeadline: form.applicationDeadline || undefined } }); toast('Evento creado'); onDone(); } catch (requestError) { setError(requestError.message); } };
  return (
    <Modal title="Nuevo evento" wide onClose={onClose}>
      <div className="gs-grid gs-grid--2" style={{ gap: 12 }}>
        <Field label="Título"><input value={form.title} onChange={set('title')} /></Field><Field label="Lugar"><input value={form.venue} onChange={set('venue')} /></Field>
        <Field label="Fecha"><input type="date" value={form.date} onChange={set('date')} /></Field><Field label="Hora"><input type="time" value={form.startTime} onChange={set('startTime')} /></Field>
        <Field label="Cierre de postulaciones"><input type="date" value={form.applicationDeadline} onChange={set('applicationDeadline')} /></Field><Field label="Bandas en el cartel"><input type="number" min="1" max="30" value={form.lineupSlots} onChange={set('lineupSlots')} /></Field>
        <Field label="Precio del boleto (MXN, 0 = gratis)"><input type="number" min="0" max="5000" value={form.ticketPrice} onChange={set('ticketPrice')} /></Field><Field label="Aforo"><input type="number" min="0" max="5000" value={form.ticketCapacity} onChange={set('ticketCapacity')} /></Field>
      </div>
      <Field label="Descripción"><textarea value={form.description} onChange={set('description')} /></Field>
      <Field label="Requisitos para postular"><textarea value={form.requirements} onChange={set('requirements')} style={{ minHeight: 60 }} /></Field>
      <Field label="Estado inicial"><select value={form.status} onChange={set('status')}><option value="open">Abierto (visible y con ventas)</option><option value="draft">Borrador</option></select></Field>
      <ErrorNote error={error} /><button className="gs-btn gs-btn--primary" onClick={submit} disabled={!form.title || !form.date}>Crear evento</button>
    </Modal>
  );
}

function Applications({ event, token, onClose }) {
  const apps = useAsync(() => api(`/events/${event.id}/applications`, { token }), [event.id]);
  const decide = async (id, status) => { try { await api(`/events/${event.id}/applications/${id}/decision`, { method: 'POST', token, body: { status } }); apps.reload(); } catch (error) { toast(error.message, 'err'); } };
  return (
    <Modal title={`Postulaciones · ${event.title}`} wide onClose={onClose}>
      {apps.loading ? <Skeleton rows={2} /> : apps.data?.length ? <div className="gs-list">{apps.data.map((item) => (
        <div className="gs-item" key={item.id}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><img src={assetUrl(item.band?.logoPath)} alt="" width="44" height="44" style={{ borderRadius: 0, objectFit: 'cover' }} /><div><b>{item.band?.name}</b><div className="gs-hint">{item.band?.genre} · {item.message || 'Sin mensaje'}</div></div></div>
          <div className="gs-row"><span className="gs-badge">{item.status}</span>{['accepted', 'waitlist', 'rejected'].map((status) => <button key={status} className={`gs-btn gs-btn--sm ${item.status === status ? 'gs-btn--primary' : ''}`} onClick={() => decide(item.id, status)}>{{ accepted: 'Aceptar', waitlist: 'Espera', rejected: 'Rechazar' }[status]}</button>)}</div>
        </div>))}</div> : <Empty>Aún no hay postulaciones.</Empty>}
    </Modal>
  );
}

function EventsAdmin({ token }) {
  const events = useAsync(() => api('/events/admin/all', { token }), [token]);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState(null);
  const setStatus = async (event, status) => { try { await api(`/events/${event.id}`, { method: 'PATCH', token, body: { status } }); events.reload(); } catch (error) { toast(error.message, 'err'); } };
  return (
    <div>
      <div className="gs-row" style={{ justifyContent: 'flex-end', marginBottom: 14 }}><button className="gs-btn gs-btn--primary gs-btn--sm" onClick={() => setCreating(true)}>Nuevo evento</button></div>
      {events.loading ? <Skeleton rows={2} /> : events.data?.length ? <div className="gs-grid gs-grid--2">{events.data.map((event) => (
        <div className="gs-card" key={event.id}>
          <div className="gs-row" style={{ justifyContent: 'space-between' }}><span className="gs-badge gs-badge--ok">{formatDate(event.date)} · {event.startTime}</span><span className="gs-badge">{event.status}</span></div>
          <h3 style={{ color: 'var(--color-text-title)', margin: '12px 0 4px' }}>{event.title}</h3>
          <p className="gs-hint">{event.venue} · boletos {event.soldTickets}/{event.ticketCapacity} · {event.ticketPrice ? mxn(event.ticketPrice) : 'gratis'}</p>
          <div className="gs-row"><button className="gs-btn gs-btn--sm" onClick={() => setViewing(event)}>Postulaciones</button>{['open', 'closed', 'cancelled', 'draft'].filter((status) => status !== event.status).map((status) => <button key={status} className="gs-btn gs-btn--sm" onClick={() => setStatus(event, status)}>{{ open: 'Abrir', closed: 'Cerrar', cancelled: 'Cancelar', draft: 'Borrador' }[status]}</button>)}</div>
        </div>))}</div> : <Empty>No hay eventos.</Empty>}
      {creating && <EventForm token={token} onClose={() => setCreating(false)} onDone={() => { setCreating(false); events.reload(); }} />}
      {viewing && <Applications event={viewing} token={token} onClose={() => setViewing(null)} />}
    </div>
  );
}

const collected = (reservation) => (reservation.isDemo ? 0 : reservation.paymentStatus === 'paid' ? reservation.totalPrice : reservation.paymentStatus === 'deposit_paid' ? reservation.depositAmount : 0);

function Operations({ token }) {
  const data = useAsync(async () => {
    const headers = { token };
    const [bands, reservations] = await Promise.all([api('/bands/all', headers), api('/reservations/all', headers)]);
    return { bands, reservations };
  }, [token]);
  const [chat, setChat] = useState(null);
  const remove = async (band) => {
    if (!window.confirm(`¿Eliminar permanentemente a "${band.name}"? Se borran integrantes, archivos, demos, reservas y notificaciones. No se emiten reembolsos.`)) return;
    try { const result = await api(`/bands/${encodeURIComponent(band._id)}`, { method: 'DELETE', token }); toast(result.warning || 'Banda eliminada'); data.reload(); } catch (error) { toast(error.message, 'err'); }
  };
  if (data.loading) return <Skeleton rows={3} />;
  if (data.error) return <ErrorNote error={data.error} />;
  const { bands, reservations } = data.data;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = reservations.filter((item) => !item.isDemo && item.date >= today && item.paymentStatus !== 'expired');
  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <div className="gs-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
        {[['Bandas', bands.length], ['Sesiones próximas', upcoming.length], ['Cobrado', mxn(reservations.reduce((sum, item) => sum + collected(item), 0))], ['Saldos por cobrar', mxn(reservations.filter((item) => !item.isDemo && item.paymentStatus === 'deposit_paid').reduce((sum, item) => sum + item.balanceAmount, 0))]].map(([label, value]) => <div key={label} className="gs-card gs-stat"><strong>{value}</strong><span>{label}</span></div>)}
      </div>
      <div className="gs-card"><h2 className="gs-h2">Próximas sesiones</h2>
        {upcoming.length === 0 ? <Empty>Sin sesiones próximas.</Empty> : <div className="gs-list">{upcoming.slice(0, 40).map((item) => <div className="gs-item" key={item._id}><div><b style={{ color: 'var(--color-text-title)' }}>{item.bandId?.name || 'Banda'}</b><div className="gs-hint">{item.roomName} · {formatDate(item.date)} · {item.startTime} · {item.duration} h</div></div><div className="gs-row"><span className="gs-badge">{item.paymentStatus}</span><button className="gs-btn gs-btn--sm" onClick={() => setChat(item)}>Chat</button></div></div>)}</div>}
      </div>
      <div className="gs-card"><h2 className="gs-h2">Bandas</h2>
        <div className="gs-list">{bands.map((band) => <div className="gs-item" key={band._id}><div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><img src={assetUrl(band.logoPath)} alt="" width="40" height="40" style={{ borderRadius: 0, objectFit: 'cover' }} /><div><b>{band.name}</b><div className="gs-hint">Líder {band.leaderName} · {band.members?.length || 0} integrantes · {band.instruments?.length || 0} instrumentos</div></div></div><button className="gs-btn gs-btn--sm gs-btn--danger" onClick={() => remove(band)}>Eliminar</button></div>)}</div>
      </div>
      {chat && <Modal title={`Chat · ${chat.bandId?.name}`} onClose={() => setChat(null)}><ChatBox reservationId={chat._id} token={token} selfType="staff" /></Modal>}
    </div>
  );
}

export default function StaffArea() {
  const sessions = useSessions();
  const [tab, setTab] = useState('vivo');
  const [tick, setTick] = useState(0);
  const token = sessions.staff;
  if (!token) return <Login />;
  return (
    <div className="gs-page">
      <div className="gs-page-head"><div><p className="gs-eyebrow">Consola de operaciones</p><h1 className="gs-h1">Recepción y administración</h1></div><button className="gs-btn gs-btn--sm" onClick={() => clearSession('staff')}>Cerrar sesión</button></div>
      <Tabs tabs={[['vivo', 'En vivo'], ['checkin', 'Check-in'], ['eventos', 'Eventos'], ['operacion', 'Bandas y sesiones']]} value={tab} onChange={setTab} />
      {tab === 'vivo' && <LiveRooms token={token} refreshKey={tick} />}
      {tab === 'checkin' && <div style={{ display: 'grid', gap: 24 }}><QrScanner token={token} onChange={() => setTick((value) => value + 1)} /><div className="gs-card"><h2 className="gs-h2">Sesiones de hoy</h2><Today token={token} refreshKey={tick} /></div></div>}
      {tab === 'eventos' && <EventsAdmin token={token} />}
      {tab === 'operacion' && <Operations token={token} />}
    </div>
  );
}
export { readSession };
