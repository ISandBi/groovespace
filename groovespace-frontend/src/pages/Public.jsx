import { useEffect, useState } from 'react';
import { FaStar } from 'react-icons/fa';
import { api, assetUrl, formatDate, mxn, API_URL } from '../lib/http';
import { Link, navigate } from '../lib/router.jsx';
import { bandActor, useSessions } from '../lib/session';
import { Empty, ErrorNote, Field, Modal, Reveal, Skeleton, toast, useAsync } from '../ui/kit.jsx';
import SecurePlayer from '../components/SecurePlayer.jsx';
import { Ticket3D } from '../components/TicketCard.jsx';
import { loadCatalog } from '../lib/quote';

const Logo = ({ band, size = 56 }) => <img src={assetUrl(band.logoPath)} alt="" width={size} height={size} style={{ borderRadius: 14, objectFit: 'cover', background: '#2a2133' }} />;

// ---------- Directorio de bandas y perfil público (EPK) ----------
export function Directory() {
  const [filters, setFilters] = useState({ q: '', genre: '', district: '' });
  const list = useAsync(() => api(`/epk?${new URLSearchParams(Object.entries(filters).filter(([, value]) => value))}`), [filters.q, filters.genre, filters.district]);
  return (
    <div className="gs-page">
      <div className="gs-page-head"><div><p className="gs-eyebrow">Comunidad</p><h1 className="gs-h1">Bandas en GrooveSpace</h1></div></div>
      <div className="gs-grid gs-grid--2" style={{ marginBottom: 20 }}>
        {[['q', 'Buscar por nombre'], ['genre', 'Género'], ['district', 'Alcaldía o colonia']].map(([key, label]) => <label className="gs-field" key={key}><span>{label}</span><input value={filters[key]} onChange={(event) => setFilters({ ...filters, [key]: event.target.value })} /></label>)}
      </div>
      {list.loading ? <Skeleton rows={3} /> : list.error ? <ErrorNote error={list.error} /> : list.data.length === 0 ? <Empty>Todavía no hay perfiles públicos con esos filtros.</Empty> : (
        <div className="gs-grid">{list.data.map((band, index) => (
          <Reveal key={band.slug} delay={index * 40}><Link to={`/b/${band.slug}`} className="gs-card gs-card--hover" style={{ display: 'flex', gap: 14, alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
            <Logo band={band} /><div><b style={{ color: 'var(--color-text-title)' }}>{band.name}</b><div className="gs-hint">{[band.genre, band.district].filter(Boolean).join(' · ') || 'Perfil en construcción'}</div><span className="gs-badge">{band.members + 1} integrantes</span></div>
          </Link></Reveal>))}</div>)}
    </div>
  );
}

export function PublicEpk({ slug }) {
  const profile = useAsync(() => api(`/epk/${encodeURIComponent(slug)}`), [slug]);
  if (profile.loading) return <div className="gs-page"><Skeleton rows={3} /></div>;
  if (profile.error) return <div className="gs-page"><ErrorNote error={profile.error} /><Link to="/bandas" className="gs-btn">Ver todas las bandas</Link></div>;
  const band = profile.data;
  return (
    <div className="gs-page" style={{ maxWidth: 900 }}>
      <div className="gs-card" style={{ display: 'flex', flexWrap: 'wrap', gap: 22, alignItems: 'center' }}>
        <Logo band={band} size={110} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <p className="gs-eyebrow">Electronic press kit</p>
          <h1 className="gs-h1">{band.name}</h1>
          <div className="gs-row" style={{ marginTop: 10 }}>{band.genre && <span className="gs-badge gs-badge--ok">{band.genre}</span>}{band.district && <span className="gs-badge">{band.district}</span>}<span className="gs-badge">Desde {new Date(band.since).getFullYear()}</span></div>
        </div>
      </div>
      {band.bio && <div className="gs-card" style={{ marginTop: 18 }}><h2 className="gs-h2">Sobre la banda</h2><p style={{ color: 'var(--color-text-body)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{band.bio}</p></div>}
      <div className="gs-grid gs-grid--2" style={{ marginTop: 18 }}>
        <div className="gs-card"><h2 className="gs-h2">Integrantes</h2><div className="gs-list">{band.members.map((member, index) => <div className="gs-item" key={index}><b>{member.name}</b><span className="gs-hint">{member.instrument}</span></div>)}{band.members.length === 0 && <span className="gs-hint">Aún no hay integrantes registrados.</span>}</div></div>
        <div className="gs-card"><h2 className="gs-h2">Instrumentos</h2><div className="gs-row">{band.instruments.map((item, index) => <span className="gs-badge" key={index}>{item.name}</span>)}</div>
          {band.pressLinks?.length > 0 && <><h2 className="gs-h2" style={{ marginTop: 18 }}>En línea</h2><div className="gs-list">{band.pressLinks.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer noopener" className="gs-btn gs-btn--sm">{link.label || link.url}</a>)}</div></>}</div>
      </div>
    </div>
  );
}

// ---------- Eventos y boletos ----------
const readTickets = () => { try { return JSON.parse(localStorage.getItem('groovespace.eventTickets') || '[]'); } catch { return []; } };

function BuyTickets({ event, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', quantity: 1 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [free, setFree] = useState(null);
  const buy = async (submitEvent) => {
    submitEvent.preventDefault(); setBusy(true); setError('');
    try {
      const data = await api(`/events/${event.id}/tickets`, { method: 'POST', body: { ...form, quantity: Number(form.quantity) } });
      if (data.checkoutUrl) { window.location.assign(data.checkoutUrl); return; }
      try { localStorage.setItem('groovespace.eventTickets', JSON.stringify([data.ticket, ...readTickets()].slice(0, 30))); } catch { /* sin almacenamiento */ }
      setFree(data.ticket);
    } catch (requestError) { setError(requestError.message); } finally { setBusy(false); }
  };
  return (
    <Modal title={`Boletos · ${event.title}`} onClose={onClose} wide={Boolean(free)}>
      {free ? <Ticket3D code={free.code} title={free.eventTitle} subtitle={free.venue} details={[['Fecha', formatDate(free.date)], ['Hora', free.startTime], ['Boletos', String(free.quantity)], ['A nombre de', free.buyerName]]} status="Boleto vigente" /> : (
        <form onSubmit={buy}>
          <Field label="Nombre completo"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Correo" hint="Aquí avisamos cambios del evento."><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Boletos (máx. 6)"><input type="number" min="1" max="6" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Field>
          <div className="gs-quote-total"><span className="gs-hint">Total</span><strong>{event.ticketPrice ? mxn(event.ticketPrice * form.quantity) : 'Gratis'}</strong></div>
          <ErrorNote error={error} />
          <button className="gs-btn gs-btn--primary gs-btn--block" style={{ marginTop: 12 }} disabled={busy}>{busy ? 'Procesando…' : event.ticketPrice ? 'Continuar al pago' : 'Obtener boletos'}</button>
        </form>)}
    </Modal>
  );
}

export function Events() {
  const sessions = useSessions();
  const actor = bandActor(sessions);
  const events = useAsync(() => api('/events'), []);
  const apps = useAsync(() => (actor ? api('/events/mine/applications', { token: actor.token }).catch(() => []) : []), [actor?.token]);
  const [buying, setBuying] = useState(null);
  const [applying, setApplying] = useState(null);
  const [message, setMessage] = useState('');
  const [mine] = useState(readTickets);
  const [showMine, setShowMine] = useState(null);
  const applied = new Map((apps.data || []).map((item) => [item.event._id || item.event.id, item]));

  const apply = async () => {
    try { await api(`/events/${applying.id}/apply`, { method: 'POST', token: actor.token, body: { message } }); toast('Postulación enviada'); setApplying(null); setMessage(''); apps.reload(); }
    catch (requestError) { toast(requestError.message, 'err'); }
  };
  return (
    <div className="gs-page">
      <div className="gs-page-head"><div><p className="gs-eyebrow">Escena local</p><h1 className="gs-h1">Eventos</h1></div>{mine.length > 0 && <button className="gs-btn" onClick={() => setShowMine(mine)}>Mis boletos ({mine.length})</button>}</div>
      {events.loading ? <Skeleton rows={3} /> : events.error ? <ErrorNote error={events.error} /> : events.data.length === 0 ? <Empty>No hay eventos próximos. Vuelve pronto.</Empty> : (
        <div className="gs-grid gs-grid--2">{events.data.map((event, index) => {
          const mineApp = applied.get(event.id);
          return (
            <Reveal key={event.id} delay={index * 50} className="gs-card gs-card--hover">
              <div className="gs-row" style={{ justifyContent: 'space-between' }}><span className="gs-badge gs-badge--ok">{formatDate(event.date)} · {event.startTime}</span><span className="gs-badge">{event.venue}</span></div>
              <h3 style={{ margin: '14px 0 6px', fontSize: 20, color: 'var(--color-text-title)' }}>{event.title}</h3>
              <p className="gs-hint">{event.description}</p>
              {event.requirements && <p className="gs-hint"><b>Requisitos:</b> {event.requirements}</p>}
              <div className="gs-row" style={{ marginTop: 14 }}>
                <button className="gs-btn gs-btn--primary gs-btn--sm" disabled={event.status !== 'open' || event.ticketsLeft === 0} onClick={() => setBuying(event)}>{event.ticketsLeft === 0 ? 'Agotado' : event.ticketPrice ? `Boletos ${mxn(event.ticketPrice)}` : 'Boletos gratis'}</button>
                {event.status === 'open' && actor && (mineApp ? <span className={`gs-badge ${mineApp.status === 'accepted' ? 'gs-badge--ok' : ''}`}>Postulación: {{ pending: 'en revisión', accepted: 'aceptada', waitlist: 'lista de espera', rejected: 'no seleccionada' }[mineApp.status]}</span> : <button className="gs-btn gs-btn--sm" onClick={() => setApplying(event)}>Postular mi banda</button>)}
                <span className="gs-hint">{event.ticketsLeft} boletos disponibles · cartel de {event.lineupSlots}</span>
              </div>
            </Reveal>);
        })}</div>)}
      {buying && <BuyTickets event={buying} onClose={() => setBuying(null)} />}
      {applying && <Modal title={`Postular a ${applying.title}`} onClose={() => setApplying(null)}><Field label="Mensaje para la producción" hint="Cuéntales por qué su cartel te necesita."><textarea value={message} maxLength={800} onChange={(e) => setMessage(e.target.value)} /></Field><button className="gs-btn gs-btn--primary" onClick={apply}>Enviar postulación</button></Modal>}
      {showMine && <Modal title="Mis boletos" wide onClose={() => setShowMine(null)}><div style={{ display: 'grid', gap: 18 }}>{showMine.map((ticket) => <Ticket3D key={ticket.code} code={ticket.code} title={ticket.eventTitle} subtitle={ticket.venue} details={[['Fecha', formatDate(ticket.date)], ['Hora', ticket.startTime], ['Boletos', String(ticket.quantity)], ['A nombre de', ticket.buyerName]]} status="Boleto vigente" />)}</div></Modal>}
    </div>
  );
}

// ---------- Marketplace de ingenieros ----------
const Stars = ({ value }) => <span style={{ color: 'var(--color-booking-maintenance)', whiteSpace: 'nowrap' }}>{value ? <><FaStar /> {value.toFixed(1)}</> : 'Sin reseñas'}</span>;

function EngineerDetail({ engineer, actor, onClose }) {
  const reviews = useAsync(() => api(`/marketplace/engineers/${engineer.id}/reviews`), [engineer.id]);
  const eligibility = useAsync(() => (actor ? api(`/marketplace/engineers/${engineer.id}/review-eligibility`, { token: actor.token }).catch(() => ({ eligible: [] })) : { eligible: [] }), [engineer.id, actor?.token]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [request, setRequest] = useState({ roomId: 'sala_estudio_a', date: '', startTime: '16:00', duration: 2, message: '' });
  const catalog = useAsync(loadCatalog, []);
  const send = async () => { try { await api(`/marketplace/engineers/${engineer.id}/requests`, { method: 'POST', token: actor.token, body: { ...request, duration: Number(request.duration) } }); toast('Solicitud enviada'); } catch (e) { toast(e.message, 'err'); } };
  const review = async () => { try { await api(`/marketplace/engineers/${engineer.id}/reviews`, { method: 'POST', token: actor.token, body: { rating, comment } }); toast('Gracias por tu reseña'); setComment(''); reviews.reload(); eligibility.reload(); } catch (e) { toast(e.message, 'err'); } };
  return (
    <Modal title={engineer.name} onClose={onClose} wide>
      <p className="gs-hint">{engineer.specialty} · {engineer.genres.join(', ')} · {mxn(engineer.hourlyRate)}/h · demos de {engineer.demoKinds.join(' y ')}</p>
      {engineer.bio && <p style={{ color: 'var(--color-text-body)' }}>{engineer.bio}</p>}
      <h3 className="gs-h2">Portafolio (escucha sin descargar)</h3>
      {engineer.samples.length === 0 ? <p className="gs-hint">Aún no hay muestras.</p> : <div className="gs-list">{engineer.samples.map((sample) => <SecurePlayer key={sample.id} label={`${sample.title}${sample.genre ? ` · ${sample.genre}` : ''}`} loadUrl={async () => `${API_URL}/marketplace/engineers/${engineer.id}/samples/${sample.id}/stream`} />)}</div>}
      <h3 className="gs-h2" style={{ marginTop: 20 }}>Reseñas</h3>
      {reviews.data?.length ? <div className="gs-list">{reviews.data.map((item) => <div className="gs-item" key={item.id}><div><Stars value={item.rating} /> <b style={{ marginLeft: 8 }}>{item.band?.name}</b><div className="gs-hint">{item.comment}</div></div></div>)}</div> : <p className="gs-hint">Todavía no hay reseñas.</p>}
      {eligibility.data?.eligible?.length > 0 && <div className="gs-card" style={{ marginTop: 14 }}><b>Califica tu sesión</b><Field label="Estrellas"><select value={rating} onChange={(e) => setRating(Number(e.target.value))}>{[5, 4, 3, 2, 1].map((n) => <option key={n}>{n}</option>)}</select></Field><Field label="Comentario"><textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={800} /></Field><button className="gs-btn gs-btn--sm gs-btn--primary" onClick={review}>Publicar reseña</button></div>}
      <h3 className="gs-h2" style={{ marginTop: 20 }}>Solicitud directa</h3>
      {actor ? (
        <div className="gs-grid gs-grid--2" style={{ gap: 12 }}>
          <Field label="Sala"><select value={request.roomId} onChange={(e) => setRequest({ ...request, roomId: e.target.value })}>{(catalog.data?.rooms || []).map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></Field>
          <Field label="Fecha"><input type="date" value={request.date} onChange={(e) => setRequest({ ...request, date: e.target.value })} /></Field>
          <Field label="Hora"><input type="time" value={request.startTime} onChange={(e) => setRequest({ ...request, startTime: e.target.value })} /></Field>
          <Field label="Horas"><select value={request.duration} onChange={(e) => setRequest({ ...request, duration: e.target.value })}>{[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}</select></Field>
          <div style={{ gridColumn: '1 / -1' }}><Field label="Mensaje"><textarea value={request.message} onChange={(e) => setRequest({ ...request, message: e.target.value })} maxLength={600} /></Field><button className="gs-btn gs-btn--primary" onClick={send} disabled={!request.date}>Enviar solicitud</button></div>
        </div>
      ) : <p className="gs-hint">Inicia sesión como banda para enviar una solicitud. <Link to="/registro">Entrar o registrarme</Link></p>}
    </Modal>
  );
}

export function Engineers() {
  const actor = bandActor(useSessions());
  const [filters, setFilters] = useState({ genre: '', maxRate: '', kind: '', date: '', sort: 'rating' });
  const list = useAsync(() => api(`/marketplace/engineers?${new URLSearchParams(Object.entries(filters).filter(([, value]) => value))}`), [filters.genre, filters.maxRate, filters.kind, filters.date, filters.sort]);
  const [open, setOpen] = useState(null);
  useEffect(() => { document.title = 'Ingenieros · GrooveSpace'; }, []);
  const set = (key) => (event) => setFilters({ ...filters, [key]: event.target.value });
  return (
    <div className="gs-page">
      <div className="gs-page-head"><div><p className="gs-eyebrow">Marketplace</p><h1 className="gs-h1">Ingenieros de audio</h1></div></div>
      <div className="gs-grid" style={{ marginBottom: 22, gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>
        <Field label="Género"><input value={filters.genre} onChange={set('genre')} placeholder="Rock, Jazz…" /></Field>
        <Field label="Tarifa máx./h"><input type="number" min="0" value={filters.maxRate} onChange={set('maxRate')} /></Field>
        <Field label="Tipo de demo"><select value={filters.kind} onChange={set('kind')}><option value="">Todos</option><option value="audio">Audio</option><option value="video">Video en vivo</option></select></Field>
        <Field label="Disponible el"><input type="date" value={filters.date} onChange={set('date')} /></Field>
        <Field label="Ordenar"><select value={filters.sort} onChange={set('sort')}><option value="rating">Mejor calificados</option><option value="price">Menor precio</option></select></Field>
      </div>
      {list.loading ? <Skeleton rows={3} /> : list.error ? <ErrorNote error={list.error} /> : list.data.length === 0 ? <Empty>Ningún ingeniero coincide con esos filtros.</Empty> : (
        <div className="gs-grid">{list.data.map((engineer, index) => (
          <Reveal key={engineer.id} delay={index * 50} className="gs-card gs-card--hover">
            <div className="gs-row" style={{ justifyContent: 'space-between' }}><b style={{ fontSize: 18, color: 'var(--color-text-title)' }}>{engineer.name}</b><Stars value={engineer.rating} /></div>
            <p className="gs-hint">{engineer.specialty}</p>
            <div className="gs-row">{engineer.genres.map((genre) => <span className="gs-badge" key={genre}>{genre}</span>)}</div>
            <div className="gs-row" style={{ margin: '12px 0' }}><span className="gs-price">{mxn(engineer.hourlyRate)}<small>/h</small></span><span className="gs-badge gs-badge--violet">Demo: {engineer.demoKinds.map((kind) => (kind === 'video' ? 'video en vivo' : 'audio')).join(' / ')}</span></div>
            {engineer.busy && <p className="gs-hint">{engineer.busy.length ? `Ocupado: ${engineer.busy.map((slot) => `${slot.startTime} (${slot.duration} h)`).join(', ')}` : 'Libre ese día'}</p>}
            <button className="gs-btn gs-btn--sm" onClick={() => setOpen(engineer)}>Ver perfil · {engineer.samples.length} muestras · {engineer.reviews} reseñas</button>
          </Reveal>))}</div>)}
      {open && <EngineerDetail engineer={open} actor={actor} onClose={() => setOpen(null)} />}
    </div>
  );
}
export { navigate };
