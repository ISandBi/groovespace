const crypto = require('crypto');

const tokenSecret = () => process.env.STAFF_TOKEN_SECRET;
const sign = (payload) => crypto.createHmac('sha256', tokenSecret()).update(payload).digest('base64url');

const constantTimeEquals = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

exports.createStaffToken = (username) => {
  const payload = Buffer.from(JSON.stringify({ sub: username, exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
};

exports.requireStaff = (req, res, next) => {
  if (!tokenSecret()) return res.status(503).json({ error: 'La autenticación de staff no está configurada.' });
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const [payload, signature, extra] = (token || '').split('.');
  if (!payload || !signature || extra || !constantTimeEquals(signature, sign(payload))) {
    return res.status(401).json({ error: 'Sesión de staff no válida.' });
  }
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!claims.sub || claims.exp <= Date.now() / 1000) return res.status(401).json({ error: 'La sesión de staff expiró.' });
    req.staff = { username: claims.sub };
    return next();
  } catch {
    return res.status(401).json({ error: 'Sesión de staff no válida.' });
  }
};

exports.constantTimeEquals = constantTimeEquals;