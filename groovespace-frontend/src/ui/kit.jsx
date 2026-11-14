import { useCallback, useEffect, useRef, useState } from 'react';
import './design.css';

/** Aparece suavemente al entrar al viewport. */
export function Reveal({ as: Tag = 'div', delay = 0, className = '', children, ...props }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') { setShown(true); return undefined; }
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setShown(true); observer.disconnect(); } }, { threshold: 0.12 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <Tag ref={ref} className={`reveal ${shown ? 'in' : ''} ${className}`} style={{ '--d': `${delay}ms` }} {...props}>{children}</Tag>;
}

/** Carga datos y expone { data, error, loading, reload }. */
export const useAsync = (loader, deps) => {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: '' }));
    Promise.resolve().then(loader).then((data) => { if (!cancelled) setState({ data, error: '', loading: false }); })
      .catch((error) => { if (!cancelled) setState({ data: null, error: error.message || 'No se pudo cargar.', loading: false }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...(deps || []), tick]);
  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { ...state, reload };
};

// Avisos breves (toasts) accesibles desde cualquier módulo.
const listeners = new Set();
export const toast = (message, tone = 'ok') => listeners.forEach((listener) => listener({ id: Math.random(), message, tone }));
export function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const listener = (item) => { setItems((current) => [...current, item]); setTimeout(() => setItems((current) => current.filter((entry) => entry.id !== item.id)), 4200); };
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);
  return <div className="gs-toasts" role="status" aria-live="polite">{items.map((item) => <div key={item.id} className={`gs-toast ${item.tone}`}>{item.message}</div>)}</div>;
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="gs-modal-back" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="gs-card gs-modal" role="dialog" aria-modal="true" aria-label={title} style={wide ? { width: 'min(820px,100%)' } : undefined}>
        <div className="gs-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}><h2 className="gs-h2" style={{ margin: 0 }}>{title}</h2><button className="gs-btn gs-btn--sm" onClick={onClose}>Cerrar</button></div>
        {children}
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return <div className="gs-tabs" role="tablist">{tabs.map(([id, label, badge]) => <button key={id} role="tab" aria-selected={value === id} className={value === id ? 'active' : ''} onClick={() => onChange(id)}>{label}{badge ? ` · ${badge}` : ''}</button>)}</div>;
}

export const Field = ({ label, hint, children }) => <label className="gs-field"><span>{label}</span>{children}{hint && <small className="gs-hint">{hint}</small>}</label>;
export const Empty = ({ children }) => <div className="gs-empty">{children}</div>;
export const Skeleton = ({ rows = 3 }) => <div className="gs-list">{Array.from({ length: rows }, (_, index) => <div key={index} className="gs-skeleton" style={{ height: 58 }} />)}</div>;
export const ErrorNote = ({ error }) => (error ? <p className="gs-error" role="alert">{error}</p> : null);
