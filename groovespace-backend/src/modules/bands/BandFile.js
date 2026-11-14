const mongoose = require('mongoose');

const bandFileSchema = new mongoose.Schema({
  bandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Band', required: true, index: true },
  name: { type: String, required: true, maxlength: 160 },
  mime: { type: String, required: true },
  size: { type: Number, required: true },
  storageKey: { type: String, required: true, select: false },
  sha256: String,
  // band: sólo la banda · engineer: también el ingeniero asignado a una sesión de la banda
  visibility: { type: String, enum: ['band', 'engineer'], default: 'band' },
  uploadedBy: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('BandFile', bandFileSchema);
