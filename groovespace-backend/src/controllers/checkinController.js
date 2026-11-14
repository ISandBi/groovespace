const Reservation = require('../models/Reservation');
const { todayInMexicoCity } = require('../config/payment');
const { Event, EventTicket } = require('../modules/events/models');
const { rooms } = require('../config/catalog');

const EARLY_ENTRY_MS = 60 * 60 * 1000; // se puede entrar hasta 1 hora antes de la sesión
const CODE_PATTERN = /^GS-[A-F\d]{16}$/;
const EVENT_CODE_PATTERN = /^GE-[A-F\d]{16}$/;
const cleanCode = (raw) => String(raw || '').trim().toUpperCase().replace(/^GROOVESPACE:/, '');

const sessionWindow = (reservation) => {
  const start = new Date(`${reservation.date}T${reservation.startTime}:00-06:00`);
  return { start, end: new Date(start.getTime() + reservation.duration * 60 * 60 * 1000) };
};

const describe = (reservation) => ({
  id: reservation._id,
  ticketCode: reservation.ticketCode,
  bandName: reservation.bandId?.name || 'Banda',
  leaderName: reservation.bandId?.leaderName || '',
  roomName: reservation.roomName,
  date: reservation.date,
  startTime: reservation.startTime,
  duration: reservation.duration,
  attendees: reservation.attendees,
  paymentStatus: reservation.paymentStatus,
  balanceAmount: reservation.paymentStatus === 'deposit_paid' ? reservation.balanceAmount : 0,
  checkedInAt: reservation.checkedInAt || null
});

// Decide si la banda puede pasar. Devuelve { canEnter, reason?, warning? }.
const evaluate = (reservation) => {
  if (reservation.isDemo) return { canEnter: false, reason: 'Es una reserva de demostración.' };
  if (!['deposit_paid', 'paid'].includes(reservation.paymentStatus)) {
    return { canEnter: false, reason: 'El anticipo de esta reserva no está pagado o la reserva se canceló.' };
  }
  if (reservation.checkedInAt) {
    return { canEnter: false, reason: `Esta banda ya hizo check-in a las ${reservation.checkedInAt.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' })}.` };
  }
  if (reservation.date !== todayInMexicoCity()) {
    return { canEnter: false, reason: `El boleto es para el ${reservation.date}, no para hoy.` };
  }
  const { start, end } = sessionWindow(reservation);
  const now = Date.now();
  if (now < start.getTime() - EARLY_ENTRY_MS) return { canEnter: false, reason: `Es muy pronto: la sesión empieza a las ${reservation.startTime} y se puede entrar desde 1 hora antes.` };
  if (now > end.getTime()) return { canEnter: false, reason: 'La sesión de este boleto ya terminó.' };
  return {
    canEnter: true,
    ...(reservation.paymentStatus === 'deposit_paid' && reservation.balanceAmount > 0
      ? { warning: `Saldo pendiente de $${reservation.balanceAmount} MXN.` } : {})
  };
};

const findByCode = async (rawCode) => {
  const code = String(rawCode || '').trim().toUpperCase().replace(/^GROOVESPACE:/, '');
  if (!CODE_PATTERN.test(code)) return null;
  return Reservation.findOne({ ticketCode: code }).populate('bandId', 'name leaderName');
};

// ---- Boletos de eventos (GE-...): cada escaneo admite a una persona hasta agotar la cantidad comprada ----
const describeEventTicket = (ticket, event) => ({
  id: ticket.id, kind: 'event', ticketCode: ticket.code, bandName: `${ticket.buyerName} (${ticket.quantity} boleto${ticket.quantity > 1 ? 's' : ''})`, leaderName: ticket.buyerEmail,
  roomName: event.title, date: event.date, startTime: event.startTime, duration: 0, attendees: ticket.quantity, admitted: ticket.admitted,
  paymentStatus: 'paid', balanceAmount: 0, checkedInAt: ticket.admitted >= ticket.quantity ? ticket.lastCheckInAt : null
});

const evaluateEventTicket = (ticket, event) => {
  if (event.status === 'cancelled') return { canEnter: false, reason: 'El evento fue cancelado.' };
  if (event.date !== todayInMexicoCity()) return { canEnter: false, reason: `El boleto es para el ${event.date}, no para hoy.` };
  if (ticket.admitted >= ticket.quantity) return { canEnter: false, reason: `Ya ingresaron las ${ticket.quantity} personas de este boleto.` };
  return { canEnter: true, warning: `Ingresan ${ticket.admitted + 1} de ${ticket.quantity}.` };
};

