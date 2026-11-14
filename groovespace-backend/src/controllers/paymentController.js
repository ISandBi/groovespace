const crypto = require('crypto');
const Reservation = require('../models/Reservation');
const ReservationSlot = require('../models/ReservationSlot');
const { HOLD_MS, HOLD_HOURS, isSimulatedPayments, PAYMENT_TYPES } = require('../config/payment');
const gateway = require('../modules/payments/gateway');
const intents = require('../modules/payments/intents');
const PaymentIntent = require('../modules/payments/PaymentIntent');
const paymentService = require('../modules/payments/service');
const privacyNotice = require('../modules/payments/privacyNotice');
const { publicMethods } = require('../modules/payments/cards');
const paypal = require('../modules/payments/paypal');

const OBJECT_ID = /^[a-f\d]{24}$/i;
const frontendBase = () => (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const holdExpiredMessage = `Pasaron las ${HOLD_HOURS} horas para pagar el anticipo y la reserva se canceló. Crea una nueva reserva.`;

// Las órdenes de PayPal no se pueden cancelar por API: las no aprobadas caducan solas. Sólo se bloquea el borrado
// si el pagador ya aprobó una orden que todavía no se capturó (pago en proceso).
exports.expireOpenCheckoutSessions = async (reservations) => {
  const orderIds = new Set(
    reservations.flatMap(({ depositOrderId, balanceOrderId }) => [depositOrderId, balanceOrderId])
      .filter((id) => id && !id.startsWith('cs_sim_'))
  );
  for (const orderId of orderIds) {
    let order;
    try {
      order = await paypal.getOrder(orderId);
    } catch (error) {
      if ([400, 404, 422].includes(error.status)) continue;
      throw error;
    }
    if (order.status === 'APPROVED') {
      const error = new Error('Hay un pago en proceso. Espera a que PayPal confirme el resultado antes de eliminar la banda.');
      error.status = 409;
      throw error;
    }
  }
};

const expireReservation = (reservation) => paymentService.expireReservation(reservation);

// Datos públicos para dibujar la pantalla de pago: métodos aceptados y aviso de privacidad versionado.
exports.getPaymentConfig = (req, res) => {
  res.set('Cache-Control', 'no-store');
  return res.status(200).json({ provider: 'paypal', simulated: isSimulatedPayments(), methods: publicMethods(), privacyNotice });
};

exports.createCheckoutSession = async (req, res) => {
  try {
    const { reservationId, paymentType = 'deposit' } = req.body;
    if (typeof reservationId !== 'string' || !OBJECT_ID.test(reservationId)) {
      return res.status(400).json({ error: 'Identificador de reserva no válido.' });
    }
    const type = PAYMENT_TYPES[paymentType];
    if (!type) return res.status(400).json({ error: 'Tipo de pago no válido.' });

    const reservation = await Reservation.findById(reservationId);
    if (!reservation) return res.status(404).json({ error: 'No se encontró la reserva.' });
    if (String(reservation.bandId) !== req.bandId) return res.status(403).json({ error: 'No tienes acceso al pago de esta reserva.' });
    if (reservation.isDemo) return res.status(409).json({ error: 'Las reservas de demostración no aceptan pagos.' });
    if (reservation.paymentStatus !== type.from) {
      return res.status(409).json({ error: 'El estado de la reserva no permite este pago.' });
    }
    if (reservation.sharePlan?.paymentType === paymentType) {
      return res.status(409).json({ error: 'Este pago está dividido entre los integrantes. Cancela la división para pagarlo completo.' });
    }
    if (type.from === 'deposit_pending' && reservation.createdAt < new Date(Date.now() - HOLD_MS)) {
      await expireReservation(reservation);
      return res.status(409).json({ error: holdExpiredMessage });
    }
    if (paymentType === 'balance' && reservation.balanceDueAt <= new Date()) {
      return res.status(409).json({ error: 'El saldo debe liquidarse al menos 24 horas antes de la sesión.' });
    }

    const amount = type.amount(reservation);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return res.status(400).json({ error: 'El importe pendiente no es válido.' });
    }

    if (isSimulatedPayments()) {
      const simulatedId = `cs_sim_${crypto.randomBytes(12).toString('hex')}`;
      reservation[type.sessionField] = simulatedId;
      reservation.paymentMethod = 'simulated';
      await reservation.save();
      return res.status(201).json({
        simulated: true,
        sessionId: simulatedId,
        checkoutUrl: `${frontendBase()}/?payment=simulated&reservation_id=${reservation.id}&payment_type=${paymentType}&session_id=${simulatedId}`
      });
    }

    const query = `reservation_id=${reservation.id}&payment_type=${paymentType}`;
    const order = await paypal.createOrder({
      amount,
      description: `${type.label} - ${reservation.roomName}`,
      customId: `${reservation.id}:${paymentType}`,
      returnUrl: `${frontendBase()}/?payment=success&${query}`,
      cancelUrl: `${frontendBase()}/?payment=cancelled&${query}`,
      requestId: `${reservation.id}-${paymentType}-${Date.now()}`
    });
    reservation[type.sessionField] = order.id;
    reservation.paymentMethod = 'paypal';
    await reservation.save();
    return res.status(201).json({ checkoutUrl: order.approveUrl, sessionId: order.id, provider: 'paypal' });
  } catch (error) {
    console.error('[GrooveSpace] No se pudo crear la sesión de pago.', error.message);
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo iniciar el pago.' });
  }
};

