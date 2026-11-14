const Band = require('../../models/Band');
const Reservation = require('../../models/Reservation');
const WalletEntry = require('./WalletEntry');
const intents = require('../payments/intents');
const { loadPayable, applyReservationPayment } = require('../payments/service');
const { isSimulatedPayments } = require('../../config/payment');
const { assert, isObjectId } = require('../../lib/http');

const MIN_TOPUP = 100;
const MAX_TOPUP = 20000;

/** Abona a la cartera y deja el movimiento en el libro. `ref` hace la operación idempotente. */
exports.credit = async ({ bandId, amount, type, concept, ref }) => {
  if (ref && await WalletEntry.exists({ ref, type })) return null;
  const band = await Band.findByIdAndUpdate(bandId, { $inc: { walletBalance: amount } }, { new: true }).select('walletBalance');
  if (!band) return null;
  try {
    await WalletEntry.create({ bandId, type, amount, balanceAfter: band.walletBalance, concept, ref });
  } catch (error) {
    if (error.code === 11000) { await Band.updateOne({ _id: bandId }, { $inc: { walletBalance: -amount } }); return null; }
    throw error;
  }
  return band.walletBalance;
};

/** Cobra de la cartera sólo si alcanza el saldo (operación atómica). */
exports.debit = async ({ bandId, amount, concept, ref }) => {
  const band = await Band.findOneAndUpdate({ _id: bandId, walletBalance: { $gte: amount } }, { $inc: { walletBalance: -amount } }, { new: true }).select('walletBalance');
  if (!band) return null;
  await WalletEntry.create({ bandId, type: 'payment', amount: -amount, balanceAfter: band.walletBalance, concept, ref });
  return band.walletBalance;
};

exports.summary = async (bandId) => {
  const band = await Band.findById(bandId).select('walletBalance');
  assert(band, 404, 'No se encontró la banda.');
  const [entries, paid] = await Promise.all([
    WalletEntry.find({ bandId }).sort({ createdAt: -1 }).limit(50),
    Reservation.find({ bandId, isDemo: { $ne: true }, paymentStatus: { $in: ['deposit_paid', 'paid'] } }).select('date roomName totalPrice depositAmount paymentStatus')
  ]);
  const byMonth = {};
  const byRoom = {};
  paid.forEach((reservation) => {
    const amount = reservation.paymentStatus === 'paid' ? reservation.totalPrice : reservation.depositAmount;
    byMonth[reservation.date.slice(0, 7)] = (byMonth[reservation.date.slice(0, 7)] || 0) + amount;
    byRoom[reservation.roomName] = (byRoom[reservation.roomName] || 0) + amount;
  });
  return {
    balance: band.walletBalance, entries,
    spending: { byMonth: Object.entries(byMonth).sort().map(([month, total]) => ({ month, total })), byRoom: Object.entries(byRoom).map(([room, total]) => ({ room, total })).sort((a, b) => b.total - a.total) },
    withdrawals: { enabled: false, note: 'Los retiros a cuenta bancaria se habilitarán junto con los ingresos de la app móvil.' }
  };
};

exports.startTopup = async ({ actor, amount }) => {
  assert(isSimulatedPayments(), 409, 'La recarga de cartera está disponible con la pasarela simulada.');
  const value = Number(amount);
  assert(Number.isInteger(value) && value >= MIN_TOPUP && value <= MAX_TOPUP, 400, `Recarga entre $${MIN_TOPUP} y $${MAX_TOPUP} MXN, en pesos enteros.`);
  const { checkoutUrl } = await intents.createIntent({ purpose: 'wallet_topup', amount: value, label: 'Recarga de cartera GrooveSpace', actor, returnPath: '/banda' });
  return { checkoutUrl };
};

intents.registerHandler('wallet_topup', async (intent) => {
  const balance = await exports.credit({ bandId: intent.actorId, amount: intent.amount, type: 'topup', concept: `Recarga con ${intent.cardBrand} ••${intent.cardLast4}`, ref: intent.sessionId });
  return { balance };
});

exports.payReservation = async ({ actor, reservationId, paymentType = 'deposit' }) => {
  assert(isObjectId(reservationId), 400, 'Identificador de reserva no válido.');
  const { reservation, type, amount } = await loadPayable({ reservationId, paymentType, bandId: actor.bandId });
  assert(!reservation.sharePlan, 409, 'Este pago está dividido entre los integrantes.');
  const ref = `res:${reservation.id}:${paymentType}`;
  const balance = await exports.debit({ bandId: actor.bandId, amount, concept: `${type.label} · ${reservation.roomName}`, ref });
  assert(balance !== null, 402, 'Saldo insuficiente en la cartera. Recárgala para continuar.');
  const updated = await applyReservationPayment(reservation, paymentType, { method: 'wallet', receipt: { brand: 'Cartera GrooveSpace', last4: undefined, privacyAcceptedAt: undefined, privacyVersion: undefined } });
  if (!updated) {
    await exports.credit({ bandId: actor.bandId, amount, type: 'refund', concept: 'Reembolso: el pago no pudo aplicarse', ref: `${ref}:undo` });
    assert(false, 409, 'El estado de la reserva cambió. No se cobró nada.');
  }
  return { reservation: updated, balance };
};

/** Si una reserva vence con partes ya pagadas, esas partes regresan a la cartera de la banda. */
exports.refundPaidShares = async (reservation) => {
  const paid = (reservation.sharePlan?.shares || []).filter((share) => share.status === 'paid');
  const total = paid.reduce((sum, share) => sum + share.amount, 0);
  if (total > 0) {
    await exports.credit({ bandId: reservation.bandId, amount: total, type: 'refund', concept: `Reembolso: la reserva del ${reservation.date} venció con partes pagadas`, ref: `expire:${reservation.id}` });
  }
};
