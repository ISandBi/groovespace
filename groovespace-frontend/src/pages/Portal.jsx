import { api, assetUrl, formatDate, mxn } from '../lib/http';
import { Link, navigate, useLocation } from '../lib/router.jsx';
import { bandActor, useSessions } from '../lib/session';
import { Empty, Reveal, Skeleton, Tabs, useAsync } from '../ui/kit.jsx';
import Sessions from './portal/Sessions.jsx';
import Team from './portal/Team.jsx';
import Profile from './portal/Profile.jsx';
import Money from './portal/Money.jsx';
import Contracts from './portal/Contracts.jsx';
import { Files, Demos, Deliverables } from './portal/Media.jsx';

function Activity({ actor }) {
  const requests = useAsync(() => (['lider', 'tesorero'].includes(actor.role) ? api('/marketplace/band/requests', { token: actor.token }) : []), [actor.token]);
  const apps = useAsync(() => (['lider', 'tesorero'].includes(actor.role) ? api('/events/mine/applications', { token: actor.token }) : []), [actor.token]);
  const STATE = { pending: 'En revisión', accepted: 'Aceptada', waitlist: 'Lista de espera', rejected: 'No seleccionada', declined: 'Rechazada' };
  return (
    <div className="gs-grid gs-grid--2" style={{ alignItems: 'start' }}>
      <div className="gs-card"><h2 className="gs-h2">Solicitudes a ingenieros</h2>
        {requests.loading ? <Skeleton rows={2} /> : requests.data?.length ? <div className="gs-list">{requests.data.map((item) => <div className="gs-item" key={item._id}><div><b>{item.engineerName}</b><div className="gs-hint">{formatDate(item.date)} · {item.startTime} · {item.duration} h</div>{item.response && <div className="gs-hint">“{item.response}”</div>}</div><span className={`gs-badge ${item.status === 'accepted' ? 'gs-badge--ok' : ''}`}>{STATE[item.status] || item.status}</span></div>)}</div> : <Empty>Sin solicitudes. Explora el <Link to="/ingenieros">marketplace</Link>.</Empty>}
      </div>
      <div className="gs-card"><h2 className="gs-h2">Postulaciones a eventos</h2>
        {apps.loading ? <Skeleton rows={2} /> : apps.data?.length ? <div className="gs-list">{apps.data.map((item) => <div className="gs-item" key={item.id}><div><b>{item.event.title}</b><div className="gs-hint">{formatDate(item.event.date)} · {item.event.venue}</div>{item.reviewNote && <div className="gs-hint">{item.reviewNote}</div>}</div><span className={`gs-badge ${item.status === 'accepted' ? 'gs-badge--ok' : ''}`}>{STATE[item.status]}</span></div>)}</div> : <Empty>Aún no te postulas. Mira los <Link to="/eventos">eventos</Link>.</Empty>}
      </div>
    </div>
  );
}

function Overview({ actor, go }) {
  const calendar = useAsync(() => api('/band/calendar', { token: actor.token }), [actor.token]);
  const wallet = useAsync(() => (['lider', 'tesorero'].includes(actor.role) ? api('/wallet', { token: actor.token }) : null), [actor.token]);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (calendar.data || []).filter((item) => item.date >= today).slice(0, 3);
  const pendingPay = (calendar.data || []).filter((item) => ['deposit_pending', 'deposit_paid'].includes(item.paymentStatus) && item.date >= today);
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="gs-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}>
        {[['Próximas sesiones', upcoming.length], ['Pagos pendientes', pendingPay.length], ['Saldo en cartera', wallet.data ? mxn(wallet.data.balance) : '—']].map(([label, value], index) => <Reveal key={label} delay={index * 60} className="gs-card gs-stat"><strong>{value}</strong><span>{label}</span></Reveal>)}
      </div>
      <div className="gs-card"><div className="gs-row" style={{ justifyContent: 'space-between' }}><h2 className="gs-h2" style={{ margin: 0 }}>Lo que sigue</h2><button className="gs-btn gs-btn--sm" onClick={() => go('sesiones')}>Ver calendario</button></div>
        {upcoming.length ? <div className="gs-list" style={{ marginTop: 12 }}>{upcoming.map((item) => <div className="gs-item" key={item.id}><div><b style={{ color: 'var(--color-text-title)' }}>{item.roomName}</b><div className="gs-hint">{formatDate(item.date)} · {item.startTime} · {item.duration} h</div></div><span className="gs-badge">{item.attendance.filter((entry) => entry.status === 'going').length} confirmados</span></div>)}</div> : <div style={{ marginTop: 12 }}><Empty>No hay sesiones próximas. <Link to="/">Reserva una sala</Link>.</Empty></div>}
      </div>
    </div>
  );
}

const TABS = [['resumen', 'Resumen'], ['sesiones', 'Sesiones'], ['equipo', 'Equipo'], ['perfil', 'Perfil y escenario'], ['cartera', 'Cartera'], ['entregables', 'Entregables'], ['demos', 'Demos'], ['archivos', 'Archivos'], ['contratos', 'Contratos'], ['actividad', 'Actividad']];

export default function Portal() {
  const sessions = useSessions();
  const actor = bandActor(sessions);
  const { search } = useLocation();
  const tab = new URLSearchParams(search).get('tab') || 'resumen';
  const go = (id) => navigate(`/banda?tab=${id}`);
  if (!actor) return null;
  const visible = TABS.filter(([id]) => !(['cartera', 'demos'].includes(id) && actor.role === 'integrante' && id === 'demos'));
  return (
    <div className="gs-page">
      <div className="gs-page-head">
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {sessions.band?.logoPath && <img src={assetUrl(sessions.band.logoPath)} alt="" width="64" height="64" style={{ borderRadius: 0, objectFit: 'cover' }} />}
          <div><p className="gs-eyebrow">Portal de banda · {actor.role === 'lider' ? 'Líder' : actor.role === 'tesorero' ? 'Tesorero' : 'Integrante'}</p><h1 className="gs-h1">{actor.name}</h1></div>
        </div>
        <Link to="/" className="gs-btn gs-btn--primary">Reservar sala</Link>
      </div>
      <Tabs tabs={visible} value={tab} onChange={go} />
      {tab === 'resumen' && <Overview actor={actor} go={go} />}
      {tab === 'sesiones' && <Sessions actor={actor} />}
      {tab === 'reservas' && <Sessions actor={actor} />}
      {tab === 'equipo' && <Team actor={actor} />}
      {tab === 'perfil' && <Profile actor={actor} />}
      {tab === 'cartera' && <Money actor={actor} />}
      {tab === 'entregables' && <Deliverables actor={actor} />}
      {tab === 'demos' && <Demos actor={actor} />}
      {tab === 'archivos' && <Files actor={actor} />}
      {tab === 'contratos' && <Contracts actor={actor} />}
      {tab === 'actividad' && <Activity actor={actor} />}
    </div>
  );
}
