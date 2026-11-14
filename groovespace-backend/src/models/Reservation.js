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
  extras: [{ type: String }],
  quoteLines: { type: [{ _id: false, id: String, kind: String, label: String, detail: String, amount: Number }], default: [] },
  payPlan: { type: String, enum: ['deposit', 'full'], default: 'deposit' },
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
  depositOrderId: {
    type: String,
    default: null
  },
  balanceOrderId: {
    type: String,
    default: null
  },
  paymentMethod: {
    type: String,
    enum: ['paypal', 'simulated', 'wallet'],
    default: 'paypal'
  },
  // Recibo de pago: sólo marca y últimos 4 dígitos (PCI DSS req. 3). Nunca el número completo ni el CVC.
  cardBrand: { type: String, default: undefined },
  cardLast4: { type: String, default: undefined },
  privacyAcceptedAt: { type: Date, default: undefined },
  privacyVersion: { type: String, default: undefined },
  // Pago dividido: cada integrante cubre su parte del pago vigente (anticipo, contado o saldo).
  sharePlan: {
    type: {
      _id: false,
      paymentType: { type: String, enum: ['deposit', 'full', 'balance'] },
      createdAt: Date,
      shares: [{
        memberId: { type: String, required: true },
        name: { type: String, required: true },
        amount: { type: Number, required: true },
        status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
        paidAt: Date
      }]
    },
    default: undefined
  },
  // Confirmación de asistencia de los integrantes.
  attendance: [{ _id: false, memberId: String, name: String, status: { type: String, enum: ['going', 'maybe', 'no'] }, updatedAt: Date }],
  reminderSentAt: { type: Date, default: undefined },
  ticketCode: {
    type: String,
    default: undefined,
    index: { unique: true, sparse: true }
  },
  ticketIssuedAt: {
    type: Date,
    default: undefined
  },
  checkedInAt: {
    type: Date,
    default: undefined
  },
  checkedInBy: {
    type: String,
    default: undefined
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Reservation', reservationSchema);
