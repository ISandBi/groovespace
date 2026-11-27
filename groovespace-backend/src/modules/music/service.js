const crypto = require('crypto');
const Band = require('../../models/Band');
const Demo = require('../demos/Demo');
const Listener = require('./Listener');
const PlayEntry = require('./PlayEntry');
const WalletEntry = require('../wallet/WalletEntry');
const wallet = require('../wallet/service');
const storage = require('../storage');
const rules = require('./rules');
const { signToken, verifyToken, deriveSecret } = require('../../lib/token');
const { assert, isObjectId, cleanString } = require('../../lib/http');

const LISTENER_TTL = 30 * 24 * 60 * 60;
const secret = () => deriveSecret(process.env.BAND_TOKEN_SECRET, 'listener');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const hash = (password, salt) => crypto.scryptSync(password, salt, 64).toString('hex');
const sign = (listener) => {
  assert(secret(), 503, 'La autenticación no está configurada.');
  return signToken(secret(), { sub: String(listener._id), kind: 'listener' }, LISTENER_TTL);
};
const publicListener = (l) => ({ id: String(l._id), name: l.name, email: l.email });

exports.register = async ({ name, email, password }) => {
  const cleanName = cleanString(name, 80);
  const cleanEmail = cleanString(email, 160).toLowerCase();
  assert(cleanName.length >= 2, 400, 'Escribe tu nombre.');
  assert(EMAIL.test(cleanEmail), 400, 'Correo no válido.');
  assert(typeof password === 'string' && password.length >= 8 && password.length <= 128, 400, 'La contraseña debe tener al menos 8 caracteres.');
  assert(!(await Listener.exists({ email: cleanEmail })), 409, 'Ya existe una cuenta con ese correo.');
  const salt = crypto.randomBytes(16).toString('hex');
  let listener;
  try {
    listener = await Listener.create({ name: cleanName, email: cleanEmail, passwordSalt: salt, passwordHash: hash(password, salt) });
  } catch (error) {
    if (error.code === 11000) assert(false, 409, 'Ya existe una cuenta con ese correo.');
    throw error;
  }
  return { listener: publicListener(listener), token: sign(listener) };
};

exports.login = async ({ email, password }) => {
  const cleanEmail = cleanString(email, 160).toLowerCase();
  const listener = await Listener.findOne({ email: cleanEmail }).select('+passwordHash +passwordSalt');
  const ok = listener && typeof password === 'string' && password.length <= 128
    && crypto.timingSafeEqual(Buffer.from(hash(password, listener.passwordSalt), 'hex'), Buffer.from(listener.passwordHash, 'hex'));
  assert(ok, 401, 'Correo o contraseña incorrectos.');
  return { listener: publicListener(listener), token: sign(listener) };
};

exports.listenerFromRequest = async (req) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const claims = verifyToken(secret(), token);
  if (!claims || claims.kind !== 'listener' || !isObjectId(String(claims.sub))) return null;
  return Listener.findById(claims.sub);
};

exports.requireListener = async (req, res, next) => {
  try {
    const listener = await exports.listenerFromRequest(req);
    if (!listener) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
    req.listener = listener;
    return next();
  } catch (error) { return next(error); }
};

const ADS = [
  { id: 'a1', kicker: 'EVENTO', title: 'Noche de Bandas Nuevas', text: 'Viernes 21:00 · 4 bandas de GrooveSpace en vivo.', cta: 'Ver cartel', colors: ['#ff4f8b', '#8b5cff'] },
  { id: 'a2', kicker: 'RENTA DE SALAS', title: 'Ensaya desde $220/h', text: 'Salas equipadas con consola y backline.', cta: 'Reservar', colors: ['#c8ff3d', '#12c28a'] },
  { id: 'a3', kicker: 'GROOVESPACE', title: 'Graba tu demo con ingeniería profesional', text: 'Súbelo al sitio y publícalo en la app.', cta: 'Conocer más', colors: ['#b28aff', '#2cd5c4'] }
];

