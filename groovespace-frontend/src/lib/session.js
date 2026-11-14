import { useEffect, useState } from 'react';

// Sesiones por tipo de actor. Líder de banda y staff/ingeniero duran la pestaña; el integrante invitado
// se guarda en el dispositivo para que abra su enlace de WhatsApp una vez y siga dentro.
const SLOTS = {
  band: { key: 'groovespace.bandSession', area: 'session' },
  member: { key: 'groovespace.memberSession', area: 'local' },
  staff: { key: 'groovespace.staffToken', area: 'session' },
  engineer: { key: 'groovespace.engineerSession', area: 'session' }
};
const EVENT = 'gs:session';
const storage = (area) => { try { return area === 'local' ? window.localStorage : window.sessionStorage; } catch { return null; } };

export const readSession = (kind) => {
  const slot = SLOTS[kind];
  try { return JSON.parse(storage(slot.area)?.getItem(slot.key) || 'null'); } catch { return null; }
};
export const saveSession = (kind, value) => {
  const slot = SLOTS[kind];
  try { storage(slot.area)?.setItem(slot.key, JSON.stringify(value)); } catch { /* almacenamiento bloqueado */ }
  window.dispatchEvent(new Event(EVENT));
};
export const clearSession = (kind) => {
  const slot = SLOTS[kind];
  try { storage(slot.area)?.removeItem(slot.key); } catch { /* almacenamiento bloqueado */ }
  window.dispatchEvent(new Event(EVENT));
};

export const useSessions = () => {
  const read = () => ({ band: readSession('band'), member: readSession('member'), staff: readSession('staff'), engineer: readSession('engineer') });
  const [sessions, setSessions] = useState(read);
  useEffect(() => {
    const update = () => setSessions(read());
    window.addEventListener(EVENT, update);
    window.addEventListener('storage', update);
    return () => { window.removeEventListener(EVENT, update); window.removeEventListener('storage', update); };
  }, []);
  return sessions;
};

/** Token y perfil de la banda activa: el líder (sesión de banda) o el integrante invitado. */
export const bandActor = (sessions) => {
  if (sessions.band?.accessToken) return { token: sessions.band.accessToken, bandId: sessions.band._id, name: sessions.band.bandName, person: sessions.band.leaderName, role: 'lider', raw: sessions.band };
  if (sessions.member?.accessToken) return { token: sessions.member.accessToken, bandId: sessions.member.bandId, name: sessions.member.bandName || 'Mi banda', person: sessions.member.name, role: sessions.member.role || 'integrante', raw: sessions.member };
  return null;
};
