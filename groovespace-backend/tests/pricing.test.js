const test = require('node:test');
const assert = require('node:assert/strict');
const { buildQuote } = require('../src/lib/pricing');

test('suma sala, equipo, extras e ingeniero por hora y calcula el anticipo', () => {
  const quote = buildQuote({ roomId: 'sala_estudio_a', duration: 2, attendees: 5, gearIds: ['git_1'], extraIds: ['rec_multitrack', 'backline_tech'], engineerId: 'eng-ana' });
  assert.equal(quote.total, 700 + 160 + 450 + 240 + 360);
  assert.equal(quote.deposit, Math.ceil(quote.total / 2));
  assert.equal(quote.deposit + quote.balance, quote.total);
});

test('ignora duplicados y rechaza ids inválidos', () => {
  assert.equal(buildQuote({ roomId: 'sala_ensayo_b', duration: 1, attendees: 1, gearIds: ['amp_1', 'amp_1'] }).total, 220 + 100);
  assert.throws(() => buildQuote({ roomId: 'sala_ensayo_b', duration: 1, attendees: 1, gearIds: ['nope'] }), /equipo/);
  assert.throws(() => buildQuote({ roomId: 'nope', duration: 1, attendees: 1 }), /sala/);
  assert.throws(() => buildQuote({ roomId: 'sala_ensayo_b', duration: 9, attendees: 1 }), /entre/);
  assert.throws(() => buildQuote({ roomId: 'sala_ensayo_b', duration: 1, attendees: 99 }), /admite/);
  assert.throws(() => buildQuote({ roomId: 'sala_ensayo_b', duration: 1, attendees: 1, engineerId: 'x' }), /ingeniero/);
});
