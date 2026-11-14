const Reservation = require('../../models/Reservation');
const Band = require('../../models/Band');
const { notifyBand, notify } = require('../notifications/service');
const { HOLD_MS, HOLD_HOURS } = require('../../config/payment');
const { engineers } = require('../../config/engineers');

const DAY_MS = 24 * 60 * 60 * 1000;

// La hora de inicio se interpreta en la Ciudad de México (UTC-06:00, sin horario de verano).
exports.sessionStart = (reservation) => new Date(`${reservation.date}T${reservation.startTime}:00-06:00`);

const fmtDate = (reservation) => `${reservation.date} a las ${reservation.startTime}`;

/**
 * Recordatorio 24 h antes de la sesión, a la misma hora en que la banda agendó su cita.
 * Es idempotente: `reminderSentAt` y la llave de deduplicación evitan avisos repetidos.
 */
exports.sendSessionReminders = async (now = new Date()) => {
  const today = now.toISOString().slice(0, 10);
  const horizon = new Date(now.getTime() + 3 * DAY_MS).toISOString().slice(0, 10);
  const candidates = await Reservation.find({
    isDemo: { $ne: true }, paymentStatus: { $in: ['deposit_paid', 'paid'] }, reminderSentAt: { $exists: false },
    date: { $gte: new Date(now.getTime() - DAY_MS).toISOString().slice(0, 10), $lte: horizon }
  });
  let sent = 0;
  for (const reservation of candidates) {
    const start = exports.sessionStart(reservation);
    if (now < new Date(start.getTime() - DAY_MS) || now >= start) continue;
    const claimed = await Reservation.updateOne({ _id: reservation._id, reminderSentAt: { $exists: false } }, { $set: { reminderSentAt: now } });
    if (!claimed.modifiedCount) continue;
    const band = await Band.findById(reservation.bandId).select('name email members');
    if (band) {
      await notifyBand(band, {
        kind: 'reminder_24h', title: 'Tu sesión es mañana',
        body: `${reservation.roomName} · ${fmtDate(reservation)}${reservation.paymentStatus === 'deposit_paid' ? `. Recuerda liquidar el saldo de $${reservation.balanceAmount} MXN.` : '.'} Lleva tu boleto con QR.`,
        link: '/banda', dedupeKey: `reminder:${reservation.id}`, email: undefined
      });
    }
    if (reservation.engineerId) {
      await notify({ recipientType: 'engineer', recipientId: reservation.engineerId, kind: 'reminder_24h', title: 'Sesión mañana', body: `${band?.name || 'Una banda'} · ${reservation.roomName} · ${fmtDate(reservation)}`, link: '/ingenieria', dedupeKey: `reminder:${reservation.id}:eng` });
    }
    sent += 1;
  }
  return sent;
};

/** Aviso cuando faltan 6 horas para que venza el apartado sin pagar. */
exports.sendPaymentDueWarnings = async (now = new Date()) => {
  const from = new Date(now.getTime() - HOLD_MS);
  const to = new Date(now.getTime() - (HOLD_MS - 6 * 60 * 60 * 1000));
  const pending = await Reservation.find({ isDemo: { $ne: true }, paymentStatus: 'deposit_pending', createdAt: { $gt: from, $lte: to } });
  for (const reservation of pending) {
    const band = await Band.findById(reservation.bandId).select('name email members');
    if (!band) continue;
    const left = Math.max(1, Math.round((reservation.createdAt.getTime() + HOLD_MS - now.getTime()) / 3600000));
    await notifyBand(band, {
      kind: 'payment_due', title: `Te quedan ${left} h para pagar el anticipo`,
      body: `Si no se paga, ${reservation.roomName} (${fmtDate(reservation)}) se libera automáticamente a las ${HOLD_HOURS} horas.`,
      link: '/banda', dedupeKey: `due:${reservation.id}`
    });
  }
  return pending.length;
};

exports.tick = async () => {
  const { expireStaleReservations } = require('../../controllers/reservationController');
  await expireStaleReservations();
  await exports.sendPaymentDueWarnings();
  await exports.sendSessionReminders();
};

exports.start = () => {
  setInterval(() => exports.tick().catch((error) => console.error('[GrooveSpace] Error en las tareas programadas.', error.message)), 60 * 1000).unref();
};

exports._engineers = engineers; // referencia para pruebas
