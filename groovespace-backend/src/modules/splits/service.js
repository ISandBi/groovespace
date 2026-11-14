const Band = require('../../models/Band');
const Reservation = require('../../models/Reservation');
const { isSimulatedPayments } = require('../../config/payment');
const { loadPayable, applyReservationPayment } = require('../payments/service');
const intents = require('../payments/intents');
const { notify } = require('../notifications/service');
const { assert, isObjectId } = require('../../lib/http');

const ensureAvailable = () => assert(isSimulatedPayments(), 409, 'Dividir pagos está disponible con la pasarela simulada. Con pagos reales lo paga el líder o el tesorero.');

const participantsOf = (band) => [{ id: 'leader', name: band.leaderName }, ...band.members.map((member) => ({ id: member.id, name: member.name }))];

/** Reparte `amount` en partes enteras que suman exactamente el total (el resto se reparte de uno en uno). */
exports.equalShares = (amount, count) => {
  const base = Math.floor(amount / count);
  const extra = amount - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
};

exports.getPlan = async ({ actor, reservationId }) => {
  assert(isObjectId(reservationId), 400, 'Identificador de reserva no válido.');
  const reservation = await Reservation.findOne({ _id: reservationId, bandId: actor.bandId });
  assert(reservation && !reservation.isDemo, 404, 'No se encontró la reserva.');
  return reservation.sharePlan || null;
};

exports.createPlan = async ({ actor, reservationId, paymentType, mode = 'equal', participantIds, shares }) => {
  ensureAvailable();
  assert(isObjectId(reservationId), 400, 'Identificador de reserva no válido.');
  const { reservation, amount } = await loadPayable({ reservationId, paymentType, bandId: actor.bandId });
  assert(!reservation.sharePlan, 409, 'Este pago ya está dividido. Cancela la división para crear otra.');
  const band = await Band.findById(actor.bandId).select('leaderName members');
  const everyone = participantsOf(band);

  let rows;
  if (mode === 'custom') {
    assert(Array.isArray(shares) && shares.length >= 2, 400, 'Define la parte de al menos 2 personas.');
    rows = shares.map((share) => {
      const person = everyone.find((item) => item.id === share?.memberId);
      assert(person, 400, 'Una de las personas no forma parte de la banda.');
      return { memberId: person.id, name: person.name, amount: Number(share.amount) };
    });
    assert(new Set(rows.map((row) => row.memberId)).size === rows.length, 400, 'Una persona aparece más de una vez.');
    assert(rows.every((row) => Number.isInteger(row.amount) && row.amount > 0), 400, 'Cada parte debe ser un importe entero mayor a cero.');
    assert(rows.reduce((sum, row) => sum + row.amount, 0) === amount, 400, `Las partes deben sumar exactamente $${amount} MXN.`);
  } else {
    const selected = Array.isArray(participantIds) && participantIds.length ? everyone.filter((item) => participantIds.includes(item.id)) : everyone;
    assert(selected.length >= 2, 400, 'Selecciona al menos 2 personas para dividir el pago.');
    const parts = exports.equalShares(amount, selected.length);
    rows = selected.map((person, i) => ({ memberId: person.id, name: person.name, amount: parts[i] }));
  }
  reservation.sharePlan = { paymentType, createdAt: new Date(), shares: rows.map((row) => ({ ...row, status: 'pending' })) };
  await reservation.save();

  await Promise.all(rows.map((row) => notify({
    recipientType: row.memberId === 'leader' ? 'band' : 'member', recipientId: row.memberId === 'leader' ? actor.bandId : row.memberId,
    kind: 'split_assigned', title: `Tu parte: $${row.amount} MXN`, body: `Paga tu parte de ${reservation.roomName} (${reservation.date} ${reservation.startTime}) desde “Mis reservas”.`, link: '/banda',
    dedupeKey: `split:${reservation.id}:${paymentType}:${row.memberId}`
  })));
  return reservation.sharePlan;
};

exports.cancelPlan = async ({ actor, reservationId }) => {
  const reservation = await Reservation.findOne({ _id: reservationId, bandId: actor.bandId });
  assert(reservation?.sharePlan, 404, 'Esta reserva no tiene un pago dividido.');
  assert(!reservation.sharePlan.shares.some((share) => share.status === 'paid'), 409, 'Ya hay partes pagadas: no se puede cancelar la división.');
  reservation.sharePlan = undefined;
  await reservation.save();
};

exports.payShare = async ({ actor, reservationId, memberId }) => {
  ensureAvailable();
  const reservation = await Reservation.findOne({ _id: reservationId, bandId: actor.bandId });
  assert(reservation?.sharePlan, 404, 'Esta reserva no tiene un pago dividido.');
  const mine = actor.type === 'band' ? 'leader' : actor.id;
  const target = memberId || mine;
  assert(target === mine || ['lider', 'tesorero'].includes(actor.role), 403, 'Sólo puedes pagar tu propia parte.');
  const share = reservation.sharePlan.shares.find((item) => item.memberId === target);
  assert(share, 404, 'Esa persona no tiene una parte en este pago.');
  assert(share.status === 'pending', 409, 'Esta parte ya está pagada.');
  await loadPayable({ reservationId, paymentType: reservation.sharePlan.paymentType, bandId: actor.bandId });
  const { checkoutUrl } = await intents.createIntent({
    purpose: 'split_share', amount: share.amount, label: `Parte de ${share.name} · ${reservation.roomName}`, actor,
    returnPath: '/banda', meta: { reservationId, paymentType: reservation.sharePlan.paymentType, memberId: target }
  });
  return { checkoutUrl };
};

intents.registerHandler('split_share', async (intent) => {
  const { reservationId, paymentType, memberId } = intent.meta;
  const updated = await Reservation.findOneAndUpdate(
    { _id: reservationId, 'sharePlan.paymentType': paymentType, 'sharePlan.shares': { $elemMatch: { memberId, status: 'pending' } } },
    { $set: { 'sharePlan.shares.$.status': 'paid', 'sharePlan.shares.$.paidAt': new Date() } },
    { new: true }
  );
  if (!updated) throw new Error('La parte ya estaba pagada o el plan cambió.');
  const allPaid = updated.sharePlan.shares.every((share) => share.status === 'paid');
  if (allPaid) {
    await applyReservationPayment(updated, paymentType, { simulated: true, receipt: { brand: intent.cardBrand, last4: intent.cardLast4, privacyAcceptedAt: intent.privacyAcceptedAt, privacyVersion: intent.privacyVersion } });
  }
  return { reservationId, memberId, allPaid };
});