const handleEventTicket = async (code, confirm, req, res) => {
  const ticket = await EventTicket.findOne({ code });
  if (!ticket) return res.status(404).json({ error: 'No existe un boleto con ese código.' });
  const event = await Event.findById(ticket.eventId);
  const verdict = evaluateEventTicket(ticket, event);
  if (!confirm) return res.status(200).json({ ticket: describeEventTicket(ticket, event), ...verdict });
  if (!verdict.canEnter) return res.status(409).json({ error: verdict.reason, ticket: describeEventTicket(ticket, event) });
  const updated = await EventTicket.findOneAndUpdate(
    { _id: ticket._id, $expr: { $lt: ['$admitted', '$quantity'] } },
    { $inc: { admitted: 1 }, $set: { lastCheckInAt: new Date(), checkedInBy: req.staff.username } }, { new: true }
  );
  if (!updated) return res.status(409).json({ error: 'Ya ingresaron todas las personas de este boleto.' });
  return res.status(200).json({ ticket: describeEventTicket(updated, event), warning: `Ingresaron ${updated.admitted} de ${updated.quantity}.` });
};

exports.lookup = async (req, res) => {
  try {
    if (EVENT_CODE_PATTERN.test(cleanCode(req.params.code))) return await handleEventTicket(cleanCode(req.params.code), false, req, res);
    const reservation = await findByCode(req.params.code);
    if (!reservation) return res.status(404).json({ error: 'No existe un boleto con ese código.' });
    return res.status(200).json({ ticket: describe(reservation), ...evaluate(reservation) });
  } catch {
    return res.status(500).json({ error: 'No se pudo consultar el boleto.' });
  }
};

exports.confirm = async (req, res) => {
  try {
    if (EVENT_CODE_PATTERN.test(cleanCode(req.params.code))) return await handleEventTicket(cleanCode(req.params.code), true, req, res);
    const reservation = await findByCode(req.params.code);
    if (!reservation) return res.status(404).json({ error: 'No existe un boleto con ese código.' });
    const verdict = evaluate(reservation);
    if (!verdict.canEnter) return res.status(409).json({ error: verdict.reason, ticket: describe(reservation) });
    // Actualización condicionada: si dos personas escanean a la vez, sólo una registra la entrada.
    const result = await Reservation.updateOne(
      { _id: reservation._id, checkedInAt: { $exists: false } },
      { $set: { checkedInAt: new Date(), checkedInBy: req.staff.username } }
    );
    if (!result.modifiedCount) return res.status(409).json({ error: 'Esta banda ya hizo check-in.' });
    const fresh = await Reservation.findById(reservation._id).populate('bandId', 'name leaderName');
    return res.status(200).json({ ticket: describe(fresh), ...(verdict.warning ? { warning: verdict.warning } : {}) });
  } catch {
    return res.status(500).json({ error: 'No se pudo registrar el check-in.' });
  }
};

exports.today = async (req, res) => {
  try {
    const reservations = await Reservation.find({
      date: todayInMexicoCity(),
      isDemo: { $ne: true },
      paymentStatus: { $in: ['deposit_paid', 'paid'] }
    }).populate('bandId', 'name leaderName').sort({ startTime: 1 });
    return res.status(200).json(reservations.map(describe));
  } catch {
    return res.status(500).json({ error: 'No se pudo cargar la lista de hoy.' });
  }
};

/**
 * Estado "En vivo" de cada sala: una sala está en uso desde el check-in de la banda hasta que termina su sesión.
 * También informa la próxima sesión de hoy para que recepción sepa qué sigue.
 */
exports.roomsStatus = async (req, res) => {
  try {
    const reservations = await Reservation.find({ date: todayInMexicoCity(), isDemo: { $ne: true }, paymentStatus: { $in: ['deposit_paid', 'paid'] } })
      .populate('bandId', 'name').sort({ startTime: 1 });
    const now = Date.now();
    const status = rooms.map((room) => {
      const mine = reservations.filter((reservation) => reservation.roomId === room.id).map((reservation) => ({ reservation, ...sessionWindow(reservation) }));
      const live = mine.find(({ reservation, start, end }) => reservation.checkedInAt && now >= start.getTime() - EARLY_ENTRY_MS && now < end.getTime());
      const next = mine.find(({ reservation, start }) => !reservation.checkedInAt && start.getTime() + 15 * 60 * 1000 > now);
      const brief = (item) => item && { bandName: item.reservation.bandId?.name || 'Banda', startTime: item.reservation.startTime, endsAt: item.end.toISOString(), minutesLeft: Math.max(0, Math.ceil((item.end.getTime() - now) / 60000)), ticketCode: item.reservation.ticketCode };
      return { roomId: room.id, name: room.name, live: Boolean(live), current: brief(live) || null, next: brief(next) || null };
    });
    res.set('Cache-Control', 'no-store');
    return res.status(200).json(status);
  } catch {
    return res.status(500).json({ error: 'No se pudo consultar el estado de las salas.' });
  }
};
