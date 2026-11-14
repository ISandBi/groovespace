import { useEffect, useState } from 'react';
import { api } from '../lib/http';
import { ErrorNote, Skeleton } from '../ui/kit.jsx';

/** Semáforo de salas: luz roja "En vivo" mientras una banda la usa; apagada cuando está libre. Se actualiza solo cada 20 s. */
export default function LiveRooms({ token, refreshKey }) {
  const [rooms, setRooms] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    const load = () => api('/staff/rooms/status', { token }).then((data) => { if (alive) { setRooms(data); setError(''); } }).catch((requestError) => { if (alive) setError(requestError.message); });
    load();
    const timer = setInterval(load, 20000);
    return () => { alive = false; clearInterval(timer); };
  }, [token, refreshKey]);
  if (error) return <ErrorNote error={error} />;
  if (!rooms) return <Skeleton rows={3} />;
  return (
    <div className="gs-grid">
      {rooms.map((room) => (
        <div key={room.roomId} className="gs-card" style={room.live ? { borderColor: 'rgba(255,59,78,.55)', boxShadow: '0 0 40px rgba(255,59,78,.14)' } : undefined}>
          <div className="gs-row" style={{ justifyContent: 'space-between' }}><b style={{ color: 'var(--color-text-title)' }}>{room.name}</b><span className={`gs-live ${room.live ? '' : 'off'}`}><i />{room.live ? 'En vivo' : 'Libre'}</span></div>
          {room.live ? <p style={{ color: 'var(--color-text-body)', margin: '12px 0 0' }}><b>{room.current.bandName}</b><br /><span className="gs-hint">Termina {new Date(room.current.endsAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} · quedan {room.current.minutesLeft} min</span></p> : <p className="gs-hint" style={{ margin: '12px 0 0' }}>Sin banda dentro.</p>}
          {room.next && <p className="gs-hint" style={{ marginTop: 8 }}>Siguiente: {room.next.startTime} · {room.next.bandName}</p>}
        </div>))}
    </div>
  );
}
