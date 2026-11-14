const crypto = require('crypto');
const PaymentIntent = require('./PaymentIntent');

// Cada módulo registra qué ocurre al pagarse su intención: registerHandler('wallet_topup', async (intent) => resultado).
const handlers = new Map();
exports.registerHandler = (purpose, handler) => handlers.set(purpose, handler);

const frontendBase = () => (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const safeReturnPath = (value) => (typeof value === 'string' && /^\/(?!\/)[\w\-./?=&%#]*$/.test(value) ? value : '/');

exports.createIntent = async ({ purpose, amount, label, actor, returnPath, meta = {}, ttlMs = 60 * 60 * 1000 }) => {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw Object.assign(new Error('El importe no es válido.'), { status: 400 });
  const sessionId = `cs_sim_${crypto.randomBytes(12).toString('hex')}`;
  const intent = await PaymentIntent.create({
    sessionId, purpose, amount, label,
    actorType: actor ? 'band' : 'public',
    actorId: actor ? String(actor.bandId || actor.id) : undefined,
    returnPath: safeReturnPath(returnPath),
    meta,
    expiresAt: new Date(Date.now() + ttlMs)
  });
  return { intent, sessionId, checkoutUrl: `${frontendBase()}/?payment=simulated&session_id=${sessionId}` };
};

exports.runHandler = async (intent) => {
  const handler = handlers.get(intent.purpose);
  if (!handler) throw new Error(`Sin manejador para ${intent.purpose}.`);
  return handler(intent);
};

exports.safeReturnPath = safeReturnPath;
