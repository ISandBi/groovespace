const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipientType: { type: String, enum: ['band', 'member', 'engineer', 'staff'], required: true },
  recipientId: { type: String, required: true },
  kind: { type: String, required: true }, // p. ej. reminder_24h, payment_due, application_accepted
  title: { type: String, required: true },
  body: { type: String, default: '' },
  link: { type: String, default: '' },
  dedupeKey: { type: String },
  readAt: { type: Date, default: undefined },
  createdAt: { type: Date, default: Date.now, index: true }
});

notificationSchema.index({ recipientType: 1, recipientId: 1, createdAt: -1 });
notificationSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true }); // evita duplicar recordatorios
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);
