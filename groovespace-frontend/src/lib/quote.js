// Réplica en el navegador de lib/pricing.buildQuote del servidor: permite el panel de precio en vivo sin
// ir a la red en cada clic. El servidor vuelve a calcular el importe al reservar, así que esto es sólo vista previa.
export const computeQuote = (catalog, selection) => {
  if (!catalog) return null;
  const room = catalog.rooms.find((item) => item.id === selection.roomId);
  if (!room) return null;
  const hours = selection.duration;
  const lines = [{ id: room.id, kind: 'room', label: room.name, detail: `${hours} h × $${room.price}`, amount: room.price * hours }];
  catalog.rentalGear.filter((item) => selection.gearIds.includes(item.id)).forEach((item) => lines.push({ id: item.id, kind: 'gear', label: item.name, detail: `${hours} h × $${item.price}`, amount: item.price * hours }));
  catalog.extras.filter((item) => selection.extraIds.includes(item.id)).forEach((item) => lines.push({ id: item.id, kind: 'extra', label: item.name, detail: item.unit === 'hour' ? `${hours} h × $${item.price}` : 'Cargo único', amount: item.unit === 'hour' ? item.price * hours : item.price }));
  const engineer = catalog.engineers.find((item) => item.id === selection.engineerId);
  if (engineer) lines.push({ id: engineer.id, kind: 'engineer', label: `Ingeniero: ${engineer.name}`, detail: `${hours} h × $${engineer.hourlyRate}`, amount: engineer.hourlyRate * hours });
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const deposit = Math.ceil(total * catalog.limits.depositRate);
  return { lines, total, deposit, balance: total - deposit };
};

export const loadCatalog = (() => {
  let cache;
  return () => {
    cache ||= import('./http').then(({ api }) => api('/pricing')).catch((error) => { cache = undefined; throw error; });
    return cache;
  };
})();

// Borrador de sesión: se conserva entre "Cotizar" → registro → "Reservar" para que la banda no rehaga nada.
const DRAFT_KEY = 'groovespace.quoteDraft';
export const readDraft = (roomId) => {
  try {
    const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
    if (draft && draft.roomId === roomId) return draft;
  } catch { /* sin borrador */ }
  return null;
};
export const saveDraft = (draft) => { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* almacenamiento bloqueado */ } };
export const newDraft = (roomId) => ({ roomId, duration: 2, attendees: 4, gearIds: [], extraIds: [], engineerId: '', date: '', startTime: '16:00' });
