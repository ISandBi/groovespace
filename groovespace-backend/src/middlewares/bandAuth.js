const crypto = require('crypto');

const secret = () => process.env.BAND_TOKEN_SECRET;
const sign = (payload) => crypto.createHmac('sha256', secret()).update(payload).digest('base64url');

exports.createBandToken = (bandId) => {
  const payload = Buffer.from(JSON.stringify({ sub: bandId, exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
};

exports.requireBand = (req, res, next) => {
  if (!secret()) return res.status(503).json({ error: 'La autenticación de bandas no está configurada.' });
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const [payload, signature, extra] = (token || '').split('.');
  const expectedSignature = Buffer.from(sign(payload || ''));
  const suppliedSignature = Buffer.from(signature || '');
  if (!payload || !signature || extra || suppliedSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(suppliedSignature, expectedSignature)) {
    return res.status(401).json({ error: 'Sesión de banda no válida.' });
  }
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!claims.sub || claims.exp <= Date.now() / 1000) return res.status(401).json({ error: 'La sesión de banda expiró.' });
    req.bandId = claims.sub;
    return next();
  } catch {
    return res.status(401).json({ error: 'Sesión de banda no válida.' });
  }
};