const { signToken, verifyToken, deriveSecret } = require('../lib/token');

const MEMBER_TTL = 30 * 24 * 60 * 60;
const memberSecret = () => deriveSecret(process.env.BAND_TOKEN_SECRET, 'member');

exports.createMemberToken = ({ memberId, bandId, role }) => signToken(memberSecret(), { sub: String(memberId), band: String(bandId), role }, MEMBER_TTL);

const bearer = (req) => req.headers.authorization?.replace(/^Bearer\s+/i, '');

/** Identifica quién llama: líder de banda, integrante, ingeniero o staff. Devuelve null si no hay sesión válida. */
exports.resolveActor = (req) => {
  const token = bearer(req);
  if (!token) return null;
  const band = verifyToken(process.env.BAND_TOKEN_SECRET, token);
  if (band && /^[a-f\d]{24}$/i.test(String(band.sub))) return { type: 'band', id: String(band.sub), bandId: String(band.sub), role: 'lider' };
  const member = verifyToken(memberSecret(), token);
  if (member) return { type: 'member', id: member.sub, bandId: member.band, role: member.role || 'integrante' };
  const engineer = verifyToken(process.env.ENGINEER_TOKEN_SECRET, token);
  if (engineer && /^eng-/.test(String(engineer.sub))) return { type: 'engineer', id: String(engineer.sub) };
  const staff = verifyToken(process.env.STAFF_TOKEN_SECRET, token);
  if (staff) return { type: 'staff', id: String(staff.sub) };
  return null;
};

/** requireActor('band','member') → sólo esos tipos de sesión. Sin argumentos acepta cualquiera. */
exports.requireActor = (...types) => (req, res, next) => {
  const actor = exports.resolveActor(req);
  if (!actor) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
  if (types.length && !types.includes(actor.type)) return res.status(403).json({ error: 'Tu sesión no tiene acceso a este recurso.' });
  req.actor = actor;
  if (actor.bandId) req.bandId = actor.bandId;
  return next();
};

/** Líder o integrante de la banda; `roles` limita los cargos permitidos (lider, tesorero, integrante). */
exports.requireBandAccess = (...roles) => (req, res, next) => exports.requireActor('band', 'member')(req, res, () => {
  if (roles.length && !roles.includes(req.actor.role)) {
    return res.status(403).json({ error: 'Tu cargo en la banda no permite esta acción.' });
  }
  return next();
});

exports.requireBandManager = exports.requireBandAccess('lider', 'tesorero');

/** Sesión opcional: si llega un token válido identifica al actor; si llega uno inválido responde 401. */
exports.optionalActor = (req, res, next) => (req.headers.authorization ? exports.requireActor()(req, res, next) : next());
