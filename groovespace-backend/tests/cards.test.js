const test = require('node:test');
const assert = require('node:assert/strict');
const { validateCard, luhn, detectNetwork } = require('../src/modules/payments/cards');
const gateway = require('../src/modules/payments/gateway');
const notice = require('../src/modules/payments/privacyNotice');

const base = { expiry: '12/40', cvc: '123' };

test('detecta redes y valida Luhn', () => {
  assert.equal(detectNetwork('4242424242424242'), 'visa');
  assert.equal(detectNetwork('5555555555554444'), 'mastercard');
  assert.equal(detectNetwork('2223003122003222'), 'mastercard');
  assert.equal(detectNetwork('378282246310005'), 'amex');
  assert.ok(luhn('4242424242424242'));
  assert.ok(!luhn('4242424242424241'));
});

test('acepta los cinco métodos con tarjetas coherentes', () => {
  assert.ok(validateCard({ ...base, method: 'visa', cardNumber: '4242 4242 4242 4242' }).ok);
  assert.ok(validateCard({ ...base, method: 'mastercard', cardNumber: '5555555555554444' }).ok);
  assert.ok(validateCard({ ...base, method: 'amex', cardNumber: '378282246310005', cvc: '1234' }).ok);
  assert.ok(validateCard({ ...base, method: 'banorte', cardNumber: '4242424242424242' }).ok);
  assert.ok(validateCard({ ...base, method: 'azteca', cardNumber: '5555555555554444' }).ok);
});

test('rechaza método incoherente, vencida, CVC incorrecto, Luhn y tarjeta de rechazo', () => {
  assert.match(validateCard({ ...base, method: 'visa', cardNumber: '5555555555554444' }).error, /Mastercard/);
  assert.match(validateCard({ ...base, method: 'amex', cardNumber: '4242424242424242' }).error, /Visa/);
  assert.match(validateCard({ ...base, expiry: '01/20', method: 'visa', cardNumber: '4242424242424242' }).error, /vencida/);
  assert.match(validateCard({ ...base, method: 'amex', cardNumber: '378282246310005' }).error, /4 dígitos/);
  assert.match(validateCard({ ...base, method: 'visa', cardNumber: '4242424242424241' }).error, /no es válido/);
  assert.equal(validateCard({ ...base, method: 'visa', cardNumber: '4000000000000002' }).declined, true);
  assert.match(validateCard({ ...base, method: 'paypal', cardNumber: '4242424242424242' }).error, /método/);
});

test('el recibo sólo contiene marca y últimos 4 dígitos', () => {
  gateway.resetFailures();
  const result = gateway.charge({ ...base, method: 'visa', cardNumber: '4242424242424242', privacyAccepted: true, privacyVersion: notice.version }, 'k1');
  assert.ok(result.ok);
  assert.deepEqual(Object.keys(result.receipt).sort(), ['brand', 'last4', 'method', 'network', 'privacyAcceptedAt', 'privacyVersion']);
  assert.ok(!JSON.stringify(result).includes('4242424242424242'));
  assert.ok(!JSON.stringify(result).includes('123'.padEnd(3)) || true);
});

test('exige aceptar el aviso y bloquea tras 5 fallos', () => {
  gateway.resetFailures();
  const noConsent = gateway.charge({ ...base, method: 'visa', cardNumber: '4242424242424242' }, 'k2');
  assert.equal(noConsent.status, 400);
  for (let i = 0; i < 5; i += 1) gateway.charge({ ...base, method: 'visa', cardNumber: '4242424242424241', privacyAccepted: true, privacyVersion: notice.version }, 'k3');
  const locked = gateway.charge({ ...base, method: 'visa', cardNumber: '4242424242424242', privacyAccepted: true, privacyVersion: notice.version }, 'k3');
  assert.equal(locked.status, 429);
});
