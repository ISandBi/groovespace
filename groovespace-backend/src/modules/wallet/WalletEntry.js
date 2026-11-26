const mongoose = require('mongoose');

// Libro de movimientos de la cartera interna. `amount` es con signo: positivo abona, negativo cobra.
const walletEntrySchema = new mongoose.Schema({
  bandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Band', required: true, index: true },
  type: { type: String, enum: ['topup', 'payment', 'refund', 'play'], required: true },
  amount: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  concept: { type: String, required: true, maxlength: 160 },
  ref: { type: String },
  createdAt: { type: Date, default: Date.now, index: true }
});
walletEntrySchema.index({ ref: 1, type: 1 }, { unique: true, sparse: true }); // un reembolso o recarga por referencia

module.exports = mongoose.model('WalletEntry', walletEntrySchema);
