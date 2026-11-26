const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../src/modules/music/rules');

test('las primeras reproducciones pagadas de una banda valen el doble', () => {
  assert.equal(rules.payout(0, 0), 2);
  assert.equal(rules.payout(rules.bonusPlays - 1, 0), 2);
  assert.equal(rules.payout(rules.bonusPlays, 0), 1);
});

test('el tope mensual por banda detiene el abono', () => {
  assert.equal(rules.payout(500, rules.monthlyCapPerBand - 1), 1); // todavía cabe
  assert.equal(rules.payout(500, rules.monthlyCapPerBand), 0);
  assert.equal(rules.payout(0, rules.monthlyCapPerBand - 1), 0); // el doble ya no cabe
});
