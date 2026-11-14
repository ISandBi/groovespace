const express = require('express');
const { rooms, rentalGear, extras, limits } = require('../../config/catalog');
const { engineers, publicEngineer } = require('../../config/engineers');
const { buildQuote } = require('../../lib/pricing');
const rateLimit = require('../../middlewares/rateLimit');

const router = express.Router();

// Catálogo comercial público: el frontend lo usa para dibujar el cotizador y calcular al instante.
router.get('/pricing', (req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  return res.status(200).json({ rooms, rentalGear, extras, engineers: engineers.map(publicEngineer), limits });
});

// Cotización pública (sin cuenta). Es la misma función que fija el precio al reservar.
router.post('/quotes/price', rateLimit(60 * 1000, 120), (req, res) => {
  try {
    const { roomId, duration, attendees, rentedGear = [], gearIds, extras: extraIds = [], engineerId = null } = req.body || {};
    const quote = buildQuote({ roomId, duration, attendees, gearIds: gearIds || (Array.isArray(rentedGear) ? rentedGear.map((item) => item?.id ?? item) : []), extraIds, engineerId });
    return res.status(200).json(quote);
  } catch (error) {
    if (error.name === 'QuoteError') return res.status(400).json({ error: error.message });
    return res.status(500).json({ error: 'No se pudo calcular la cotización.' });
  }
});

module.exports = router;
