const { rooms, rentalGear, extras, limits } = require('../config/catalog');
const { engineers } = require('../config/engineers');

class QuoteError extends Error {
  constructor(message) {
    super(message);
    this.name = 'QuoteError';
    this.status = 400;
  }
}

const unique = (list) => [...new Set(Array.isArray(list) ? list : [])];

/**
 * Calcula una cotización. Es una función pura: misma entrada, mismo resultado,
 * por eso se usa igual para la vista previa pública y para fijar el precio de una reserva.
 * Todos los importes son pesos enteros (MXN).
 */
exports.buildQuote = ({ roomId, duration, attendees, gearIds = [], extraIds = [], engineerId = null } = {}) => {
  const room = rooms.find((item) => item.id === roomId);
  if (!room) throw new QuoteError('Selecciona una sala válida.');
  const hours = Number(duration);
  if (!Number.isInteger(hours) || hours < limits.minHours || hours > limits.maxHours) {
    throw new QuoteError(`La sesión debe durar entre ${limits.minHours} y ${limits.maxHours} horas.`);
  }
  const people = Number(attendees ?? 1);
  if (!Number.isInteger(people) || people < 1 || people > room.capacity) {
    throw new QuoteError(`La sala ${room.name} admite de 1 a ${room.capacity} integrantes.`);
  }

  const lines = [{ id: room.id, kind: 'room', label: room.name, detail: `${hours} h × $${room.price}`, amount: room.price * hours }];

  const gear = unique(gearIds).map((id) => {
    const item = rentalGear.find((candidate) => candidate.id === id);
    if (!item) throw new QuoteError('El equipo de renta solicitado no es válido.');
    return item;
  });
  gear.forEach((item) => lines.push({ id: item.id, kind: 'gear', label: item.name, detail: `${hours} h × $${item.price}`, amount: item.price * hours }));

  const chosenExtras = unique(extraIds).map((id) => {
    const item = extras.find((candidate) => candidate.id === id);
    if (!item) throw new QuoteError('El servicio adicional solicitado no es válido.');
    return item;
  });
  chosenExtras.forEach((item) => lines.push({
    id: item.id,
    kind: 'extra',
    label: item.name,
    detail: item.unit === 'hour' ? `${hours} h × $${item.price}` : 'Cargo único',
    amount: item.unit === 'hour' ? item.price * hours : item.price
  }));

  let engineer = null;
  if (engineerId) {
    engineer = engineers.find((item) => item.id === engineerId);
    if (!engineer) throw new QuoteError('Selecciona uno de los ingenieros disponibles.');
    lines.push({ id: engineer.id, kind: 'engineer', label: `Ingeniero: ${engineer.name}`, detail: `${hours} h × $${engineer.hourlyRate}`, amount: engineer.hourlyRate * hours });
  }

  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const deposit = Math.ceil(total * limits.depositRate);
  return {
    roomId: room.id,
    roomName: room.name,
    duration: hours,
    attendees: people,
    lines,
    total,
    deposit,
    balance: total - deposit,
    currency: 'MXN',
    // Datos normalizados para guardar en la reserva.
    gear: gear.map(({ id, name, price }) => ({ id, name, price })),
    extraIds: chosenExtras.map((item) => item.id),
    engineerId: engineer ? engineer.id : null
  };
};

exports.QuoteError = QuoteError;
