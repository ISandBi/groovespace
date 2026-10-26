const crypto = require('crypto');

const tokenSecret = () => process.env.ENGINEER_TOKEN_SECRET;
const sign = (payload) => crypto.createHmac('sha256', tokenSecret()).update(payload).digest('base64url');
const constantTimeEquals = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

exports.createEngineerToken = (engineerId) => {
  const payload = Buffer.from(JSON.stringify({ sub: engineerId, exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
};

exports.requireEngineer = (req, res, next) => {
  if (!tokenSecret()) return res.status(503).json({ error: 'La autenticación de ingeniería no está configurada.' });
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const [payload, signature, extra] = (token || '').split('.');
  const expected = Buffer.from(sign(payload || ''));
  const supplied = Buffer.from(signature || '');
  if (!payload || !signature || extra || expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
    return res.status(401).json({ error: 'Sesión de ingeniería no válida.' });
  }
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!claims.sub || claims.exp <= Date.now() / 1000) return res.status(401).json({ error: 'La sesión de ingeniería expiró.' });
    req.engineerId = claims.sub;
    return next();
  } catch {
    return res.status(401).json({ error: 'Sesión de ingeniería no válida.' });
  }
};