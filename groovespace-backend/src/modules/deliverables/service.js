const Deliverable = require('./Deliverable');
const { STAGES } = Deliverable;
const Reservation = require('../../models/Reservation');
const Band = require('../../models/Band');
const storage = require('../storage');
const { sniffMedia, readHead } = require('../storage/media');
const { signToken, verifyToken, deriveSecret } = require('../../lib/token');
const { notify } = require('../notifications/service');
const { engineers } = require('../../config/engineers');
const { assert, HttpError, cleanString, isObjectId } = require('../../lib/http');

const secret = () => deriveSecret(process.env.BAND_TOKEN_SECRET, 'deliverable-stream');
const stageLabel = { recorded: 'Grabado', editing: 'En edición', mixing: 'En mezcla', mastering: 'En masterización', delivered: 'Entregado' };

const view = (deliverable) => {
  const data = deliverable.toObject();
  data.versions = data.versions.map(({ storageKey, ...version }) => version);
  return data;
};

const canAccess = (actor, deliverable) => actor.type === 'staff'
  || (actor.bandId && String(deliverable.bandId) === actor.bandId)
  || (actor.type === 'engineer' && deliverable.engineerId === actor.id);

const load = async (id, actor, { withKeys = false } = {}) => {
  assert(isObjectId(id), 400, 'Identificador no válido.');
  const deliverable = await Deliverable.findById(id).select(withKeys ? '+versions.storageKey' : '');
  assert(deliverable && canAccess(actor, deliverable), 404, 'No se encontró el entregable.');
  return deliverable;
};

exports.listForReservation = async ({ actor, reservationId }) => {
  assert(isObjectId(reservationId), 400, 'Identificador no válido.');
  const reservation = await Reservation.findById(reservationId);
  assert(reservation && (actor.type === 'staff' || String(reservation.bandId) === actor.bandId || reservation.engineerId === actor.id), 404, 'No se encontró la sesión.');
  return (await Deliverable.find({ reservationId }).sort({ createdAt: 1 })).map(view);
};

exports.create = async ({ engineerId, reservationId, title }) => {
  assert(isObjectId(reservationId), 400, 'Identificador no válido.');
  const reservation = await Reservation.findOne({ _id: reservationId, engineerId, isDemo: { $ne: true }, paymentStatus: { $in: ['deposit_paid', 'paid'] } });
  assert(reservation, 404, 'No tienes una sesión confirmada con esa reserva.');
  const name = cleanString(title, 120);
  assert(name, 400, 'Escribe el título del entregable.');
  const created = await Deliverable.create({ reservationId, bandId: reservation.bandId, engineerId, title: name });
  return view(created);
};

exports.setStage = async ({ engineerId, id, stage }) => {
  assert(STAGES.includes(stage), 400, 'Etapa no válida.');
  const deliverable = await load(id, { type: 'engineer', id: engineerId });
  deliverable.stage = stage;
  await deliverable.save();
  await notify({ recipientType: 'band', recipientId: deliverable.bandId, kind: 'deliverable_stage', title: `“${deliverable.title}”: ${stageLabel[stage]}`, body: 'Tu ingeniero actualizó el avance del proyecto.', link: '/banda', dedupeKey: `stage:${deliverable.id}:${stage}` });
  return view(deliverable);
};

exports.addVersion = async ({ engineerId, id, file, label, notes }) => {
  assert(file, 400, 'Adjunta el archivo de la versión.');
  const deliverable = await load(id, { type: 'engineer', id: engineerId }, { withKeys: true });
  assert(deliverable.versions.length < 30, 409, 'Se alcanzó el máximo de 30 versiones.');
  const media = sniffMedia(await readHead(file.path, 16));
  assert(media, 400, 'Formato no compatible. Usa WAV o FLAC para el máster, o MP3/M4A/MP4.');
  const key = storage.newKey(`deliverables/${deliverable.bandId}`, media.ext);
  const stored = await storage.store({ key, filePath: file.path, size: file.size, contentType: media.mime });
  const n = (deliverable.versions.at(-1)?.n || 0) + 1;
  deliverable.versions.push({ n, label: cleanString(label, 80) || `Versión ${n}`, notes: cleanString(notes, 600), storageKey: key, mime: media.mime, size: stored.size, sha256: stored.sha256, lossless: media.lossless, kind: media.kind });
  await deliverable.save();
  await notify({ recipientType: 'band', recipientId: deliverable.bandId, kind: 'deliverable_version', title: `Nueva versión de “${deliverable.title}”`, body: 'Escúchala y deja tus comentarios en el minuto exacto.', link: '/banda' });
  return view(deliverable);
};

