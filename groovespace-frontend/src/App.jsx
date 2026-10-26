import { useEffect, useState } from 'react';
import { FaSignOutAlt, FaGuitar } from 'react-icons/fa';
import './components/RoomGrid.css'; 
import BookingScreen from './components/BookingScreen';
import AuthScreen from './components/AuthScreen';
import StaffDashboard from './components/StaffDashboard'; 
import StaffLogin from './components/StaffLogin';
import InviteScreen from './components/InviteScreen';
import PaymentReturn from './components/PaymentReturn';
import BandProfile from './components/BandProfile';
import EngineerLogin from './components/EngineerLogin';
import EngineerPanel from './components/EngineerPanel';
import IntroScreen from './components/IntroScreen';
import QaMonitor from './components/QaMonitor';
import { API_URL, installQaRequestTagging } from './api';

installQaRequestTagging();

function RoomGridCard({ room, onSelect }) {
  return (
    <div className="studio-square-card" onClick={() => onSelect(room)}>
      <div className="card-square-media">
        <div className="live-badge-mini">Disponible</div>
        <img 
          src={room.imagePath} 
          alt={room.name} 
          className="square-img-file" 
        />
      </div>
      <div className="card-square-info">
        <div>
          <h3 className="room-grid-title">{room.name}</h3>
          <p className="room-grid-spec">{room.capacity} Integrantes máximo</p>
          {room.customizable && <p className="room-grid-spec">Personalización 3D incluida</p>}
        </div>
        <div className="room-grid-price-row">
          <div className="grid-price-tag">
            ${room.price}<span>/hr</span>
          </div>
          <button className="btn-grid-action">Ver</button>
        </div>
      </div>
    </div>
  );
}

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
  const [bandSession, setBandSession] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('groovespace.bandSession') || 'null'); }
    catch { return null; }
  });
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  const [staffToken, setStaffToken] = useState('');
  const [engineerSession, setEngineerSession] = useState(null);
  const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
  const isQaRoute = currentPath === '/qa';
  const isBandProfileRoute = currentPath === '/banda' || currentPath === '/banda/perfil';
  const isStaffRoute = currentPath === '/administracion' || currentPath === '/administracion/login';
  const isEngineerRoute = currentPath === '/ingenieria' || currentPath === '/ingenieria/login';
  const inviteToken = window.location.pathname.match(/^\/invite\/([^/]+)$/)?.[1];
  const paymentState = new URLSearchParams(window.location.search).get('payment');

  const roomsData = [
    { id: 'sala_estudio_a', name: 'Sala Estudio A (Premium Master)', capacity: 6, price: 350, imagePath: '/sala-estudio-a.jpg', customizable: true },
    { id: 'sala_ensayo_b', name: 'Sala Ensayo B (Sincronizada)', capacity: 4, price: 220, imagePath: '/sala-estudio-b.jpg' },
    { id: 'sala_production_c', name: 'Sala Production C (Dolby Atmos)', capacity: 3, price: 400, imagePath: '/sala-estudio-c.jpg' },
    { id: 'sala_live_d', name: 'Sala Live Session D (Live Room)', capacity: 8, price: 500, imagePath: '/sala-estudio-d.jpg' },
    { id: 'sala_orquesta_e', name: 'Sala E · Orquesta', capacity: 100, price: 650, imagePath: '/sala-estudio-e-orquesta.jpg', customizable: true }
  ];

  const scrollToCatalog = () => {
    document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' });
  };

  const handleSelectRoom = (room) => {
    setSelectedRoom(room);
    if (!bandSession) {
      setIsAuthenticating(true);
    }
  };

  const handleStaffLogout = () => {
    setStaffToken('');
    window.location.assign('/');
  };

  const handleEngineerLogout = () => {
    setEngineerSession(null);
    window.location.assign('/');
  };

  // CIERRE DE SESIÓN COMPLETO: Resetea de forma estricta todos los estados
  const handleMusicianLogout = () => {
    setBandSession(null);
    sessionStorage.removeItem('groovespace.bandSession');
    setSelectedRoom(null);
    setIsAuthenticating(false);
  };

  if (isQaRoute) return <QaMonitor />;

  if (!hasEntered) {
    return <IntroScreen onEnter={() => {
      sessionStorage.setItem('groovespace.introSeen', 'true');
      setHasEntered(true);
    }} />;
  }
  if (inviteToken) return <InviteScreen token={inviteToken} />;
  if (paymentState) return <PaymentReturn />;

  if (isBandProfileRoute) {
    if (!bandSession) {
      return (
        <AuthScreen
          onLoginSuccess={(data) => {
            setBandSession(data);
            sessionStorage.setItem('groovespace.bandSession', JSON.stringify(data));
          }}
          onCancel={() => window.location.assign('/')}
        />
      );
    }
    return <BandProfile bandInfo={bandSession} onClose={() => window.location.assign('/')} />;
  }

  if (isEngineerRoute && !engineerSession) {
    return <EngineerLogin onLoginSuccess={setEngineerSession} onCancel={() => window.location.assign('/')} />;
  }
  if (isEngineerRoute && engineerSession) {
    return <EngineerPanel session={engineerSession} onClose={handleEngineerLogout} />;
  }

  if (isStaffRoute && !staffToken) {
    return (
      <StaffLogin 
        onLoginSuccess={setStaffToken}
        onCancel={() => window.location.assign('/')}
      />
    );
  }

  if (isStaffRoute && staffToken) {
    return <StaffDashboard onClose={handleStaffLogout} token={staffToken} />;
  }

  if (isAuthenticating) {
    return (
      <AuthScreen 
        onLoginSuccess={(data) => {
          // Guardar el objeto tal cual viene del backend (incluyendo el _id nativo)
          setBandSession(data);
          sessionStorage.setItem('groovespace.bandSession', JSON.stringify(data));
          setIsAuthenticating(false);
        }} 
        onCancel={() => {
          setIsAuthenticating(false);
          setSelectedRoom(null);
        }} 
      />
    );
  }

  if (selectedRoom && bandSession) {
    return (
      <BookingScreen 
        room={selectedRoom} 
        bandInfo={bandSession} 
        onClose={() => setSelectedRoom(null)} 
      />
    );
  }

  return (
    <div style={{ backgroundColor: 'var(--color-surface-background)', minHeight: '100vh' }}>
      <header className="tesla-header">
        {bandSession ? (
          <div>
            <h1 className="brand-title" style={{ fontSize: '16px' }}>{bandSession.bandName}</h1>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Líder: {bandSession.leaderName}</span>
          </div>
        ) : (
          <h1 className="brand-title">GrooveSpace</h1>
        )}
        
        {bandSession ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <a href="/banda" aria-label="Mi banda" title="Mi banda" style={{ color: 'var(--color-text-muted)' }}><FaGuitar size={16} /></a>
            <button onClick={handleMusicianLogout} aria-label="Cerrar sesión" title="Cerrar sesión" style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><FaSignOutAlt size={16} /></button>
          </div>
        ) : <a href="/banda" aria-label="Acceso de banda" title="Acceso de banda" style={{ color: 'var(--color-text-onDark)' }}><FaGuitar size={16} /></a>}
      </header>

      <section className="hero-cinematic-container">
        <img 
          src="/header-image.webp" 
          alt="GrooveSpace Premium Studio" 
          className="hero-background-image" 
        />
        <div className="hero-overlay-content">
          <p className="hero-tagline">Estudios de Alta Escala</p>
          <h2 className="hero-title">Tu ritmo, tu espacio.</h2>
          <p className="hero-subtitle">Reserva salas de ensayo y grabación profesionales en tiempo real desde tu dispositivo móvil.</p>
          <button className="btn-tesla-primary" onClick={scrollToCatalog}>
            Explorar Catálogo
          </button>
        </div>
      </section>

      <main id="catalog" className="catalog-section">
        <div className="catalog-header-block">
          <h2 className="catalog-title">Salas Disponibles</h2>
          <p className="catalog-subtitle">Selecciona un módulo de audio para bloquear el horario en la CDMX</p>
        </div>
        
        <div className="rooms-high-density-grid">
          {roomsData.map(room => (
            <RoomGridCard key={room.id} room={room} onSelect={handleSelectRoom} />
          ))}
        </div>
      </main>
    </div>
  );
}
