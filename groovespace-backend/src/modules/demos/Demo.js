const mongoose = require('mongoose');

const demoSchema = new mongoose.Schema({
  bandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Band', required: true, index: true },
  engineerId: { type: String, required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  kind: { type: String, enum: ['audio', 'video'], required: true },
  storageKey: { type: String, required: true, select: false },
  originalName: { type: String, default: '' },
  mime: { type: String, required: true },
  size: { type: Number, required: true },
  sha256: { type: String, required: true }, // integridad: el archivo se guarda tal cual lo subió la banda
  lossless: { type: Boolean, default: false },
  meta: { type: mongoose.Schema.Types.Mixed },
  rights: {
    holder: { type: String, required: true },
    acceptedAt: { type: Date, required: true },
    statement: { type: String, required: true }
  },
  agreement: {
    version: String,
    textHash: String,
    engineerName: String,
    engineerSignedAt: Date,
    grooveSpaceSignatory: String,
    sealHash: String
  },
  // Publicación en la app móvil: la banda decide qué demos se escuchan y con qué letra.
  published: { type: Boolean, default: false, index: true },
  publishedAt: Date,
  lyrics: { type: String, default: '', maxlength: 8000 },
  listens: [{ _id: false, at: Date }],
  review: {
    status: { type: String, enum: ['new', 'listened', 'accepted', 'needs_changes', 'declined'], default: 'new' },
    feedback: { type: String, default: '' },
    at: Date
  }
}, { timestamps: true });

module.exports = mongoose.model('Demo', demoSchema);
