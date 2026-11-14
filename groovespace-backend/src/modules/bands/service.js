const crypto = require('crypto');
const Band = require('../../models/Band');
const Reservation = require('../../models/Reservation');
const BandFile = require('./BandFile');
const storage = require('../storage');
const { sniffMedia, readHead } = require('../storage/media');
const { createMemberToken } = require('../../middlewares/actor');
const { sendMail, escapeHtml } = require('../notifications/mailer');
const { HttpError, assert, cleanString, isObjectId } = require('../../lib/http');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const frontendBase = () => (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

exports.slugify = (name) => String(name).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'banda';

exports.ensureSlug = async (band) => {
  if (band.slug) return band.slug;
  const base = exports.slugify(band.name);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${crypto.randomBytes(2).toString('hex')}`;
    if (!(await Band.exists({ slug: candidate }))) { band.slug = candidate; return candidate; }
  }
  throw new HttpError(409, 'No se pudo generar una dirección única para la banda.');
};

const loadBand = async (bandId, select) => {
  const band = await Band.findById(bandId).select(select);
  assert(band, 404, 'No se encontró la banda.');
  return band;
};

// ---------- Equipo y cargos ----------
exports.team = async (bandId) => {
  const band = await loadBand(bandId, 'name leaderName members');
  return {
    leader: { id: 'leader', name: band.leaderName, role: 'lider' },
    members: band.members.map((member) => ({ id: member.id, name: member.name, instrument: member.instrument, role: member.role }))
  };
};

exports.setMemberRole = async ({ bandId, memberId, role }) => {
  assert(['tesorero', 'integrante'].includes(role), 400, 'El cargo debe ser tesorero o integrante.');
  const band = await loadBand(bandId, 'members');
  const member = band.members.id(memberId);
  assert(member, 404, 'No se encontró al integrante.');
  if (role === 'tesorero') assert(band.members.filter((item) => item.role === 'tesorero' && item.id !== memberId).length < 2, 409, 'La banda puede tener hasta 2 tesoreros.');
  member.role = role;
  await band.save();
  return exports.team(bandId);
};

/** Enlace personal para que un integrante recupere su acceso (el líder lo comparte por el medio que prefiera). */
exports.memberAccessLink = async ({ bandId, memberId }) => {
  const band = await loadBand(bandId, 'members');
  const member = band.members.id(memberId);
  assert(member, 404, 'No se encontró al integrante.');
  const token = createMemberToken({ memberId: member.id, bandId, role: member.role });
  return { url: `${frontendBase()}/?member_access=${encodeURIComponent(token)}`, expiresInDays: 30 };
};

// ---------- Invitaciones ----------
const inviteMessage = (band, url) => `Te invito a unirte a ${band.name} en GrooveSpace para ver nuestros ensayos, confirmar asistencia y dividir pagos: ${url}`;

exports.createInviteLinks = async (bandId) => {
  const band = await loadBand(bandId, 'name');
  const token = crypto.randomBytes(32).toString('hex');
  band.inviteTokenHash = hashToken(token);
  band.inviteExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await band.save();
  const url = `${frontendBase()}/invite/${token}`;
  const message = inviteMessage(band, url);
  return {
    token, url, message, expiresInDays: 30,
    share: {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(message)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(`Te invito a unirte a ${band.name} en GrooveSpace`)}`,
      email: `mailto:?subject=${encodeURIComponent(`Invitación a ${band.name} en GrooveSpace`)}&body=${encodeURIComponent(message)}`
    }
  };
};

exports.sendInviteEmails = async ({ bandId, emails }) => {
  assert(Array.isArray(emails) && emails.length > 0 && emails.length <= 10, 400, 'Escribe de 1 a 10 correos.');
  const clean = [...new Set(emails.map((email) => cleanString(email, 120).toLowerCase()))];
  assert(clean.every((email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)), 400, 'Alguno de los correos no es válido.');
  const links = await exports.createInviteLinks(bandId);
  const band = await loadBand(bandId, 'name leaderName');
  const results = await Promise.all(clean.map((to) => sendMail({
    to,
    subject: `${band.leaderName} te invita a ${band.name} en GrooveSpace`,
    text: links.message,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px"><h2>${escapeHtml(band.name)} te espera en GrooveSpace</h2><p>${escapeHtml(band.leaderName)} te invita a unirte para ver los ensayos, confirmar asistencia y dividir pagos.</p><p><a href="${links.url}" style="background:#c2ff3c;color:#100d17;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Unirme a la banda</a></p><p style="color:#666;font-size:12px">El enlace vence en 30 días.</p></div>`
  }).then((result) => ({ to, ...result })).catch((error) => ({ to, delivered: false, reason: error.message }))));
  return { url: links.url, results, simulated: results.every((result) => result.reason === 'simulado') };
};

