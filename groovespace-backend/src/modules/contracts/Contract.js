const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
  bandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Band', required: true, index: true },
  kind: { type: String, enum: ['rental_terms', 'co_production'], required: true },
  title: { type: String, required: true, maxlength: 140 },
  body: { type: String, required: true, maxlength: 8000 },
  bodyHash: { type: String, required: true },
  parties: [{ _id: false, key: String, name: String, role: String }],
  // Reparto de regalías / derechos entre las partes (debe sumar 100%) — sólo en coproducciones.
  splits: [{ _id: false, key: String, label: String, percent: Number }],
  signatures: [{ _id: false, key: String, name: String, typedName: String, signedAt: Date, sealHash: String }],
  status: { type: String, enum: ['pending_signatures', 'fully_signed', 'void'], default: 'pending_signatures' },
  // Base para el siguiente alcance: sellado de tiempo NOM-151 con un proveedor certificado.
  // Mientras provider.name sea 'internal', las firmas son electrónicas simples SIN validez de conservación NOM-151.
  provider: {
    name: { type: String, default: 'internal' },
    externalEnvelopeId: String,
    nom151: { status: { type: String, enum: ['not_connected', 'pending', 'stamped'], default: 'not_connected' }, certificateRef: String, stampedAt: Date }
  },
  createdBy: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Contract', contractSchema);
