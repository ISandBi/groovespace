const Reservation = require('../../models/Reservation');
const ReservationSlot = require('../../models/ReservationSlot');
const Band = require('../../models/Band');
const { newTicketCode, PAYMENT_TYPES, HOLD_MS, HOLD_HOURS } = require('../../config/payment');
const { HttpError } = require('../../lib/http');
const { notifyBand } = require('../notifications/service');

exports.issueTicket = async (reservation) => {
  if (reservation.ticketCode || reservation.isDemo) return;
  reservation.ticketCode = newTicketCode();
  reservation.ticketIssuedAt = new Date();
  await reservation.save();
};

/**
 * Registra un pago ya validado (por la pasarela simulada, por PayPal o por el último integrante de un pago dividido).
 * Es el único lugar que cambia el estado de pago de una reserva.
 */
exports.applyReservationPayment = async (reservation, paymentType, { simulated = false, method, receipt } = {}) => {
  const type = PAYMENT_TYPES[paymentType];
  if (reservation.paymentStatus === type.from) {
    reservation.paymentStatus = type.to;
  } else if (!(type.to === 'deposit_paid' && ['deposit_paid', 'paid'].includes(reservation.paymentStatus)) &&
    !(type.to === 'paid' && reservation.paymentStatus === 'paid')) {
    return null; // pago repetido o fuera de estado: no se toca nada
  }
  if (method) reservation.paymentMethod = method;
  else if (simulated) reservation.paymentMethod = 'simulated';
  if (receipt) {
    reservation.cardBrand = receipt.brand;
    reservation.cardLast4 = receipt.last4;
    reservation.privacyAcceptedAt = receipt.privacyAcceptedAt;
    reservation.privacyVersion = receipt.privacyVersion;
  }
  if (reservation.sharePlan?.paymentType === paymentType) reservation.sharePlan = undefined;
  await reservation.save();
  await ReservationSlot.updateMany({ reservationId: reservation._id }, { $unset: { expiresAt: 1 } });
  await exports.issueTicket(reservation);

  const band = await Band.findById(reservation.bandId).select('name email members');
  if (band) {
    await notifyBand(band, {
      kind: 'payment_confirmed',
      title: paymentType === 'balance' ? 'Saldo liquidado' : 'Reserva confirmada',
      body: `${type.label} recibido para ${reservation.roomName} el ${reservation.date} a las ${reservation.startTime}. Tu boleto con QR ya está disponible.`,
      link: '/banda',
      dedupeKey: `pay:${reservation.id}:${paymentType}`,
      email: undefined
    });
  }
  return reservation;
};

/** Comprobaciones comunes para pagar una reserva por cartera o por partes. Devuelve la reserva si procede. */
exports.loadPayable = async ({ reservationId, paymentType, bandId }) => {
  const type = PAYMENT_TYPES[paymentType];
  if (!type) throw new HttpError(400, 'Tipo de pago no válido.');
  const reservation = await Reservation.findOne({ _id: reservationId, bandId });
  if (!reservation || reservation.isDemo) throw new HttpError(404, 'No se encontró la reserva.');
  if (reservation.paymentStatus !== type.from) throw new HttpError(409, 'El estado de la reserva no permite este pago.');
  if (type.from === 'deposit_pending' && reservation.createdAt < new Date(Date.now() - HOLD_MS)) {
    throw new HttpError(409, `Pasaron las ${HOLD_HOURS} horas para pagar el anticipo y la reserva se canceló.`);
  }
  if (paymentType === 'balance' && reservation.balanceDueAt <= new Date()) throw new HttpError(409, 'El saldo debe liquidarse al menos 24 horas antes de la sesión.');
  return { reservation, type, amount: type.amount(reservation) };
};

/** Cancela una reserva que no se pagó a tiempo: libera la sala, reembolsa partes ya pagadas y avisa a la banda. */
exports.expireReservation = async (reservation) => {
  reservation.paymentStatus = 'expired';
  await reservation.save();
  await ReservationSlot.deleteMany({ reservationId: reservation._id });
  const band = await Band.findById(reservation.bandId).select('name email members');
  if (reservation.sharePlan?.shares?.some((share) => share.status === 'paid')) {
    await require('../wallet/service').refundPaidShares(reservation); // carga diferida: evita dependencia circular
  }
  if (band) {
    await notifyBand(band, {
      kind: 'reservation_expired', title: 'Tu apartado venció',
      body: `Pasaron ${HOLD_HOURS} horas sin pagar el anticipo de ${reservation.roomName} (${reservation.date} ${reservation.startTime}). La sala se liberó.`,
      link: '/banda', dedupeKey: `expired:${reservation.id}`
    });
  }
};
