const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  reservationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation', required: true, index: true },
  senderType: { type: String, enum: ['band', 'member', 'engineer', 'staff'], required: true },
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  text: { type: String, required: true, maxlength: 1000 },
  createdAt: { type: Date, default: Date.now }
});
messageSchema.index({ reservationId: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
