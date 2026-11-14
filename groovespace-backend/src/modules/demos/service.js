const crypto = require('crypto');
const Demo = require('./Demo');
const Band = require('../../models/Band');
const agreement = require('./agreement');
const storage = require('../storage');
const { sniffMedia, readHead, probe } = require('../storage/media');
const { signToken, verifyToken, deriveSecret } = require('../../lib/token');
const { HttpError, assert, cleanString, isObjectId } = require('../../lib/http');
const { engineers } = require('../../config/engineers');
const { notify } = require('../notifications/service');

const MAX_DEMOS_PER_BAND = 12;
const streamSecret = () => deriveSecret(process.env.BAND_TOKEN_SECRET, 'demo-stream');

const publicDemo = (demo, { forEngineer = false } = {}) => {
  const data = demo.toObject ? demo.toObject() : demo;
  delete data.storageKey;
  delete data.__v;
  if (forEngineer) delete data.rights?.statement;
  return data;
};
exports.publicDemo = publicDemo;

exports.upload = async ({ bandId, file, body }) => {
  assert(file, 400, 'Adjunta el archivo del demo.');
  const engineer = engineers.find((item) => item.id === body.engineerId);
  assert(engineer, 400, 'Selecciona el ingeniero que evaluará tu demo.');
  const title = cleanString(body.title, 120);
  const holder = cleanString(body.rightsHolder, 120);
  assert(title && holder, 400, 'Escribe el título del demo y el nombre del titular de los derechos.');
  assert(body.rightsAccepted === 'true', 400, 'Debes declarar que eres titular de los derechos o cuentas con autorización para compartir el demo.');
  assert(await Demo.countDocuments({ bandId }) < MAX_DEMOS_PER_BAND, 409, `Cada banda puede tener hasta ${MAX_DEMOS_PER_BAND} demos. Elimina uno para subir otro.`);

  const media = sniffMedia(await readHead(file.path, 16));
  assert(media, 400, 'Formato no compatible. Usa WAV o FLAC (sin pérdida), MP3, M4A, OGG, o MP4/MOV/WebM para video.');
  assert(engineer.demoKinds.includes(media.kind), 400,
    media.kind === 'audio'
      ? `${engineer.name} evalúa demos en video (en vivo). Sube una grabación de tu presentación.`
      : `${engineer.name} evalúa demos de audio. Sube una pista de audio.`);

  const meta = await probe(file.path);
  const key = storage.newKey(`demos/${bandId}`, media.ext);
  const stored = await storage.store({ key, filePath: file.path, size: file.size, contentType: media.mime });
  const demo = await Demo.create({
    bandId, engineerId: engineer.id, title, kind: media.kind, storageKey: key,
    originalName: cleanString(file.originalname, 160), mime: media.mime, size: stored.size, sha256: stored.sha256,
    lossless: media.lossless, meta: meta || undefined,
    rights: { holder, acceptedAt: new Date(), statement: 'Declaro bajo protesta de decir verdad que soy titular de los derechos de este material o cuento con autorización de los titulares para compartirlo con fines de evaluación.' }
  });
  const band = await Band.findById(bandId).select('name');
  await notify({ recipientType: 'engineer', recipientId: engineer.id, kind: 'demo_received', title: 'Nuevo demo para escuchar', body: `${band?.name || 'Una banda'} te envió “${title}”. Firma el acuerdo de uso para escucharlo.`, link: '/ingenieria' });
  return publicDemo(demo);
};

exports.listForBand = async (bandId) => (await Demo.find({ bandId }).sort({ createdAt: -1 })).map((demo) => publicDemo(demo));

exports.listForEngineer = async (engineerId) => {
  const demos = await Demo.find({ engineerId }).populate('bandId', 'name leaderName').sort({ createdAt: -1 });
  return demos.map((demo) => publicDemo(demo, { forEngineer: true }));
};

const loadDemo = async (id) => {
  assert(isObjectId(id), 400, 'Identificador de demo no válido.');
  const demo = await Demo.findById(id).select('+storageKey');
  assert(demo, 404, 'No se encontró el demo.');
  return demo;
};

exports.remove = async ({ bandId, id }) => {
  const demo = await loadDemo(id);
  assert(String(demo.bandId) === String(bandId), 403, 'Este demo no pertenece a tu banda.');
  await storage.remove(demo.storageKey);
  await demo.deleteOne();
};

