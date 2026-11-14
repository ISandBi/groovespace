const crypto = require('crypto');

// Formato compartido por todas las sesiones: base64url(JSON{sub,exp,...}).firma-HMAC-SHA256.
const hmac = (secret, payload) => crypto.createHmac('sha256', secret).update(payload).digest('base64url');

exports.signToken = (secret, claims, ttlSeconds) => {
  const payload = Buffer.from(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString('base64url');
  return `${payload}.${hmac(secret, payload)}`;
};

/** Devuelve los claims si la firma y la vigencia son válidas; si no, null. */
exports.verifyToken = (secret, token) => {
  if (!secret || typeof token !== 'string') return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;
  const expected = Buffer.from(hmac(secret, payload));
  const supplied = Buffer.from(signature);
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return claims.sub && claims.exp > Date.now() / 1000 ? claims : null;
  } catch {
    return null;
  }
};

/** Clave distinta por tipo de sesión: un token de integrante jamás sirve como token de banda. */
exports.deriveSecret = (base, label) => (base ? crypto.createHash('sha256').update(`${base}:${label}`).digest('hex') : '');