exports.comment = async ({ actor, id, versionN, atSec, text }) => {
  const deliverable = await load(id, actor);
  assert(deliverable.versions.some((version) => version.n === Number(versionN)), 404, 'No existe esa versión.');
  const body = cleanString(text, 500);
  assert(body, 400, 'Escribe un comentario.');
  const band = actor.bandId ? await Band.findById(actor.bandId).select('leaderName members') : null;
  const authorName = actor.type === 'engineer' ? engineers.find((item) => item.id === actor.id)?.name
    : actor.type === 'band' ? band?.leaderName : actor.type === 'member' ? band?.members.id(actor.id)?.name : 'Staff';
  deliverable.comments.push({ versionN: Number(versionN), atSec: Math.max(0, Math.min(86400, Math.floor(Number(atSec) || 0))), authorType: actor.type, authorName: authorName || 'GrooveSpace', text: body });
  if (deliverable.comments.length > 500) deliverable.comments.shift();
  await deliverable.save();
  const other = actor.type === 'engineer' ? { recipientType: 'band', recipientId: deliverable.bandId } : { recipientType: 'engineer', recipientId: deliverable.engineerId };
  await notify({ ...other, kind: 'deliverable_comment', title: `Comentario en “${deliverable.title}”`, body: body.slice(0, 120), link: other.recipientType === 'band' ? '/banda' : '/ingenieria', dedupeKey: `dcomment:${deliverable.id}:${Math.floor(Date.now() / 600000)}:${other.recipientType}` });
  return view(deliverable);
};

/** Sólo el líder o el tesorero aprueban una versión; sólo una versión aprobada se puede descargar. */
exports.approve = async ({ actor, id, versionN }) => {
  assert(['lider', 'tesorero'].includes(actor.role), 403, 'Sólo el líder o el tesorero pueden aprobar versiones.');
  const deliverable = await load(id, actor);
  const version = deliverable.versions.find((item) => item.n === Number(versionN));
  assert(version, 404, 'No existe esa versión.');
  assert(!version.approvedAt, 409, 'Esta versión ya está aprobada.');
  version.approvedAt = new Date();
  version.approvedBy = `${actor.type}:${actor.id}`;
  await deliverable.save();
  await notify({ recipientType: 'engineer', recipientId: deliverable.engineerId, kind: 'deliverable_approved', title: `Aprobaron “${deliverable.title}” v${version.n}`, body: 'La banda aprobó esta versión.', link: '/ingenieria' });
  return view(deliverable);
};

exports.issueStreamUrl = async ({ actor, id, versionN, download }) => {
  const deliverable = await load(id, actor);
  const version = deliverable.versions.find((item) => item.n === Number(versionN));
  assert(version, 404, 'No existe esa versión.');
  if (download) assert(version.approvedAt, 403, 'La descarga se habilita cuando la banda aprueba la versión.');
  const token = signToken(secret(), { sub: `${deliverable.id}:${version.n}`, dl: Boolean(download) }, 600);
  return { url: `/api/deliverables/${deliverable.id}/versions/${version.n}/file?t=${encodeURIComponent(token)}`, mime: version.mime, kind: version.kind, expiresInSeconds: 600 };
};

exports.streamFor = async (req, res) => {
  const claims = verifyToken(secret(), String(req.query.t || ''));
  if (!claims || claims.sub !== `${req.params.id}:${req.params.n}`) throw new HttpError(401, 'El enlace expiró. Vuelve a abrir el reproductor.');
  assert(isObjectId(req.params.id), 400, 'Identificador no válido.');
  const deliverable = await Deliverable.findById(req.params.id).select('+versions.storageKey title');
  const version = deliverable?.versions.find((item) => item.n === Number(req.params.n));
  assert(version, 404, 'No existe esa versión.');
  return storage.streamTo(req, res, { key: version.storageKey, size: version.size, mime: version.mime, filename: `${deliverable.title}-v${version.n}`, download: claims.dl });
};

exports.stageLabel = stageLabel;
