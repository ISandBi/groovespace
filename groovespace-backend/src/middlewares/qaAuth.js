const { constantTimeEquals } = require('./staffAuth');

const getQaToken = (req) => req.headers.authorization?.replace(/^Bearer\s+/i, '');

exports.hasValidQaToken = (req) => {
  const expectedToken = process.env.QA_INGEST_TOKEN;
  return process.env.NODE_ENV !== 'production' &&
    process.env.QA_MONITORING_ENABLED === 'true' &&
    typeof expectedToken === 'string' &&
    expectedToken.length >= 32 &&
    constantTimeEquals(getQaToken(req), expectedToken);
};

exports.requireQa = (req, res, next) => {
  if (process.env.NODE_ENV === 'production' || process.env.QA_MONITORING_ENABLED !== 'true') {
    return res.status(404).json({ error: 'El monitor QA no está habilitado en este entorno.' });
  }
  const expectedToken = process.env.QA_INGEST_TOKEN;
  if (!expectedToken || expectedToken.length < 32) {
    return res.status(503).json({ error: 'Configura QA_INGEST_TOKEN con al menos 32 caracteres.' });
  }
  if (!exports.hasValidQaToken(req)) {
    return res.status(401).json({ error: 'Token QA inválido.' });
  }
  return next();
};
