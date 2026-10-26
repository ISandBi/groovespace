const mongoose = require('mongoose');

const bandEmailDomainSchema = new mongoose.Schema({
  domain: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[a-z0-9.-]+\.[a-z]{2,}$/
  },
  enabled: {
    type: Boolean,
    default: true,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('BandEmailDomain', bandEmailDomainSchema);