// ---------- Perfil público (EPK) ----------
const publicBand = (band) => ({
  slug: band.slug, name: band.name, logoPath: band.logoPath, bio: band.bio, genre: band.genre, district: band.district, pressLinks: band.pressLinks,
  members: band.members.map(({ name, instrument }) => ({ name, instrument })),
  instruments: band.instruments.map(({ name }) => ({ name })),
  since: band.createdAt
});

exports.publicProfile = async (slug) => {
  const band = await Band.findOne({ slug: cleanString(slug, 60).toLowerCase(), isPublic: true });
  assert(band, 404, 'Este perfil no existe o no es público.');
  return publicBand(band);
};

exports.directory = async ({ q, genre, district }) => {
  const filter = { isPublic: true, slug: { $exists: true } };
  if (genre) filter.genre = new RegExp(`^${cleanString(genre, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  if (district) filter.district = new RegExp(`^${cleanString(district, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  if (q) filter.name = new RegExp(cleanString(q, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const bands = await Band.find(filter).sort({ createdAt: -1 }).limit(60);
  return bands.map((band) => ({ slug: band.slug, name: band.name, logoPath: band.logoPath, genre: band.genre, district: band.district, members: band.members.length }));
};

const safeUrl = (value) => {
  try {
    const url = new URL(String(value));
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch { return null; }
};

exports.updateProfile = async ({ bandId, body }) => {
  const band = await loadBand(bandId, 'name slug bio genre district pressLinks isPublic');
  if (body.bio !== undefined) band.bio = cleanString(body.bio, 1200);
  if (body.genre !== undefined) band.genre = cleanString(body.genre, 60);
  if (body.district !== undefined) band.district = cleanString(body.district, 80);
  if (Array.isArray(body.pressLinks)) {
    band.pressLinks = body.pressLinks.slice(0, 8).map((link) => ({ label: cleanString(link?.label, 60), url: safeUrl(link?.url) })).filter((link) => link.label && link.url);
  }
  if (body.isPublic !== undefined) {
    band.isPublic = Boolean(body.isPublic);
    if (band.isPublic) await exports.ensureSlug(band);
  }
  await band.save();
  return { slug: band.slug, isPublic: band.isPublic, bio: band.bio, genre: band.genre, district: band.district, pressLinks: band.pressLinks };
};

// ---------- Setlist y rider técnico ----------
exports.getStagePack = async (bandId) => {
  const band = await loadBand(bandId, 'name setlist rider instruments members');
  return { name: band.name, setlist: band.setlist, rider: band.rider, instruments: band.instruments.map(({ name }) => name), members: band.members.map(({ name, instrument }) => ({ name, instrument })) };
};

exports.saveSetlist = async ({ bandId, songs }) => {
  assert(Array.isArray(songs) && songs.length <= 60, 400, 'El setlist admite hasta 60 canciones.');
  const band = await loadBand(bandId, 'setlist');
  band.setlist = songs.map((song) => ({ title: cleanString(song?.title, 100), durationMin: Math.min(60, Math.max(0, Number(song?.durationMin) || 4)), notes: cleanString(song?.notes, 200) })).filter((song) => song.title);
  await band.save();
  return band.setlist;
};

exports.saveRider = async ({ bandId, body }) => {
  const band = await loadBand(bandId, 'rider');
  band.rider = {
    stageNeeds: cleanString(body.stageNeeds, 1500), backline: cleanString(body.backline, 1500),
    monitors: cleanString(body.monitors, 600), notes: cleanString(body.notes, 1500), updatedAt: new Date()
  };
  await band.save();
  return band.rider;
};

/** El ingeniero (o el staff) sólo ve el paquete técnico de bandas con las que tiene sesión. */
exports.stagePackForEngineer = async ({ engineerId, bandId }) => {
  assert(isObjectId(bandId), 400, 'Identificador no válido.');
  assert(await Reservation.exists({ bandId, engineerId, isDemo: { $ne: true }, paymentStatus: { $in: ['deposit_pending', 'deposit_paid', 'paid'] } }), 403, 'No tienes sesiones con esta banda.');
  return exports.getStagePack(bandId);
};

// ---------- Calendario compartido y asistencia ----------
exports.calendar = async (actor) => {
  const holdCutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const reservations = await Reservation.find({
    bandId: actor.bandId, isDemo: { $ne: true },
    $or: [{ paymentStatus: { $in: ['deposit_paid', 'paid'] } }, { paymentStatus: 'deposit_pending', createdAt: { $gte: holdCutoff } }]
  }).sort({ date: 1, startTime: 1 });
  const me = actor.type === 'band' ? 'leader' : actor.id;
  return reservations.map((reservation) => {
    const attendance = reservation.attendance || [];
    return {
      id: reservation.id, roomName: reservation.roomName, date: reservation.date, startTime: reservation.startTime, duration: reservation.duration,
      paymentStatus: reservation.paymentStatus, checkedInAt: reservation.checkedInAt || null, engineerId: reservation.engineerId || null,
      attendance, myStatus: attendance.find((item) => item.memberId === me)?.status || null,
      roomId: reservation.roomId, attendees: reservation.attendees, payPlan: reservation.payPlan, totalPrice: reservation.totalPrice, depositAmount: reservation.depositAmount, balanceAmount: reservation.balanceAmount,
      balanceDueAt: reservation.balanceDueAt || null, ticketCode: ['deposit_paid', 'paid'].includes(reservation.paymentStatus) ? reservation.ticketCode : null, sharePlan: reservation.sharePlan || null
    };
  });
};

exports.setAttendance = async ({ actor, reservationId, status }) => {
  assert(isObjectId(reservationId), 400, 'Identificador de reserva no válido.');
  assert(['going', 'maybe', 'no'].includes(status), 400, 'Elige si asistes, tal vez o no.');
  const reservation = await Reservation.findOne({ _id: reservationId, bandId: actor.bandId });
  assert(reservation && !reservation.isDemo, 404, 'No se encontró la reserva.');
  const band = await loadBand(actor.bandId, 'leaderName members');
  const memberId = actor.type === 'band' ? 'leader' : actor.id;
  const name = actor.type === 'band' ? band.leaderName : band.members.id(actor.id)?.name;
  assert(name, 403, 'Ya no formas parte de esta banda.');
  const entries = (reservation.attendance || []).filter((item) => item.memberId !== memberId);
  entries.push({ memberId, name, status, updatedAt: new Date() });
  reservation.attendance = entries;
  await reservation.save();
  return reservation.attendance;
};

// ---------- Archivos de la banda ----------
const ALLOWED_DOCS = [
  { ext: 'pdf', mime: 'application/pdf', test: (head) => head.toString('latin1', 0, 4) === '%PDF' },
  { ext: 'png', mime: 'image/png', test: (head) => head[0] === 0x89 && head.toString('latin1', 1, 4) === 'PNG' },
  { ext: 'jpg', mime: 'image/jpeg', test: (head) => head[0] === 0xff && head[1] === 0xd8 },
  { ext: 'webp', mime: 'image/webp', test: (head) => head.toString('latin1', 0, 4) === 'RIFF' && head.toString('latin1', 8, 12) === 'WEBP' }
];

exports.uploadFile = async ({ actor, file, visibility }) => {
  assert(file, 400, 'Adjunta un archivo.');
  assert(await BandFile.countDocuments({ bandId: actor.bandId }) < 60, 409, 'La banda alcanzó el límite de 60 archivos.');
  const head = await readHead(file.path, 16);
  const doc = ALLOWED_DOCS.find((item) => item.test(head));
  const media = doc ? null : sniffMedia(head);
  assert(doc || media, 400, 'Formato no compatible. Usa PDF, imágenes (PNG, JPG, WEBP) o audio/video.');
  const ext = doc?.ext || media.ext;
  const mime = doc?.mime || media.mime;
  const key = storage.newKey(`files/${actor.bandId}`, ext);
  const stored = await storage.store({ key, filePath: file.path, size: file.size, contentType: mime });
  const created = await BandFile.create({
    bandId: actor.bandId, name: cleanString(file.originalname, 160) || `archivo.${ext}`, mime, size: stored.size, storageKey: key, sha256: stored.sha256,
    visibility: visibility === 'engineer' ? 'engineer' : 'band', uploadedBy: `${actor.type}:${actor.id}`
  });
  return { id: created.id, name: created.name, mime, size: created.size, visibility: created.visibility, createdAt: created.createdAt };
};

exports.listFiles = async (bandId) => (await BandFile.find({ bandId }).sort({ createdAt: -1 })).map((file) => ({ id: file.id, name: file.name, mime: file.mime, size: file.size, visibility: file.visibility, createdAt: file.createdAt }));

exports.openFile = async ({ actor, id, req, res }) => {
  assert(isObjectId(id), 400, 'Identificador no válido.');
  const file = await BandFile.findById(id).select('+storageKey');
  assert(file, 404, 'No se encontró el archivo.');
  const ownBand = actor.bandId && String(file.bandId) === actor.bandId;
  const engineerOk = actor.type === 'engineer' && file.visibility === 'engineer' && await Reservation.exists({ bandId: file.bandId, engineerId: actor.id, isDemo: { $ne: true } });
  assert(ownBand || engineerOk || actor.type === 'staff', 403, 'No tienes acceso a este archivo.');
  return storage.streamTo(req, res, { key: file.storageKey, size: file.size, mime: file.mime, filename: file.name, download: true });
};

exports.removeFile = async ({ bandId, id }) => {
  assert(isObjectId(id), 400, 'Identificador no válido.');
  const file = await BandFile.findOne({ _id: id, bandId }).select('+storageKey');
  assert(file, 404, 'No se encontró el archivo.');
  await storage.remove(file.storageKey);
  await file.deleteOne();
};
