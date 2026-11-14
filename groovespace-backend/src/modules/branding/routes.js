const express = require('express');
const { buildProvisionalLogo } = require('./logo');

const router = express.Router();

router.get('/logo.svg', (req, res) => {
  const name = String(req.query.name || 'GrooveSpace').slice(0, 80);
  res.set({ 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'", 'Cross-Origin-Resource-Policy': 'cross-origin' });
  return res.status(200).send(buildProvisionalLogo(name));
});

module.exports = router;