// Concilia un cobro de PayPal ya CAPTURADO con la reserva: id de orden, importe y moneda deben coincidir.
const confirmCompletedOrder = async (summary) => {
  if (!summary || summary.currency !== 'MXN') return null;
  const [reservationId, paymentType] = String(summary.customId || '').split(':');
  const type = PAYMENT_TYPES[paymentType];
  if (!reservationId || !OBJECT_ID.test(reservationId) || !type) return null;

  const reservation = await Reservation.findById(reservationId);
  if (!reservation || reservation.isDemo) return null;
  if (!reservation[type.sessionField] || reservation[type.sessionField] !== summary.orderId) return null;
  const amount = type.amount(reservation);
  if (!Number.isSafeInteger(amount) || paypal.money(summary.amount) !== paypal.money(amount)) return null;
  return paymentService.applyReservationPayment(reservation, paymentType, { method: 'paypal' });
};

// Datos de una sesión de pago simulada (importe, concepto, a dónde volver). El id de sesión es secreto y de un solo uso.
exports.describeSession = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const { sessionId } = req.params;
    if (!/^cs_sim_[a-f\d]{24}$/.test(sessionId) || !isSimulatedPayments()) return res.status(404).json({ error: 'Sesión de pago no encontrada.' });
    const intent = await PaymentIntent.findOne({ sessionId });
    if (intent) {
      return res.status(200).json({ purpose: intent.purpose, label: intent.label, amount: intent.amount, status: intent.status, returnPath: intent.returnPath, requiresLogin: intent.actorType === 'band' });
    }
    const reservation = await Reservation.findOne({ $or: [{ depositOrderId: sessionId }, { balanceOrderId: sessionId }] });
    if (!reservation) return res.status(404).json({ error: 'Sesión de pago no encontrada.' });
    const paymentType = reservation.balanceOrderId === sessionId ? 'balance' : (reservation.payPlan === 'full' ? 'full' : 'deposit');
    const type = PAYMENT_TYPES[req.query.payment_type] && reservation.depositOrderId === sessionId ? PAYMENT_TYPES[req.query.payment_type] : PAYMENT_TYPES[paymentType];
    return res.status(200).json({ purpose: 'reservation', label: `${type.label} · ${reservation.roomName}`, amount: type.amount(reservation), status: reservation.paymentStatus, returnPath: '/banda', requiresLogin: true });
  } catch {
    return res.status(500).json({ error: 'No se pudo consultar la sesión de pago.' });
  }
};