/** El ingeniero firma el acuerdo; GrooveSpace contrafirma automáticamente (firma simulada). */
exports.sign = async ({ engineerId, id, fullName, accept }) => {
  const demo = await loadDemo(id);
  assert(demo.engineerId === engineerId, 403, 'Este demo no está dirigido a ti.');
  assert(!demo.agreement?.engineerSignedAt, 409, 'Ya firmaste el acuerdo de este demo.');
  const engineer = engineers.find((item) => item.id === engineerId);
  const name = cleanString(fullName, 100);
  assert(accept === true, 400, 'Debes aceptar el acuerdo para escuchar el demo.');
  assert(name.toLowerCase() === engineer.name.toLowerCase(), 400, 'Escribe tu nombre completo tal como aparece en tu perfil para firmar.');

  const signedAt = new Date();
  demo.agreement = {
    version: agreement.version,
    textHash: agreement.hash,
    engineerName: engineer.name,
    engineerSignedAt: signedAt,
    grooveSpaceSignatory: `${agreement.grooveSpace.signatory} · ${agreement.grooveSpace.company}`,
    sealHash: crypto.createHash('sha256').update(`${demo.id}|${engineer.id}|${agreement.hash}|${signedAt.toISOString()}`).digest('hex')
  };
  await demo.save();
  return publicDemo(demo, { forEngineer: true });
};

/** Emite un enlace de reproducción de 10 minutos. Quedan registrados los accesos del ingeniero. */
exports.issueStreamUrl = async ({ actor, id }) => {
  const demo = await loadDemo(id);
  if (actor.type === 'engineer') {
    assert(demo.engineerId === actor.id, 403, 'Este demo no está dirigido a ti.');
    assert(demo.agreement?.engineerSignedAt, 403, 'Firma el acuerdo de uso antes de escuchar el demo.');
    const firstListen = !demo.listens.length;
    demo.listens.push({ at: new Date() });
    if (demo.listens.length > 200) demo.listens.shift();
    if (demo.review.status === 'new') demo.review.status = 'listened';
    await demo.save();
    if (firstListen) {
      const engineer = engineers.find((item) => item.id === actor.id);
      const band = await Band.findById(demo.bandId).select('name email');
      if (band) await notify({ recipientType: 'band', recipientId: band._id, kind: 'demo_listened', title: 'Escucharon tu demo', body: `${engineer.name} empezó a escuchar “${demo.title}”.`, link: '/banda', email: band.email });
    }
  } else {
    assert(actor.type === 'band' && String(demo.bandId) === actor.bandId, 403, 'Este demo no pertenece a tu banda.');
  }
  const token = signToken(streamSecret(), { sub: String(demo._id), who: `${actor.type}:${actor.id}` }, 600);
  return { url: `/api/demos/${demo.id}/stream?t=${encodeURIComponent(token)}`, mime: demo.mime, kind: demo.kind, expiresInSeconds: 600 };
};

exports.streamFor = async (req, res) => {
  const claims = verifyToken(streamSecret(), String(req.query.t || ''));
  if (!claims || claims.sub !== req.params.id) throw new HttpError(401, 'El enlace de reproducción expiró. Vuelve a abrir el reproductor.');
  const demo = await loadDemo(req.params.id);
  return storage.streamTo(req, res, { key: demo.storageKey, size: demo.size, mime: demo.mime, filename: `demo-${demo.id}` });
};

exports.review = async ({ engineerId, id, status, feedback }) => {
  const demo = await loadDemo(id);
  assert(demo.engineerId === engineerId, 403, 'Este demo no está dirigido a ti.');
  assert(demo.agreement?.engineerSignedAt, 403, 'Firma el acuerdo antes de evaluar el demo.');
  assert(['accepted', 'needs_changes', 'declined'].includes(status), 400, 'Elige una evaluación válida.');
  demo.review = { status, feedback: cleanString(feedback, 1200), at: new Date() };
  await demo.save();
  const engineer = engineers.find((item) => item.id === engineerId);
  const labels = { accepted: 'aceptó trabajar contigo', needs_changes: 'te pidió ajustes', declined: 'no podrá tomar tu proyecto' };
  const band = await Band.findById(demo.bandId).select('name email');
  if (band) await notify({ recipientType: 'band', recipientId: band._id, kind: 'demo_review', title: `${engineer.name} ${labels[status]}`, body: demo.review.feedback || `Evaluación de “${demo.title}”.`, link: '/banda', email: band.email });
  return publicDemo(demo, { forEngineer: true });
};

exports.agreement = agreement;
