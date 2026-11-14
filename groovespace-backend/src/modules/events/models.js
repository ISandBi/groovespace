const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, default: '', maxlength: 2000 },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  venue: { type: String, required: true, maxlength: 120 },
  requirements: { type: String, default: '', maxlength: 800 },
  applicationDeadline: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
  lineupSlots: { type: Number, default: 4, min: 1, max: 30 },
  ticketPrice: { type: Number, default: 0, min: 0, max: 5000 },
  ticketCapacity: { type: Number, default: 100, min: 0, max: 5000 },
  soldTickets: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['draft', 'open', 'closed', 'cancelled'], default: 'draft' },
  createdBy: String
}, { timestamps: true });

const applicationSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  bandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Band', required: true },
  message: { type: String, default: '', maxlength: 800 },
  status: { type: String, enum: ['pending', 'accepted', 'waitlist', 'rejected'], default: 'pending' },
  reviewNote: { type: String, default: '', maxlength: 500 },
  decidedAt: Date
}, { timestamps: true });
applicationSchema.index({ eventId: 1, bandId: 1 }, { unique: true });

const ticketSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  code: { type: String, required: true, unique: true },
  buyerName: { type: String, required: true, maxlength: 100 },
  buyerEmail: { type: String, required: true, maxlength: 120 },
  quantity: { type: Number, required: true, min: 1, max: 6 },
  admitted: { type: Number, default: 0, min: 0 },
  amount: { type: Number, default: 0 },
  cardBrand: String,
  cardLast4: String,
  checkedInBy: String,
  lastCheckInAt: Date
}, { timestamps: true });

module.exports = {
  Event: mongoose.model('Event', eventSchema),
  EventApplication: mongoose.model('EventApplication', applicationSchema),
  EventTicket: mongoose.model('EventTicket', ticketSchema)
};
