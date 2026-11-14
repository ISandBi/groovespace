const crypto = require('crypto');

// Tiempo que una banda tiene para pagar el anticipo antes de que la reserva se cancele.
exports.HOLD_MS = 12 * 60 * 60 * 1000;
exports.HOLD_HOURS = 12;

const hasPayPalCredentials = () => {
  const id = process.env.PAYPAL_CLIENT_ID || '';
  const secret = process.env.PAYPAL_CLIENT_SECRET || '';
  return Boolean(id && secret) && !/replace_me/i.test(`${id}${secret}`);
};
exports.hasPayPalCredentials = hasPayPalCredentials;

// Pago simulado: se activa con PAYMENTS_SIMULATED=true, o automáticamente en desarrollo si no hay credenciales de PayPal.
// En producción sólo se activa si se pide de forma explícita.
exports.isSimulatedPayments = () => process.env.PAYMENTS_SIMULATED === 'true' ||
  (process.env.NODE_ENV !== 'production' && !hasPayPalCredentials());

exports.newTicketCode = () => `GS-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
exports.todayInMexicoCity = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

// Tipos de pago de una reserva: de qué estado parten, a cuál llegan y cuánto cuestan.
exports.PAYMENT_TYPES = {
  deposit: { from: 'deposit_pending', to: 'deposit_paid', label: 'Anticipo 50%', sessionField: 'depositOrderId', amount: (r) => r.depositAmount },
  full: { from: 'deposit_pending', to: 'paid', label: 'Pago al contado', sessionField: 'depositOrderId', amount: (r) => r.totalPrice },
  balance: { from: 'deposit_paid', to: 'paid', label: 'Saldo de la reserva', sessionField: 'balanceOrderId', amount: (r) => r.balanceAmount }
};
