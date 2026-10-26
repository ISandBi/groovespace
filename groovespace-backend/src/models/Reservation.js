const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  bandId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Band',
    required: true
  },
  roomId: {
    type: String, // CORRECCIÓN: Cambiado de ObjectId a String para aceptar 'sala_estudio_a' sin crasheos
    required: true
  },
  roomName: {
    type: String,
    required: true
  },
  date: {
    type: String,
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  attendees: {
    type: Number,
    required: true
  },
  rentedGear: [{
    id: String,
    name: String,
    price: Number
  }],
  engineerId: {
    type: String,
    default: null
  },
  roomLayout: [{
    instrumentId: { type: String, required: true },
    name: { type: String, required: true },
    x: { type: Number, required: true },
    z: { type: Number, required: true }
  }],
  totalPrice: {
    type: Number,
    required: true
  },
  depositAmount: {
    type: Number,
    required: true
  },
  balanceAmount: {
    type: Number,
    required: true
  },
  balanceDueAt: {
    type: Date,
    required: true
  },
  isDemo: {
    type: Boolean,
    default: false
  },
  paymentStatus: {
    type: String,
    enum: ['deposit_pending', 'deposit_paid', 'paid', 'expired', 'refunded'],
    default: 'deposit_pending',
    required: true
  },
  stripeCheckoutSessionId: {
    type: String,
    default: null
  },
  stripeDepositSessionId: {
    type: String,
    default: null
  },
  stripeBalanceSessionId: {
    type: String,
    default: null
  },
}, {
  timestamps: true
});

module.exports = mongoose.model('Reservation', reservationSchema);
