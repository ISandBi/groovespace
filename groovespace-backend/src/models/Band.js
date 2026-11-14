const mongoose = require('mongoose');

const bandSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  leaderName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true,
    select: false
  },
  passwordSalt: {
    type: String,
    required: true,
    select: false
  },
  logoPath: {
    type: String,
    required: true
  },
  slug: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  bio: { type: String, default: '', maxlength: 1200 },
  genre: { type: String, default: '', maxlength: 60 },
  district: { type: String, default: '', maxlength: 80 },
  pressLinks: { type: [{ _id: false, label: { type: String, maxlength: 60 }, url: { type: String, maxlength: 300 } }], default: [], validate: (links) => links.length <= 8 },
  isPublic: { type: Boolean, default: false },
  logoProvisional: { type: Boolean, default: false },
  walletBalance: { type: Number, default: 0, min: 0 },
  setlist: { type: [{ title: { type: String, required: true, maxlength: 100 }, durationMin: { type: Number, min: 0, max: 60, default: 4 }, notes: { type: String, maxlength: 200, default: '' } }], default: [], validate: (songs) => songs.length <= 60 },
  rider: {
    stageNeeds: { type: String, default: '', maxlength: 1500 },
    backline: { type: String, default: '', maxlength: 1500 },
    monitors: { type: String, default: '', maxlength: 600 },
    notes: { type: String, default: '', maxlength: 1500 },
    updatedAt: Date
  },
  members: {
    type: [{
      name: { type: String, required: true },
      instrument: { type: String, required: true },
      role: { type: String, enum: ['tesorero', 'integrante'], default: 'integrante' },
      joinedAt: { type: Date, default: Date.now }
    }],
    validate: {
      validator: (members) => members.length <= 100,
      message: 'La banda puede tener hasta 100 integrantes.'
    }
  },
  instruments: [{
    name: { type: String, required: true, trim: true },
    photoPath: { type: String, required: true }
  }],
  requiresEngineer: {
    type: Boolean,
    default: false
  },
  engineerId: {
    type: String,
    default: null
  },
  inviteTokenHash: {
    type: String,
    select: false,
    default: null
  },
  inviteExpiresAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Band', bandSchema);
