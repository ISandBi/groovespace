import { useEffect, useState } from 'react';
import { FaBars, FaBell, FaTimes } from 'react-icons/fa';
import { Link, navigate, useLocation } from '../lib/router.jsx';
import { bandActor, clearSession, useSessions } from '../lib/session';
import { api, formatDateTime } from '../lib/http';
import { Modal } from './kit.jsx';

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
      <button className="gs-bell" onClick={toggle} aria-label={`Notificaciones${state.unread ? `, ${state.unread} nuevas` : ''}`}><FaBell size={15} />{state.unread > 0 && <b>{state.unread > 9 ? '9+' : state.unread}</b>}</button>
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
  const portal = sessions.staff ? ['/administracion', 'Administración'] : sessions.engineer ? ['/ingenieria', 'Mi panel'] : ['/banda', band ? band.name : 'Mi banda'];

  return (
    <>
      <nav className={`gs-nav ${open ? 'open' : ''}`} aria-label="Principal">
        <Link to="/" className="gs-brand"><i>♪</i>GrooveSpace</Link>
        <div className="gs-nav-links">{LINKS.map(([to, label]) => <Link key={to} to={to} className={isActive(to) ? 'active' : ''}>{label}</Link>)}</div>
        <div className="gs-nav-side">
          {token && <Bell token={typeof token === 'string' ? token : token.token} />}
          <Link to={portal[0]} className="gs-btn gs-btn--sm gs-btn--primary">{portal[1]}</Link>
          {(band || sessions.engineer || sessions.staff) && <button className="gs-btn gs-btn--sm" onClick={logout}>Salir</button>}
        </div>
        <button className="gs-burger" aria-label="Menú" onClick={() => setOpen(!open)}>{open ? <FaTimes /> : <FaBars />}</button>
      </nav>
      <div className="gs-app" key={path}>{children}</div>
      <footer className="gs-footer">
        <span>© GrooveSpace Studio · Ciudad de México</span>
        <span><Link to="/ingenieria">Ingenieros</Link> · <Link to="/administracion">Administración</Link></span>
      </footer>
    </>
  );
}