// Pago simulado: reproduce lo que hace la pasarela sin cobrar nada. Sólo funciona con PAYMENTS_SIMULATED activo (o sin credenciales de PayPal en desarrollo).
// Los datos de tarjeta existen únicamente dentro de esta petición: no se guardan ni se registran.
exports.simulatePayment = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    if (!isSimulatedPayments()) return res.status(404).json({ error: 'El pago simulado no está habilitado.' });
    const body = req.body || {};
    const { reservationId, sessionId } = body;
    if (typeof sessionId !== 'string' || !/^cs_sim_[a-f\d]{24}$/.test(sessionId)) return res.status(400).json({ error: 'Datos de pago no válidos.' });

    // 1) Compra que no es una reserva (cartera, parte de un pago dividido, boleto de evento).
    if (!reservationId) {
      const intent = await PaymentIntent.findOne({ sessionId });
      if (!intent || intent.expiresAt <= new Date()) return res.status(404).json({ error: 'La sesión de pago no existe o expiró.' });
      if (intent.status === 'paid') return res.status(409).json({ error: 'Este pago ya se realizó.' });
      if (intent.actorType === 'band' && (!req.bandId || String(req.bandId) !== intent.actorId)) {
        return res.status(403).json({ error: 'Inicia sesión con la banda que generó este pago.' });
      }
      const charge = gateway.charge(body, `intent:${sessionId}`);
      if (!charge.ok) return res.status(charge.status).json({ error: charge.error });
      const claimed = await PaymentIntent.findOneAndUpdate(
        { _id: intent._id, status: 'pending' },
        { $set: { status: 'paid', cardBrand: charge.receipt.brand, cardLast4: charge.receipt.last4, privacyAcceptedAt: charge.receipt.privacyAcceptedAt, privacyVersion: charge.receipt.privacyVersion } },
        { new: true }
      );
      if (!claimed) return res.status(409).json({ error: 'Este pago ya se realizó.' });
      try {
        const result = await intents.runHandler(claimed);
        await PaymentIntent.updateOne({ _id: claimed._id }, { $set: { result } });
        return res.status(200).json({ purpose: claimed.purpose, result, returnPath: claimed.returnPath, receipt: { brand: charge.receipt.brand, last4: charge.receipt.last4 } });
      } catch (error) {
        await PaymentIntent.updateOne({ _id: claimed._id }, { $set: { status: 'failed' } });
        console.error('[GrooveSpace] El pago se validó pero no se pudo aplicar.', error.message);
        return res.status(500).json({ error: 'El pago no se pudo aplicar. No se realizó ningún cargo; intenta de nuevo.' });
      }
    }

    // 2) Pago de una reserva.
    const { paymentType = 'deposit' } = body;
    const type = PAYMENT_TYPES[paymentType];
    if (typeof reservationId !== 'string' || !OBJECT_ID.test(reservationId) || !type) return res.status(400).json({ error: 'Datos de pago no válidos.' });
    if (!req.bandId || !['lider', 'tesorero'].includes(req.actor?.role)) return res.status(403).json({ error: 'Sólo el líder o el tesorero de la banda pagan la reserva completa.' });

    const reservation = await Reservation.findById(reservationId);
    if (!reservation || reservation.isDemo) return res.status(404).json({ error: 'No se encontró la reserva.' });
    if (String(reservation.bandId) !== req.bandId) return res.status(403).json({ error: 'No tienes acceso al pago de esta reserva.' });
    const expectedSession = reservation[type.sessionField];
    if (!expectedSession || expectedSession !== sessionId) {
      return res.status(409).json({ error: 'La sesión de pago simulada no corresponde a esta reserva.' });
    }
    if (reservation.paymentStatus !== type.from) {
      return res.status(409).json({ error: reservation.paymentStatus === 'expired' ? holdExpiredMessage : 'El estado de la reserva no permite este pago.' });
    }
    if (type.from === 'deposit_pending' && reservation.createdAt < new Date(Date.now() - HOLD_MS)) {
      await expireReservation(reservation);
      return res.status(409).json({ error: holdExpiredMessage });
    }
    const charge = gateway.charge(body, `reservation:${reservationId}`);
    if (!charge.ok) return res.status(charge.status).json({ error: charge.error });
    const updated = await paymentService.applyReservationPayment(reservation, paymentType, { simulated: true, receipt: charge.receipt });
    if (!updated) return res.status(409).json({ error: 'El estado de la reserva no permite este pago.' });
    return res.status(200).json({ reservation: updated, receipt: { brand: charge.receipt.brand, last4: charge.receipt.last4 } });
  } catch (error) {
    console.error('[GrooveSpace] No se pudo registrar el pago simulado.', error.message);
    return res.status(500).json({ error: 'No se pudo registrar el pago simulado.' });
  }
};

