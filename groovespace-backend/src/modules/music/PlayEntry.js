const mongoose = require('mongoose');

// Una reproducción iniciada por un oyente. Se vuelve "válida" al completarse (>= 30 s medidos por el servidor).
const playSchema = new mongoose.Schema({
  listenerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listener', required: true, index: true },
  demoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Demo', required: true, index: true },
  bandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Band', required: true, index: true },
  day: { type: String, required: true }, // YYYY-MM-DD (UTC)
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
  paid: { type: Boolean, default: false },
  amount: { type: Number, default: 0 }
});
// Una reproducción pagada por oyente, canción y día (la carrera entre dos solicitudes la resuelve el índice).
playSchema.index({ listenerId: 1, demoId: 1, day: 1 }, { unique: true, partialFilterExpression: { paid: true } });

module.exports = mongoose.model('PlayEntry', playSchema);
