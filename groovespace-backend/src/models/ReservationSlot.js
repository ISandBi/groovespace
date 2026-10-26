const mongoose = require('mongoose');

const reservationSlotSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  date: { type: String, required: true },
  slotStart: { type: Number, required: true },
  engineerId: { type: String },
  reservationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation', required: true },
  expiresAt: { type: Date }
});

reservationSlotSchema.index({ roomId: 1, date: 1, slotStart: 1 }, { unique: true });
reservationSlotSchema.index(
  { engineerId: 1, date: 1, slotStart: 1 },
  { unique: true, partialFilterExpression: { engineerId: { $type: 'string' } } }
);
reservationSlotSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

module.exports = mongoose.model('ReservationSlot', reservationSlotSchema);