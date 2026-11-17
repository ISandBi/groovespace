import { useEffect, useState } from 'react';
import { IcAudio, IcMenu, IcBell, IcX, IcArrowRight } from './icons.jsx';
import { Link, navigate, useLocation } from '../lib/router.jsx';
import { bandActor, clearSession, useSessions } from '../lib/session';
import { api, formatDateTime } from '../lib/http';
import { Modal } from './kit.jsx';
import { SITE } from '../lib/site.js';

const LINKS = [['/', 'Salas'], ['/ingenieros', 'Ingenieros'], ['/bandas', 'Bandas'], ['/eventos', 'Eventos']];

function Bell({ token }) {
  const [state, setState] = useState({ items: [], unread: 0 });
  const [open, setOpen] = useState(false);
  const load = () => api('/notifications', { token }).then(setState).catch(() => {});
  useEffect(() => { load(); const timer = setInterval(load, 45000); return () => clearInterval(timer); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = async () => {
    setOpen(true);
    if (state.unread) { await api('/notifications/read-all', { method: 'POST', token }).catch(() => {}); setState((current) => ({ ...current, unread: 0 })); }
  };
  return (
    <>
      <button className="gs-bell" onClick={toggle} aria-label={`Notificaciones${state.unread ? `, ${state.unread} nuevas` : ''}`}><IcBell size={18} />{state.unread > 0 && <b>{state.unread > 9 ? '9+' : state.unread}</b>}</button>
      {open && (
        <Modal title="Notificaciones" onClose={() => setOpen(false)}>
          {state.items.length === 0 ? <p className="gs-hint">Todo al día. Aquí verás recordatorios, pagos y mensajes.</p> : (
            <div className="gs-list">{state.items.map((item) => (
              <div className="gs-item" key={item._id} style={{ opacity: item.readAt ? .65 : 1 }}>
                <div><strong style={{ color: 'var(--color-text-title)' }}>{item.title}</strong><div className="gs-hint">{item.body}</div><div className="gs-hint">{formatDateTime(item.createdAt)}</div></div>
                {item.link && <button className="gs-btn gs-btn--sm" onClick={() => { setOpen(false); navigate(item.link); }}>Abrir</button>}
              </div>))}</div>)}
        </Modal>
      )}
    </>
  );
}

export function Shell({ children }) {
  const { path } = useLocation();
  const sessions = useSessions();
  const [open, setOpen] = useState(false);
  const band = bandActor(sessions);
  const token = band?.token || sessions.engineer?.token || sessions.staff;
  useEffect(() => setOpen(false), [path]);

  const logout = () => {
    ['band', 'member', 'engineer', 'staff'].forEach(clearSession);
    navigate('/');
  };
  const isActive = (to) => (to === '/' ? path === '/' : path.startsWith(to));
  const signedIn = Boolean(band || sessions.engineer || sessions.staff);
  const portal = sessions.staff ? ['/administracion', 'Administración'] : sessions.engineer ? ['/ingenieria', 'Mi panel'] : ['/banda', band ? band.name : 'Mi banda'];

  return (
    <>
      <a className="gs-skip" href="#contenido">Saltar al contenido</a>
      <nav className={`gs-nav ${open ? 'open' : ''}`} aria-label="Principal">
        <Link to="/" className="gs-brand"><i><IcAudio size={18} /></i>GrooveSpace</Link>
        <div className="gs-nav-links">{LINKS.map(([to, label]) => <Link key={to} to={to} className={isActive(to) ? 'active' : ''} aria-current={isActive(to) ? 'page' : undefined}>{label}</Link>)}</div>
        <div className="gs-nav-side">
          {token && <Bell token={typeof token === 'string' ? token : token.token} />}
          {signedIn ? (
            <>
              <Link to={portal[0]} className="gs-btn gs-btn--sm gs-btn--primary">{portal[1]}</Link>
              <button className="gs-btn gs-btn--sm" onClick={logout}>Cerrar sesión</button>
            </>
          ) : (
            <>
              <Link to="/ingreso" className="gs-btn gs-btn--sm gs-btn--text">Entrar</Link>
              <Link to="/#catalogo" className="gs-btn gs-btn--sm gs-btn--primary">Reservar sala <IcArrowRight size={16} className="gs-arrow" /></Link>
            </>
          )}
        </div>
        <button className="gs-burger" aria-label={open ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <IcX size={22} /> : <IcMenu size={22} />}</button>
      </nav>
      <main id="contenido" className="gs-app" key={path}>{children}</main>
      <footer className="gs-footer">
        <div className="gs-wrap">
          <div className="gs-footer-grid">
            <div className="gs-footer-brand">
              <Link to="/" className="gs-brand"><i><IcAudio size={18} /></i>GrooveSpace</Link>
              <p>Salas de ensayo y grabación en {SITE.city}. Reserva por internet, paga con anticipo y entra con tu código QR.</p>
            </div>
            <div className="gs-footer-col"><h4>Plataforma</h4><Link to="/">Salas</Link><Link to="/ingenieros">Ingenieros</Link><Link to="/bandas">Bandas</Link><Link to="/eventos">Eventos</Link></div>
            <div className="gs-footer-col"><h4>Contacto</h4><a href={`mailto:${SITE.email}`}>{SITE.email}</a><span>{SITE.phone}</span><span>{SITE.hours}</span></div>
            <div className="gs-footer-col"><h4>Equipo</h4><Link to="/ingenieria">Acceso ingenieros</Link><Link to="/administracion">Administración</Link></div>
          </div>
          <div className="gs-footer-base"><span>© {new Date().getFullYear()} GrooveSpace Studio · {SITE.city}</span><span>Pagos protegidos conforme a PCI DSS y NIST CSF</span></div>
        </div>
      </footer>
    </>
  );
}
