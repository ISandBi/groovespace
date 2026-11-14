const mongoose = require('mongoose');

const STAGES = ['recorded', 'editing', 'mixing', 'mastering', 'delivered'];

const deliverableSchema = new mongoose.Schema({
  reservationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation', required: true, index: true },
  bandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Band', required: true, index: true },
  engineerId: { type: String, required: true, index: true },
  title: { type: String, required: true, maxlength: 120 },
  stage: { type: String, enum: STAGES, default: 'recorded' },
  versions: [{
    n: { type: Number, required: true },
    label: { type: String, maxlength: 80, default: '' },
    notes: { type: String, maxlength: 600, default: '' },
    storageKey: { type: String, required: true, select: false },
    mime: String, size: Number, sha256: String, lossless: Boolean, kind: String,
    uploadedAt: { type: Date, default: Date.now },
    approvedAt: Date, approvedBy: String
  }],
  comments: [{
    versionN: Number,
    atSec: { type: Number, min: 0, default: 0 }, // minuto exacto del comentario
    authorType: String, authorName: String,
    text: { type: String, maxlength: 500 },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Deliverable', deliverableSchema);
module.exports.STAGES = STAGES;
