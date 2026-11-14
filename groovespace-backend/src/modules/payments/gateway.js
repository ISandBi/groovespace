const { validateCard, METHODS } = require('./cards');
const notice = require('./privacyNotice');

// Límite de intentos por objetivo (reserva o intención): 5 fallos → bloqueo de 15 minutos.
// Control de fuerza bruta sobre números de tarjeta (PCI DSS req. 8 / NIST 800-63B).
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
const failures = new Map();

const lockedFor = (key) => {
  const entry = failures.get(key);
  if (!entry) return 0;
  if (entry.lockedUntil && entry.lockedUntil > Date.now()) return entry.lockedUntil - Date.now();
  if (entry.lockedUntil) failures.delete(key);
  return 0;
};

const recordFailure = (key) => {
  const entry = failures.get(key) || { count: 0 };
  entry.count += 1;
  if (entry.count >= MAX_FAILURES) { entry.lockedUntil = Date.now() + LOCK_MS; entry.count = 0; }
  failures.set(key, entry);
  if (failures.size > 5000) for (const [stored, value] of failures) if (value.lockedUntil && value.lockedUntil < Date.now()) failures.delete(stored);
};

exports.resetFailures = () => failures.clear();

/**
 * Cobro simulado. Recibe los datos de la tarjeta sólo para validarlos y devuelve un recibo sin datos sensibles.
 * { ok:true, receipt:{ method, brand, last4, privacyAcceptedAt, privacyVersion } } | { ok:false, status, error }
 */
exports.charge = (body, lockKey) => {
  if (body.privacyAccepted !== true || body.privacyVersion !== notice.version) {
    return { ok: false, status: 400, error: 'Debes leer y aceptar el aviso de protección de datos para pagar.' };
  }
  const wait = lockedFor(lockKey);
  if (wait) {
    return { ok: false, status: 429, error: `Demasiados intentos fallidos. Intenta de nuevo en ${Math.ceil(wait / 60000)} minuto(s).` };
  }
  const result = validateCard(body);
  if (!result.ok) {
    recordFailure(lockKey);
    return { ok: false, status: result.declined ? 402 : 400, error: result.error };
  }
  failures.delete(lockKey);
  return {
    ok: true,
    receipt: { method: body.method, brand: METHODS[body.method].label, network: result.network, last4: result.last4, privacyAcceptedAt: new Date(), privacyVersion: notice.version }
  };
};