/** Catálogo público: todas las bandas registradas y sólo los demos que la banda publicó. */
exports.catalog = async () => {
  const [bands, demos, played] = await Promise.all([
    Band.find({}).select('name genre district bio logoPath createdAt').sort({ name: 1 }).lean(),
    Demo.find({ published: true }).select('bandId title kind mime lyrics coverPath publishedAt size meta').sort({ publishedAt: -1 }).lean(),
    PlayEntry.aggregate([{ $match: { completedAt: { $ne: null } } }, { $group: { _id: '$demoId', plays: { $sum: 1 }, listeners: { $addToSet: '$listenerId' } } }])
  ]);
  const stats = new Map(played.map((p) => [String(p._id), p]));
  const bandStats = new Map();
  const songs = demos.map((demo) => {
    const s = stats.get(String(demo._id));
    const entry = bandStats.get(String(demo.bandId)) || { plays: 0, listeners: new Set() };
    if (s) { entry.plays += s.plays; s.listeners.forEach((l) => entry.listeners.add(String(l))); }
    bandStats.set(String(demo.bandId), entry);
    return {
      id: String(demo._id), bandId: String(demo.bandId), title: demo.title, kind: demo.kind, duration: Math.round(demo.meta?.durationSec || 0),
      streamPath: `/api/music/songs/${demo._id}/stream`, lyrics: demo.lyrics || '', cover: demo.coverPath || '', plays: s ? s.plays : 0, publishedAt: demo.publishedAt
    };
  });
  return {
    bands: bands.map((band) => ({
      id: String(band._id), name: band.name, genre: band.genre || '', city: band.district || '', bio: band.bio || '',
      // El logo provisional es un SVG generado: la app móvil no lo dibuja y usa su portada con iniciales.
      logo: /^(\/uploads\/|\/api\/bands\/media\/)/.test(String(band.logoPath || '')) ? band.logoPath : '', listeners: bandStats.get(String(band._id))?.listeners.size || 0
    })),
    songs,
    ads: ADS,
    rules: { creditPerPlay: rules.creditPerPlay, bonusPlays: rules.bonusPlays, minSeconds: rules.minSeconds, monthlyCapPerBand: rules.monthlyCapPerBand }
  };
};

exports.streamSong = async (req, res) => {
  assert(isObjectId(req.params.id), 400, 'Identificador no válido.');
  const demo = await Demo.findOne({ _id: req.params.id, published: true }).select('+storageKey title mime size');
  assert(demo, 404, 'Canción no disponible.');
  return storage.streamTo(req, res, { key: demo.storageKey, size: demo.size, mime: demo.mime, filename: demo.title });
};

const today = () => new Date().toISOString().slice(0, 10);

exports.startPlay = async ({ listener, songId }) => {
  assert(isObjectId(songId), 400, 'Canción no válida.');
  const demo = await Demo.findOne({ _id: songId, published: true }).select('bandId');
  assert(demo, 404, 'Canción no disponible.');
  const play = await PlayEntry.create({ listenerId: listener._id, demoId: demo._id, bandId: demo.bandId, day: today() });
  return { playId: String(play._id), minSeconds: rules.minSeconds };
};

/** El servidor mide el tiempo entre "inicio" y "completado"; el cliente no puede acreditar sin escuchar. */
exports.completePlay = async ({ listener, playId }) => {
  assert(isObjectId(playId), 400, 'Reproducción no válida.');
  const now = new Date();
  const play = await PlayEntry.findOneAndUpdate({ _id: playId, listenerId: listener._id, completedAt: null }, { completedAt: now }, { new: true });
  if (!play) {
    assert(await PlayEntry.exists({ _id: playId, listenerId: listener._id }), 404, 'Reproducción no encontrada.');
    return { credited: 0, reason: 'already_completed' };
  }
  const elapsed = (now - play.startedAt) / 1000;
  if (elapsed < rules.minSeconds - rules.toleranceSeconds) return { credited: 0, reason: 'too_short' };

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [paidBefore, monthly] = await Promise.all([
    PlayEntry.countDocuments({ bandId: play.bandId, paid: true }),
    WalletEntry.aggregate([{ $match: { bandId: play.bandId, type: 'play', createdAt: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: '$amount' } } }])
  ]);
  const amount = rules.payout(paidBefore, monthly[0]?.total || 0);
  if (!amount) return { credited: 0, reason: 'monthly_cap' };

  try {
    await PlayEntry.updateOne({ _id: play._id }, { paid: true, amount });
  } catch (error) {
    if (error.code === 11000) return { credited: 0, reason: 'already_paid_today' };
    throw error;
  }
  const demo = await Demo.findById(play.demoId).select('title');
  const balance = await wallet.credit({ bandId: play.bandId, amount, type: 'play', concept: `Reproducción válida · ${demo?.title || 'canción'}`, ref: `play:${play.id}` });
  return { credited: amount, balance };
};

exports.publish = async ({ bandId, id, published, lyrics }) => {
  assert(isObjectId(id), 400, 'Identificador de demo no válido.');
  const demo = await Demo.findOne({ _id: id, bandId });
  assert(demo, 404, 'No se encontró el demo.');
  if (typeof lyrics === 'string') demo.lyrics = lyrics.replace(/\r\n/g, '\n').slice(0, 8000);
  if (typeof published === 'boolean') {
    demo.published = published;
    demo.publishedAt = published ? (demo.publishedAt || new Date()) : demo.publishedAt;
  }
  await demo.save();
  return { id: String(demo._id), published: demo.published, publishedAt: demo.publishedAt, lyrics: demo.lyrics };
};
