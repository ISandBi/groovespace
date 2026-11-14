import { useEffect, useState, lazy, Suspense } from 'react';
import './index.css';
import './ui/design.css';
import { API_URL, installQaRequestTagging } from './api';
import { api } from './lib/http';
import { Redirect, match, navigate, useLocation } from './lib/router.jsx';
import { saveSession, useSessions } from './lib/session';
import { Shell } from './ui/Shell.jsx';
import { Toaster, Skeleton } from './ui/kit.jsx';
import IntroScreen from './components/IntroScreen';
import QaMonitor from './components/QaMonitor';
import SimulatedCheckout from './components/SimulatedCheckout';
import PaymentReturn from './components/PaymentReturn';
import InviteScreen from './components/InviteScreen';
import Home from './pages/Home.jsx';
import Quote from './pages/Quote.jsx';
import Booking from './pages/Booking.jsx';
import Access from './pages/Access.jsx';
import { Directory, PublicEpk, Events, Engineers } from './pages/Public.jsx';

const Portal = lazy(() => import('./pages/Portal.jsx'));
const EngineerArea = lazy(() => import('./pages/EngineerArea.jsx'));
const StaffArea = lazy(() => import('./pages/StaffArea.jsx'));

installQaRequestTagging();

export default function App() {
  useEffect(() => {
    const handleQaAuth = (event) => {
      if (event.origin !== window.location.origin ||
          event.source !== window.opener ||
          event.data?.type !== 'groovespace-qa-auth' ||
          typeof event.data.token !== 'string' ||
          event.data.token.length < 32 ||
          typeof event.data.sessionId !== 'string' ||
          !/^[a-zA-Z0-9_-]{8,80}$/.test(event.data.sessionId)) return;

      try {
        if (sessionStorage.getItem('groovespace.qaToken') === event.data.token &&
            sessionStorage.getItem('groovespace.qaSessionId') === event.data.sessionId) return;
        sessionStorage.setItem('groovespace.qaToken', event.data.token);
        sessionStorage.setItem('groovespace.qaSessionId', event.data.sessionId);
        window.location.reload();
      } catch (error) {
        console.error('[GrooveSpace QA] No se pudo activar la sesión de prueba.', error);
      }
    };

    window.addEventListener('message', handleQaAuth);
    let hasQaSession = false;
    try {
      hasQaSession = Boolean(sessionStorage.getItem('groovespace.qaToken'));
    } catch (error) {
      console.warn('[GrooveSpace QA] No se pudo comprobar la sesión de prueba.', error);
    }
    if (!hasQaSession && window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: 'groovespace-qa-ready' }, window.location.origin);
    }
    return () => window.removeEventListener('message', handleQaAuth);
  }, []);

  useEffect(() => {
    let qaToken = '';
    try {
      qaToken = sessionStorage.getItem('groovespace.qaToken') || '';
    } catch (error) {
      console.warn('[GrooveSpace QA] No se pudo leer la sesión de telemetría QA.', error);
      return undefined;
    }
    if (!qaToken) return undefined;

    let qaSessionId;
    try {
      qaSessionId = sessionStorage.getItem('groovespace.qaSessionId');
      if (!qaSessionId) {
        qaSessionId = typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem('groovespace.qaSessionId', qaSessionId);
      }
    } catch (error) {
      console.warn('[GrooveSpace QA] No se pudo preparar la sesión de telemetría QA.', error);
      return undefined;
    }
    const sendUiEvent = (eventType) => {
      fetch(`${API_URL}/qa/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${qaToken}` },
        body: JSON.stringify({ eventType, route: window.location.pathname, qaSessionId })
      }).then((response) => {
        if (!response.ok) console.warn(`[GrooveSpace QA] No se registró ${eventType} (HTTP ${response.status}).`);
      }).catch((error) => console.warn(`[GrooveSpace QA] No se pudo enviar ${eventType}.`, error));
    };
    sendUiEvent('ui_navigation');
    const handleCopy = () => sendUiEvent('ui_copy');
    document.addEventListener('copy', handleCopy);
    return () => document.removeEventListener('copy', handleCopy);
  }, []);

  const [hasEntered, setHasEntered] = useState(() => sessionStorage.getItem('groovespace.introSeen') === 'true');
  const { path, search } = useLocation();
  const sessions = useSessions();
  const params = new URLSearchParams(search);
  const paymentState = params.get('payment');
  const memberAccess = params.get('member_access');

  // Enlace personal de integrante (?member_access=…): abre la sesión del integrante y limpia la URL.
  useEffect(() => {
    if (!memberAccess) return;
    api('/band/me', { token: memberAccess }).then((me) => {
      saveSession('member', { memberId: me.type, bandId: me.bandId, bandName: me.bandName, name: me.name, role: me.role, accessToken: memberAccess });
      navigate('/banda', { replace: true });
    }).catch(() => navigate('/', { replace: true }));
  }, [memberAccess]);

  if (path === '/qa') return <QaMonitor />;
  if (!hasEntered) {
    return <IntroScreen onEnter={() => { sessionStorage.setItem('groovespace.introSeen', 'true'); setHasEntered(true); }} />;
  }

  const inviteToken = path.match(/^\/invite\/([^/]+)$/)?.[1];
  let page;
  let params2;
  if (memberAccess) page = <div className="gs-page"><Skeleton rows={2} /></div>;
  else if (inviteToken) page = <InviteScreen token={inviteToken} />;
  else if (paymentState === 'simulated') page = <SimulatedCheckout />;
  else if (paymentState) page = <PaymentReturn />;
  else if (path === '/') page = <Home />;
  else if ((params2 = match('/cotizar/:roomId', path))) page = <Quote roomId={params2.roomId} />;
  else if ((params2 = match('/reservar/:roomId', path))) page = <Booking roomId={params2.roomId} />;
  else if (path === '/registro' || path === '/ingreso') {
    const next = params.get('next') || '/banda';
    page = (sessions.band || sessions.member) ? <Redirect to={next} /> : <Access startRegister={path === '/registro'} intro={next.startsWith('/reservar') ? 'Tu cotización se conserva: al terminar eliges fecha y pagas al contado o con anticipo.' : undefined} onSuccess={(data) => { saveSession('band', data); navigate(next, { replace: true }); }} />;
  }
  else if (path === '/bandas') page = <Directory />;
  else if ((params2 = match('/b/:slug', path))) page = <PublicEpk slug={params2.slug} />;
  else if (path === '/eventos') page = <Events />;
  else if (path === '/ingenieros') page = <Engineers />;
  else if (path.startsWith('/banda')) page = (sessions.band || sessions.member) ? <Suspense fallback={<div className="gs-page"><Skeleton rows={4} /></div>}><Portal /></Suspense> : <Redirect to="/ingreso?next=/banda" />;
  else if (path.startsWith('/ingenieria')) page = <Suspense fallback={<div className="gs-page"><Skeleton rows={4} /></div>}><EngineerArea /></Suspense>;
  else if (path.startsWith('/administracion')) page = <Suspense fallback={<div className="gs-page"><Skeleton rows={4} /></div>}><StaffArea /></Suspense>;
  else page = <div className="gs-page"><h1 className="gs-h1">Página no encontrada</h1></div>;

  return <Shell>{page}<Toaster /></Shell>;
}
