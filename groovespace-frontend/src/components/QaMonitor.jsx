import { useEffect, useRef, useState } from 'react';
import { API_URL } from '../api';
import './QaMonitor.css';

const TOKEN_STORAGE_KEY = 'groovespace.qaToken';
const SESSION_STORAGE_KEY = 'groovespace.qaSessionId';

const createSessionId = () => (
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
);

const readError = async (response) => {
  try {
    const data = await response.json();
    return data.error || `La API respondió HTTP ${response.status}.`;
  } catch {
    return `La API respondió HTTP ${response.status} con un formato inesperado.`;
  }
};

export default function QaMonitor() {
  const [tokenInput, setTokenInput] = useState('');
  const [activeToken, setActiveToken] = useState(() => {
    try {
      return sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('disconnected');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const testWindowRef = useRef(null);
  const sessionIdRef = useRef('');

  useEffect(() => {
    if (!activeToken) return;
    try {
      sessionIdRef.current = sessionStorage.getItem(SESSION_STORAGE_KEY) || createSessionId();
      sessionStorage.setItem(SESSION_STORAGE_KEY, sessionIdRef.current);
    } catch (storageError) {
      console.warn('[GrooveSpace QA] No se pudo recuperar la sesión temporal.', storageError);
    }
  }, [activeToken]);

  useEffect(() => {
    if (!activeToken) return undefined;
    const controller = new AbortController();

    const connect = async () => {
      setStatus('connecting');
      setError('');
      try {
        const response = await fetch(`${API_URL}/qa/events/stream`, {
          headers: { Authorization: `Bearer ${activeToken}` },
          signal: controller.signal
        });
        if (!response.ok) throw new Error(await readError(response));
        if (!response.body) throw new Error('El navegador no permite leer el flujo de eventos.');

        setStatus('connected');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!controller.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split(/\r?\n\r?\n/);
          buffer = blocks.pop() || '';

          for (const block of blocks) {
            const data = block.split(/\r?\n/)
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trim())
              .join('\n');
            if (!data) continue;
            try {
              const event = JSON.parse(data);
              if (event.error) throw new Error(event.error);
              setEvents((current) => (
                current.some((item) => item._id === event._id)
                  ? current
                  : [event, ...current].slice(0, 100)
              ));
            } catch (parseError) {
              if (parseError instanceof SyntaxError) {
                console.warn('[GrooveSpace QA] Se ignoró un evento SSE con JSON inválido.');
              } else {
                throw parseError;
              }
            }
          }
        }
        if (!controller.signal.aborted) setStatus('disconnected');
      } catch (connectionError) {
        if (controller.signal.aborted) return;
        setStatus('disconnected');
        setError(connectionError.message || 'No se pudo conectar con el monitor QA.');
      }
    };

    connect();
    return () => controller.abort();
  }, [activeToken]);

  useEffect(() => {
    const handleTestAppReady = (event) => {
      if (event.origin !== window.location.origin || event.data?.type !== 'groovespace-qa-ready') return;
      if (!testWindowRef.current || event.source !== testWindowRef.current) return;
      event.source.postMessage({
        type: 'groovespace-qa-auth',
        token: activeToken,
        sessionId: sessionIdRef.current
      }, window.location.origin);
    };

    window.addEventListener('message', handleTestAppReady);
    return () => window.removeEventListener('message', handleTestAppReady);
  }, [activeToken]);

  const handleConnect = async (event) => {
    event.preventDefault();
    const token = tokenInput.trim();
    if (!token) {
      setError('Escribe el token de acceso QA que te proporcionó el administrador.');
      return;
    }

    setError('');
    try {
      const response = await fetch(`${API_URL}/qa/events?limit=1`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error(await readError(response));

      const sessionId = createSessionId();
      try {
        sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
        sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
      } catch {
        throw new Error('El navegador bloqueó el almacenamiento temporal de la sesión QA.');
      }
      sessionIdRef.current = sessionId;
      setEvents([]);
      setActiveToken(token);
      setTokenInput('');
    } catch (connectError) {
      setError(connectError.message || 'No se pudo validar el token QA.');
    }
  };

  const handleDisconnect = () => {
    try {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (storageError) {
      console.warn('[GrooveSpace QA] No se pudo borrar la sesión temporal.', storageError);
    }
    if (testWindowRef.current && !testWindowRef.current.closed) testWindowRef.current.close();
    testWindowRef.current = null;
    sessionIdRef.current = '';
    setActiveToken('');
    setEvents([]);
    setStatus('disconnected');
    setError('');
  };

  const handleOpenTestApp = () => {
    if (!activeToken) return;
    const testWindow = window.open('/', '_blank');
    if (!testWindow) {
      setError('El navegador bloqueó la pestaña nueva. Permite ventanas emergentes para abrir el sitio de pruebas.');
      return;
    }
    testWindowRef.current = testWindow;
  };

  const visibleEvents = filter === 'all'
    ? events
    : events.filter((event) => event.severity === filter);

  return (
    <main className="qa-monitor">
      <header className="qa-header">
        <a className="qa-brand" href="/">GROOVE<span>SPACE</span></a>
        <span className={`qa-connection qa-connection-${status}`}>
          <i />
          {status === 'connected' ? 'MONITOR EN VIVO' : status === 'connecting' ? 'CONECTANDO' : 'DESCONECTADO'}
        </span>
      </header>

      <section className="qa-intro">
        <p className="qa-eyebrow">ENTORNO DE VALIDACIÓN</p>
        <h1>Centro de pruebas <span>QA</span></h1>
        <p>Ejecuta pruebas del sitio y observa la actividad registrada en tiempo real.</p>
      </section>

      {!activeToken ? (
        <form className="qa-access-card" onSubmit={handleConnect}>
          <div className="qa-card-icon">01</div>
          <div>
            <h2>Acceso de evaluador</h2>
            <p>Solicita el token QA al administrador. Se mantiene solo en esta pestaña y no aparece en la dirección web.</p>
          </div>
          <label htmlFor="qa-token">Token de acceso</label>
          <input
            id="qa-token"
            type="password"
            autoComplete="off"
            value={tokenInput}
            onChange={(event) => setTokenInput(event.target.value)}
            placeholder="Pega aquí el token proporcionado"
          />
          {error && <p className="qa-error" role="alert">{error}</p>}
          <button className="qa-primary-button" type="submit">Conectar monitor</button>
        </form>
      ) : (
        <section className="qa-workspace">
          <div className="qa-toolbar">
            <div>
              <strong>Sesión QA activa</strong>
              <p>Abre la aplicación para comenzar. Los eventos aparecerán aquí.</p>
            </div>
            <div className="qa-toolbar-actions">
              <button className="qa-primary-button" onClick={handleOpenTestApp} type="button">Abrir sitio para probar</button>
              <button className="qa-secondary-button" onClick={handleDisconnect} type="button">Cerrar sesión QA</button>
            </div>
          </div>

          {error && <p className="qa-error" role="alert">{error}</p>}

          <section className="qa-events-panel" aria-label="Eventos de QA">
            <div className="qa-events-heading">
              <div>
                <p className="qa-eyebrow">ACTIVIDAD</p>
                <h2>Registro en tiempo real <span>{events.length}</span></h2>
              </div>
              <label className="qa-filter">
                <span>Filtrar</span>
                <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                  <option value="all">Todos los eventos</option>
                  <option value="critical">Críticos</option>
                  <option value="warning">Advertencias</option>
                  <option value="info">Informativos</option>
                </select>
              </label>
            </div>

            {visibleEvents.length === 0 ? (
              <div className="qa-empty-state">
                <div className="qa-pulse-mark" />
                <strong>{status === 'connected' ? 'Esperando actividad' : 'Conectando con el monitor'}</strong>
                <p>Cuando pruebes el sitio, los eventos se mostrarán aquí automáticamente.</p>
              </div>
            ) : (
              <ol className="qa-event-list">
                {visibleEvents.map((item) => (
                  <li className={`qa-event qa-event-${item.severity || 'info'}`} key={item._id}>
                    <div className="qa-event-indicator" />
                    <div className="qa-event-content">
                      <div className="qa-event-title-row">
                        <strong>{item.description || item.summary || item.eventType}</strong>
                        <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
                      </div>
                      <p>{item.method ? `${item.method} ` : ''}{item.route || item.eventType}</p>
                      {item.statusCode && <span className="qa-event-meta">HTTP {item.statusCode}{item.durationMs ? ` · ${item.durationMs} ms` : ''}</span>}
                    </div>
                    <span className="qa-severity">{item.severity || 'info'}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </section>
      )}

      <footer className="qa-footer">
        El monitor solo registra actividad marcada como QA. No recopila contraseñas ni contenido del portapapeles.
      </footer>
    </main>
  );
}
