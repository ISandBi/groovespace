const mongoose = require('mongoose');

// Oyente de la app móvil. Es una cuenta distinta a la de banda: sólo escucha y genera reproducciones válidas.
const listenerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  passwordSalt: { type: String, required: true, select: false }
}, { timestamps: true });

module.exports = mongoose.model('Listener', listenerSchema);
