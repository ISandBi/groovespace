const mongoose = require('mongoose');

// Intención de pago para compras que no son una reserva: recarga de cartera, parte de un pago dividido
// y boletos de eventos. Guarda sólo lo necesario; jamás datos de tarjeta.
const paymentIntentSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  purpose: { type: String, enum: ['wallet_topup', 'split_share', 'event_ticket'], required: true },
  amount: { type: Number, required: true, min: 1 },
  label: { type: String, required: true },
  actorType: { type: String, enum: ['band', 'public'], default: 'band' },
  actorId: { type: String },
  returnPath: { type: String, default: '/' },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  result: { type: mongoose.Schema.Types.Mixed },
  cardBrand: String,
  cardLast4: String,
  privacyAcceptedAt: Date,
  privacyVersion: String,
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true }
});

paymentIntentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

module.exports = mongoose.model('PaymentIntent', paymentIntentSchema);