exports.verifyCheckoutSession = async (req, res) => {
  try {
    const { reservationId, sessionId } = req.params;
    if (!OBJECT_ID.test(reservationId) || !/^(cs_sim_[a-f\d]{24}|[A-Za-z\d]{8,40})$/.test(sessionId)) {
      return res.status(400).json({ error: 'Identificadores de pago no válidos.' });
    }
    const owned = await Reservation.findById(reservationId);
    if (!owned || String(owned.bandId) !== req.bandId) return res.status(403).json({ error: 'No tienes acceso a esta reserva.' });
    if (![owned.depositOrderId, owned.balanceOrderId].includes(sessionId)) {
      return res.status(403).json({ error: 'La orden de pago no corresponde a esta reserva.' });
    }

    if (sessionId.startsWith('cs_sim_')) {
      if (!isSimulatedPayments()) return res.status(403).json({ error: 'No tienes acceso a esta reserva.' });
      if (!['deposit_paid', 'paid'].includes(owned.paymentStatus)) return res.status(409).json({ error: 'El pago simulado aún no se registra.' });
      return res.status(200).json({ reservation: owned });
    }

    // PayPal: al volver del checkout la orden suele estar APPROVED; se captura aquí (idempotente) y sólo entonces se confirma.
    let order = await paypal.getOrder(sessionId);
    if (order.status === 'APPROVED') {
      const type = PAYMENT_TYPES[(order.purchase_units?.[0]?.custom_id || '').split(':')[1]];
      if (!type || owned.paymentStatus !== type.from) {
        return res.status(409).json({ error: owned.paymentStatus === 'expired' ? holdExpiredMessage : 'El estado de la reserva no permite este pago.' });
      }
      if (type.from === 'deposit_pending' && owned.createdAt < new Date(Date.now() - HOLD_MS)) {
        await expireReservation(owned);
        return res.status(409).json({ error: holdExpiredMessage });
      }
      order = await paypal.captureOrder(sessionId);
    }
    const reservation = await confirmCompletedOrder(paypal.summarizeCompletedOrder(order));
    if (!reservation) return res.status(409).json({ error: 'PayPal aún no confirma el pago.' });
    return res.status(200).json({ reservation });
  } catch (error) {
    console.error('[GrooveSpace] No se pudo verificar la orden de pago.', error.message);
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo verificar el pago.' });
  }
};

// Webhook de PayPal (PAYMENT.CAPTURE.COMPLETED, CHECKOUT.ORDER.APPROVED). La firma se valida con la API de PayPal.
exports.handleWebhook = async (req, res) => {
  if (!process.env.PAYPAL_WEBHOOK_ID || !Buffer.isBuffer(req.body)) {
    return res.status(503).json({ error: 'Webhook de PayPal no configurado.' });
  }
  try {
    if (!(await paypal.verifyWebhook(req.headers, req.body))) return res.status(400).json({ error: 'Firma de webhook inválida.' });
    const event = JSON.parse(req.body.toString('utf8'));
    if (event.event_type === 'CHECKOUT.ORDER.APPROVED') {
      const orderId = event.resource?.id;
      const [reservationId, paymentType] = String(event.resource?.purchase_units?.[0]?.custom_id || '').split(':');
      const type = PAYMENT_TYPES[paymentType];
      const reservation = OBJECT_ID.test(reservationId || '') && type ? await Reservation.findById(reservationId) : null;
      if (reservation && reservation[type.sessionField] === orderId && reservation.paymentStatus === type.from) {
        const captured = await paypal.captureOrder(orderId);
        await confirmCompletedOrder(paypal.summarizeCompletedOrder(captured));
      }
    }
    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
      if (orderId) await confirmCompletedOrder(paypal.summarizeCompletedOrder(await paypal.getOrder(orderId)));
    }
    return res.sendStatus(200);
  } catch (error) {
    console.error('[GrooveSpace] No se pudo procesar el webhook de PayPal.', error.message);
    return res.status(400).json({ error: 'No se pudo validar el evento de PayPal.' });
  }
};
