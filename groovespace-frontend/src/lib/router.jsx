import { useEffect, useState } from 'react';

const EVENT = 'gs:navigate';

/** Navegación del lado del cliente sin recargar la página (History API). */
export const navigate = (to, { replace = false } = {}) => {
  window.history[replace ? 'replaceState' : 'pushState']({}, '', to);
  window.dispatchEvent(new Event(EVENT));
  const hash = typeof to === 'string' && to.includes('#') ? to.slice(to.indexOf('#') + 1) : '';
  if (!hash) { window.scrollTo({ top: 0 }); return; }
  // Con ancla: esperar al render de la página y desplazarse a la sección.
  let tries = 0;
  const seek = () => { const node = document.getElementById(hash); if (node) node.scrollIntoView(); else if (tries++ < 20) setTimeout(seek, 50); };
  setTimeout(seek, 0);
};

export const useLocation = () => {
  const read = () => ({ path: window.location.pathname.replace(/\/+$/, '') || '/', search: window.location.search });
  const [location, setLocation] = useState(read);
  useEffect(() => {
    const update = () => setLocation(read());
    window.addEventListener('popstate', update);
    window.addEventListener(EVENT, update);
    return () => { window.removeEventListener('popstate', update); window.removeEventListener(EVENT, update); };
  }, []);
  return location;
};

/** match('/b/:slug', '/b/los-nopales') → { slug: 'los-nopales' } | null */
export const match = (pattern, path) => {
  const a = pattern.split('/').filter(Boolean);
  const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
};

export function Link({ to, children, onClick, ...props }) {
  const handle = (event) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || props.target) return;
    event.preventDefault();
    navigate(to);
  };
  return <a href={to} onClick={handle} {...props}>{children}</a>;
}

export function Redirect({ to }) {
  useEffect(() => { navigate(to, { replace: true }); }, [to]);
  return null;
}
