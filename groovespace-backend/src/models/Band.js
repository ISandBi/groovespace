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
  members: {
    type: [{
      name: { type: String, required: true },
      instrument: { type: String, required: true }
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
