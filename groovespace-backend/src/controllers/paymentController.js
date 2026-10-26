const crypto = require('crypto');
const Reservation = require('../models/Reservation');
const ReservationSlot = require('../models/ReservationSlot');

const stripeRequest = async (path, method, fields) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    const error = new Error('La pasarela de pago no está configurada.');
    error.status = 503;
    throw error;
  }

  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      ...(fields ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {})
    },
    body: fields ? new URLSearchParams(fields) : undefined
  });
  const payload = await response.json();

  if (!response.ok) {
    const error = new Error(payload.error?.message || 'Stripe no pudo procesar la operación.');
    error.status = response.status;
    throw error;
  }
  return payload;
};

exports.expireOpenCheckoutSessions = async (reservations) => {
  const sessionIds = new Set(
    reservations.flatMap(({ stripeDepositSessionId, stripeBalanceSessionId }) => [
      stripeDepositSessionId,
      stripeBalanceSessionId
    ]).filter(Boolean)
  );
  for (const sessionId of sessionIds) {
    let checkoutSession;
    try {
      checkoutSession = await stripeRequest(`checkout/sessions/${encodeURIComponent(sessionId)}`, 'GET');
    } catch (error) {
      if (error.status === 400 || error.status === 404) continue;
      throw error;
    }
    if (checkoutSession.status === 'complete' && checkoutSession.payment_status !== 'paid') {
      const error = new Error('Hay un pago en proceso. Espera a que Stripe confirme el resultado antes de eliminar la banda.');
      error.status = 409;
      throw error;
    }
    if (checkoutSession.status !== 'open') continue;
    try {
      await stripeRequest(`checkout/sessions/${encodeURIComponent(sessionId)}/expire`, 'POST');
    } catch (error) {
      if (error.status !== 400 && error.status !== 404) throw error;
    }
  }
};

exports.createCheckoutSession = async (req, res) => {
  try {
    const { reservationId, paymentType = 'deposit' } = req.body;
    if (typeof reservationId !== 'string' || !/^[a-f\d]{24}$/i.test(reservationId)) {
      return res.status(400).json({ error: 'Identificador de reserva no válido.' });
    }
    if (!['deposit', 'balance'].includes(paymentType)) {
      return res.status(400).json({ error: 'Tipo de pago no válido.' });
    }

    const reservation = await Reservation.findById(reservationId);
    if (!reservation) return res.status(404).json({ error: 'No se encontró la reserva.' });
    if (String(reservation.bandId) !== req.bandId) return res.status(403).json({ error: 'No tienes acceso al pago de esta reserva.' });
    if (reservation.isDemo) return res.status(409).json({ error: 'Las reservas de demostración no aceptan pagos.' });

    const expectedStatus = paymentType === 'deposit' ? 'deposit_pending' : 'deposit_paid';
    if (reservation.paymentStatus !== expectedStatus) {
      return res.status(409).json({ error: 'El estado de la reserva no permite este pago.' });
    }
    if (paymentType === 'deposit' && reservation.createdAt < new Date(Date.now() - 35 * 60 * 1000)) {
      reservation.paymentStatus = 'expired';
      await reservation.save();
      return res.status(409).json({ error: 'El tiempo para apartar esta sala expiró. Crea una nueva reserva.' });
    }
    if (paymentType === 'balance' && reservation.balanceDueAt <= new Date()) {
      return res.status(409).json({ error: 'El saldo debe liquidarse al menos 24 horas antes de la sesión.' });
    }

    const amount = paymentType === 'deposit' ? reservation.depositAmount : reservation.balanceAmount;
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return res.status(400).json({ error: 'El importe pendiente no es válido.' });
    }

    const previousSessionId = paymentType === 'deposit' ? reservation.stripeDepositSessionId : reservation.stripeBalanceSessionId;
    if (previousSessionId) {
      try {
        const previousSession = await stripeRequest(`checkout/sessions/${encodeURIComponent(previousSessionId)}`, 'GET');
        if (previousSession.status === 'open') {
          await stripeRequest(`checkout/sessions/${encodeURIComponent(previousSessionId)}/expire`, 'POST');
        }
      } catch (error) {
        if (error.status !== 400 && error.status !== 404) throw error;
      }
    }

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const session = await stripeRequest('checkout/sessions', 'POST', {
      mode: 'payment',
      'payment_method_types[0]': 'card',
      success_url: `${frontendUrl}/?payment=success&reservation_id=${reservation.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/?payment=cancelled&reservation_id=${reservation.id}&payment_type=${paymentType}`,
      expires_at: String(Math.floor(Date.now() / 1000) + 31 * 60),
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': 'mxn',
      'line_items[0][price_data][unit_amount]': String(Math.round(amount * 100)),
      'line_items[0][price_data][product_data][name]': `${paymentType === 'deposit' ? 'Anticipo 50%' : 'Saldo de reserva'} - ${reservation.roomName}`,
      'metadata[reservationId]': reservation.id,
      'metadata[paymentType]': paymentType
    });

    if (paymentType === 'deposit') reservation.stripeDepositSessionId = session.id;
    else reservation.stripeBalanceSessionId = session.id;
    await reservation.save();
    return res.status(201).json({ checkoutUrl: session.url, sessionId: session.id });
  } catch (error) {
    console.error('[GrooveSpace] No se pudo crear la sesión de pago.', error.message);
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo iniciar el pago.' });
  }
};

