const crypto = require('crypto');
const { Event, EventApplication, EventTicket } = require('./models');
const Band = require('../../models/Band');
const intents = require('../payments/intents');
const { notify } = require('../notifications/service');
const { assert, cleanString, isObjectId } = require('../../lib/http');
const { todayInMexicoCity } = require('../../config/payment');

const newEventTicketCode = () => `GE-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
exports.newEventTicketCode = newEventTicketCode;

const loadEvent = async (id) => {
  assert(isObjectId(id), 400, 'Identificador de evento no válido.');
  const event = await Event.findById(id);
  assert(event, 404, 'No se encontró el evento.');
  return event;
};

const publicEvent = (event, extra = {}) => ({
  id: event.id, title: event.title, description: event.description, date: event.date, startTime: event.startTime, venue: event.venue,
  requirements: event.requirements, applicationDeadline: event.applicationDeadline, lineupSlots: event.lineupSlots,
  ticketPrice: event.ticketPrice, ticketsLeft: Math.max(0, event.ticketCapacity - event.soldTickets), status: event.status, ...extra
});

const validateEventBody = (body) => {
  const data = {
    title: cleanString(body.title, 120), description: cleanString(body.description, 2000), venue: cleanString(body.venue, 120),
    requirements: cleanString(body.requirements, 800), date: cleanString(body.date, 10), startTime: cleanString(body.startTime, 5),
    applicationDeadline: cleanString(body.applicationDeadline, 10) || undefined,
    lineupSlots: Number(body.lineupSlots ?? 4), ticketPrice: Number(body.ticketPrice ?? 0), ticketCapacity: Number(body.ticketCapacity ?? 100)
  };
  assert(data.title && data.venue, 400, 'El título y el lugar son obligatorios.');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(data.date) && data.date >= todayInMexicoCity(), 400, 'La fecha del evento debe ser hoy o posterior.');
  assert(/^([01]\d|2[0-3]):[0-5]\d$/.test(data.startTime), 400, 'La hora debe tener el formato HH:MM.');
  assert(!data.applicationDeadline || (/^\d{4}-\d{2}-\d{2}$/.test(data.applicationDeadline) && data.applicationDeadline <= data.date), 400, 'La fecha límite de postulación no puede ser posterior al evento.');
  assert(Number.isInteger(data.lineupSlots) && data.lineupSlots >= 1 && data.lineupSlots <= 30, 400, 'El cartel admite de 1 a 30 bandas.');
  assert(Number.isInteger(data.ticketPrice) && data.ticketPrice >= 0 && data.ticketPrice <= 5000, 400, 'El precio del boleto debe ser un entero entre 0 y 5000.');
  assert(Number.isInteger(data.ticketCapacity) && data.ticketCapacity >= 0 && data.ticketCapacity <= 5000, 400, 'El aforo debe ser un entero entre 0 y 5000.');
  return data;
};

// ---------- Público y bandas ----------
exports.listPublic = async () => {
  const events = await Event.find({ status: { $in: ['open', 'closed'] }, date: { $gte: todayInMexicoCity() } }).sort({ date: 1, startTime: 1 });
  return events.map((event) => publicEvent(event));
};

exports.getPublic = async (id) => {
  const event = await loadEvent(id);
  assert(['open', 'closed'].includes(event.status), 404, 'No se encontró el evento.');
  const lineup = await EventApplication.find({ eventId: event._id, status: 'accepted' }).populate('bandId', 'name logoPath genre slug isPublic');
  return publicEvent(event, { lineup: lineup.map(({ bandId }) => ({ name: bandId.name, logoPath: bandId.logoPath, genre: bandId.genre, slug: bandId.isPublic ? bandId.slug : null })) });
};

exports.apply = async ({ actor, eventId, message }) => {
  const event = await loadEvent(eventId);
  assert(event.status === 'open', 409, 'Este evento ya no recibe postulaciones.');
  assert(!event.applicationDeadline || event.applicationDeadline >= todayInMexicoCity(), 409, 'La fecha límite de postulación ya pasó.');
  assert(!(await EventApplication.exists({ eventId: event._id, bandId: actor.bandId })), 409, 'Tu banda ya se postuló a este evento.');
  const application = await EventApplication.create({ eventId: event._id, bandId: actor.bandId, message: cleanString(message, 800) });
  const band = await Band.findById(actor.bandId).select('name');
  await notify({ recipientType: 'staff', recipientId: 'all', kind: 'application_received', title: 'Nueva postulación', body: `${band?.name || 'Una banda'} se postuló a “${event.title}”.`, link: '/administracion' });
  return application;
};

exports.myApplications = async (bandId) => {
  const applications = await EventApplication.find({ bandId }).populate('eventId', 'title date startTime venue status').sort({ createdAt: -1 });
  return applications.filter((item) => item.eventId).map((item) => ({ id: item.id, status: item.status, reviewNote: item.reviewNote, message: item.message, event: item.eventId }));
};

// ---------- Staff ----------
exports.create = async ({ staffId, body }) => {
  const data = validateEventBody(body);
  return Event.create({ ...data, status: body.status === 'open' ? 'open' : 'draft', createdBy: staffId });
};

exports.update = async ({ id, body }) => {
  const event = await loadEvent(id);
  if (body.status !== undefined) {
    assert(['draft', 'open', 'closed', 'cancelled'].includes(body.status), 400, 'Estado no válido.');
    event.status = body.status;
  }
  if (body.title !== undefined) Object.assign(event, validateEventBody({ ...event.toObject(), ...body }));
  await event.save();
  return event;
};

exports.listAll = async () => (await Event.find().sort({ date: -1 }).limit(100)).map((event) => ({ ...publicEvent(event), soldTickets: event.soldTickets, ticketCapacity: event.ticketCapacity }));

exports.listApplications = async (id) => {
  const event = await loadEvent(id);
  const items = await EventApplication.find({ eventId: event._id }).populate('bandId', 'name genre logoPath slug').sort({ createdAt: 1 });
  return items.map((item) => ({ id: item.id, status: item.status, message: item.message, reviewNote: item.reviewNote, band: item.bandId }));
};

exports.decide = async ({ eventId, applicationId, status, note }) => {
  assert(['accepted', 'waitlist', 'rejected'].includes(status), 400, 'Decisión no válida.');
  const event = await loadEvent(eventId);
  assert(isObjectId(applicationId), 400, 'Identificador no válido.');
  const application = await EventApplication.findOne({ _id: applicationId, eventId: event._id });
  assert(application, 404, 'No se encontró la postulación.');
  if (status === 'accepted' && application.status !== 'accepted') {
    assert(await EventApplication.countDocuments({ eventId: event._id, status: 'accepted' }) < event.lineupSlots, 409, 'El cartel ya está completo. Marca la postulación en lista de espera.');
  }
  application.status = status;
  application.reviewNote = cleanString(note, 500);
  application.decidedAt = new Date();
  await application.save();
  const labels = { accepted: 'fue aceptada', waitlist: 'quedó en lista de espera', rejected: 'no fue seleccionada' };
  await notify({ recipientType: 'band', recipientId: application.bandId, kind: 'application_decision', title: `Tu postulación a “${event.title}” ${labels[status]}`, body: application.reviewNote || `${event.date} · ${event.venue}`, link: '/banda' });
  return application;
};

// ---------- Boletos (público) ----------
exports.startPurchase = async ({ eventId, name, email, quantity }) => {
  const event = await loadEvent(eventId);
  assert(event.status === 'open', 409, 'La venta de boletos de este evento no está abierta.');
  const qty = Number(quantity || 1);
  const buyerName = cleanString(name, 100);
  const buyerEmail = cleanString(email, 120).toLowerCase();
  assert(Number.isInteger(qty) && qty >= 1 && qty <= 6, 400, 'Puedes comprar de 1 a 6 boletos.');
  assert(buyerName && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(buyerEmail), 400, 'Escribe tu nombre y un correo válido.');
  assert(event.soldTickets + qty <= event.ticketCapacity, 409, 'No quedan suficientes boletos.');
  if (event.ticketPrice === 0) return { ticket: await exports.issueTickets({ event, buyerName, buyerEmail, quantity: qty, amount: 0 }) };
  const { checkoutUrl } = await intents.createIntent({
    purpose: 'event_ticket', amount: event.ticketPrice * qty, label: `${qty} boleto(s) · ${event.title}`, actor: null,
    returnPath: '/', meta: { eventId: event.id, buyerName, buyerEmail, quantity: qty }
  });
  return { checkoutUrl };
};

exports.issueTickets = async ({ event, buyerName, buyerEmail, quantity, amount, card }) => {
  // Reserva el aforo de forma atómica: dos compras simultáneas no pueden sobrepasar la capacidad.
  const claimed = await Event.findOneAndUpdate(
    { _id: event._id, $expr: { $lte: [{ $add: ['$soldTickets', quantity] }, '$ticketCapacity'] } },
    { $inc: { soldTickets: quantity } }, { new: true }
  );
  assert(claimed, 409, 'Los boletos se agotaron mientras pagabas.');
  const ticket = await EventTicket.create({ eventId: event._id, code: newEventTicketCode(), buyerName, buyerEmail, quantity, amount, cardBrand: card?.brand, cardLast4: card?.last4 });
  return { code: ticket.code, quantity, buyerName, eventTitle: event.title, date: event.date, startTime: event.startTime, venue: event.venue };
};

intents.registerHandler('event_ticket', async (intent) => {
  const event = await loadEvent(intent.meta.eventId);
  return exports.issueTickets({ event, buyerName: intent.meta.buyerName, buyerEmail: intent.meta.buyerEmail, quantity: intent.meta.quantity, amount: intent.amount, card: { brand: intent.cardBrand, last4: intent.cardLast4 } });
});
