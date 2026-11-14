const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
  engineerId: { type: String, required: true, unique: true },
  bio: { type: String, default: '', maxlength: 1000 },
  samples: {
    type: [{
      title: { type: String, required: true, maxlength: 100 },
      genre: { type: String, default: '', maxlength: 40 },
      storageKey: { type: String, required: true, select: false },
      mime: String, size: Number, sha256: String, lossless: Boolean
    }],
    validate: (samples) => samples.length <= 6
  }
}, { timestamps: true });

const reviewSchema = new mongoose.Schema({
  engineerId: { type: String, required: true, index: true },
  bandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Band', required: true },
  reservationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation', required: true, unique: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: '', maxlength: 800 }
}, { timestamps: true });

const requestSchema = new mongoose.Schema({
  bandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Band', required: true, index: true },
  engineerId: { type: String, required: true, index: true },
  roomId: { type: String, required: true },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  duration: { type: Number, required: true, min: 1, max: 4 },
  message: { type: String, default: '', maxlength: 600 },
  status: { type: String, enum: ['pending', 'accepted', 'declined', 'cancelled'], default: 'pending' },
  response: { type: String, default: '', maxlength: 500 },
  respondedAt: Date
}, { timestamps: true });

module.exports = {
  EngineerProfile: mongoose.model('EngineerProfile', profileSchema),
  EngineerReview: mongoose.model('EngineerReview', reviewSchema),
  EngineerRequest: mongoose.model('EngineerRequest', requestSchema)
};