const confirmPaidSession = async (session) => {
  if (session.payment_status !== 'paid' || session.mode !== 'payment' || session.currency !== 'mxn') return null;
  const { reservationId, paymentType } = session.metadata || {};
  if (!reservationId || !/^[a-f\d]{24}$/i.test(reservationId) || !['deposit', 'balance'].includes(paymentType)) return null;

  const reservation = await Reservation.findById(reservationId);
  if (!reservation || reservation.isDemo) return null;
  const expectedSessionId = paymentType === 'deposit'
    ? reservation.stripeDepositSessionId
    : reservation.stripeBalanceSessionId;
  if (!expectedSessionId || expectedSessionId !== session.id) return null;

  const amount = paymentType === 'deposit' ? reservation.depositAmount : reservation.balanceAmount;
  if (!Number.isSafeInteger(amount) || session.amount_total !== amount * 100) return null;
  if ((paymentType === 'deposit' && !['deposit_pending', 'deposit_paid', 'paid'].includes(reservation.paymentStatus)) ||
    (paymentType === 'balance' && !['deposit_paid', 'paid'].includes(reservation.paymentStatus))) return null;

  if (paymentType === 'deposit' && reservation.paymentStatus === 'deposit_pending') {
    reservation.paymentStatus = 'deposit_paid';
    await reservation.save();
  } else if (paymentType === 'balance' && reservation.paymentStatus === 'deposit_paid') {
    reservation.paymentStatus = 'paid';
    await reservation.save();
  }
  await ReservationSlot.updateMany({ reservationId: reservation._id }, { $unset: { expiresAt: 1 } });
  return reservation;
};

exports.verifyCheckoutSession = async (req, res) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.reservationId) ||
      !/^cs_(test|live)_[A-Za-z\d]+$/.test(req.params.sessionId)) {
      return res.status(400).json({ error: 'Identificadores de pago no válidos.' });
    }
    const session = await stripeRequest(`checkout/sessions/${encodeURIComponent(req.params.sessionId)}`, 'GET');
    if (session.metadata?.reservationId !== req.params.reservationId) {
      return res.status(403).json({ error: 'La sesión de pago no corresponde a esta reserva.' });
    }
    const ownedReservation = await Reservation.findById(req.params.reservationId);
    if (!ownedReservation || String(ownedReservation.bandId) !== req.bandId) {
      return res.status(403).json({ error: 'No tienes acceso a esta reserva.' });
    }
    const reservation = await confirmPaidSession(session);
    if (!reservation) return res.status(409).json({ error: 'Stripe aún no confirma el pago.' });
    return res.status(200).json({ reservation });
  } catch (error) {
    console.error('[GrooveSpace] No se pudo verificar la sesión de pago.', error.message);
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo verificar el pago.' });
  }
};

exports.handleWebhook = async (req, res) => {
  const signature = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature || !Buffer.isBuffer(req.body)) {
    return res.status(503).json({ error: 'Webhook de Stripe no configurado.' });
  }

  try {
    const signatureParts = signature.split(',').reduce((parts, part) => {
      const separator = part.indexOf('=');
      if (separator > 0) {
        const key = part.slice(0, separator).trim();
        const value = part.slice(separator + 1).trim();
        parts[key] ||= [];
        parts[key].push(value);
      }
      return parts;
    }, {});
    const timestamp = Number(signatureParts.t?.[0]);
    const signedPayload = `${timestamp}.${req.body.toString('utf8')}`;
    const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    const validSignature = (signatureParts.v1 || []).some((value) => {
      if (!/^[a-f\d]{64}$/i.test(value)) return false;
      return crypto.timingSafeEqual(Buffer.from(value, 'hex'), expectedBuffer);
    });
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300 || !validSignature) {
      return res.status(400).json({ error: 'Firma de webhook inválida.' });
    }

    const event = JSON.parse(req.body.toString('utf8'));
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
      await confirmPaidSession(event.data.object);
    }
    if (event.type === 'checkout.session.expired') {
      const session = event.data.object;
      if (session.metadata?.paymentType === 'deposit') {
        const update = await Reservation.updateOne(
          { _id: session.metadata.reservationId, paymentStatus: 'deposit_pending', stripeDepositSessionId: session.id },
          { $set: { paymentStatus: 'expired' } }
        );
        if (update.modifiedCount) await ReservationSlot.deleteMany({ reservationId: session.metadata.reservationId });
      }
    }
    if (event.type === 'checkout.session.async_payment_failed' && event.data.object.metadata?.paymentType === 'deposit') {
      const session = event.data.object;
      const update = await Reservation.updateOne(
        { _id: session.metadata.reservationId, paymentStatus: 'deposit_pending', stripeDepositSessionId: session.id },
        { $set: { paymentStatus: 'expired' } }
      );
      if (update.modifiedCount) await ReservationSlot.deleteMany({ reservationId: session.metadata.reservationId });
    }
    return res.sendStatus(200);
  } catch (error) {
    console.error('[GrooveSpace] No se pudo procesar el webhook de Stripe.', error.message);
    return res.status(400).json({ error: 'No se pudo validar el evento de Stripe.' });
  }
};