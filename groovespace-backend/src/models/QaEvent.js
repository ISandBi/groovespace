const mongoose = require('mongoose');

const qaEventSchema = new mongoose.Schema({
  eventType: {
    type: String,
    enum: ['api_request', 'login_attempt', 'band_registration_attempt', 'ui_navigation', 'ui_copy', 'suspicious_request'],
    required: true
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'high'],
    required: true
  },
  summary: { type: String, maxlength: 100, default: '' },
  description: { type: String, maxlength: 300, default: '' },
  actorRole: { type: String, maxlength: 20, default: 'anonymous' },
  actorHash: { type: String, maxlength: 64, default: '' },
  ipHash: { type: String, maxlength: 64, default: '' },
  qaSessionId: { type: String, maxlength: 80, default: '' },
  method: { type: String, maxlength: 10, default: '' },
  route: { type: String, maxlength: 180, default: '' },
  statusCode: { type: Number, min: 100, max: 599, default: null },
  durationMs: { type: Number, min: 0, default: null }
}, {
  timestamps: true,
  versionKey: false
});

qaEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('QaEvent', qaEventSchema);
