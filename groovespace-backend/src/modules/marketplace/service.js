const { EngineerProfile, EngineerReview, EngineerRequest } = require('./models');
const Reservation = require('../../models/Reservation');
const Band = require('../../models/Band');
const { engineers, publicEngineer } = require('../../config/engineers');
const { rooms } = require('../../config/catalog');
const storage = require('../storage');
const { sniffMedia, readHead } = require('../storage/media');
const { notify } = require('../notifications/service');
const { sessionStart } = require('../reminders/service');
const { assert, cleanString, isObjectId } = require('../../lib/http');
const { todayInMexicoCity } = require('../../config/payment');

const findEngineer = (id) => {
  const engineer = engineers.find((item) => item.id === id);
  assert(engineer, 404, 'No se encontró al ingeniero.');
  return engineer;
};

const ratingStats = async () => {
  const stats = await EngineerReview.aggregate([{ $group: { _id: '$engineerId', avg: { $avg: '$rating' }, count: { $sum: 1 } } }]);
  return new Map(stats.map((row) => [row._id, { rating: Math.round(row.avg * 10) / 10, reviews: row.count }]));
};

/** Directorio con filtros: género, tarifa máxima, tipo de demo y disponibilidad en una fecha. */
exports.directory = async ({ genre, maxRate, date, kind, sort }) => {
  const [stats, profiles] = await Promise.all([ratingStats(), EngineerProfile.find()]);
  let list = engineers.map((engineer) => ({
    ...publicEngineer(engineer),
    bio: profiles.find((profile) => profile.engineerId === engineer.id)?.bio || '',
    samples: (profiles.find((profile) => profile.engineerId === engineer.id)?.samples || []).map((sample) => ({ id: sample.id, title: sample.title, genre: sample.genre })),
    rating: stats.get(engineer.id)?.rating || null, reviews: stats.get(engineer.id)?.reviews || 0
  }));
  if (genre) list = list.filter((engineer) => engineer.genres.some((item) => item.toLowerCase() === String(genre).toLowerCase()));
  if (maxRate && Number(maxRate) > 0) list = list.filter((engineer) => engineer.hourlyRate <= Number(maxRate));
  if (['audio', 'video'].includes(kind)) list = list.filter((engineer) => engineer.demoKinds.includes(kind));
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const busy = await Reservation.find({ date, isDemo: { $ne: true }, engineerId: { $in: list.map((engineer) => engineer.id) }, paymentStatus: { $in: ['deposit_pending', 'deposit_paid', 'paid'] } }).select('engineerId startTime duration');
    list = list.map((engineer) => ({ ...engineer, busy: busy.filter((item) => item.engineerId === engineer.id).map(({ startTime, duration }) => ({ startTime, duration })) }));
  }
  const order = { rating: (a, b) => (b.rating || 0) - (a.rating || 0), price: (a, b) => a.hourlyRate - b.hourlyRate };
  return list.sort(order[sort] || order.rating);
};

exports.reviews = async (engineerId) => {
  findEngineer(engineerId);
  const reviews = await EngineerReview.find({ engineerId }).populate('bandId', 'name logoPath').sort({ createdAt: -1 }).limit(50);
  return reviews.map((review) => ({ id: review.id, rating: review.rating, comment: review.comment, band: review.bandId ? { name: review.bandId.name, logoPath: review.bandId.logoPath } : null, createdAt: review.createdAt }));
};

/** Reseña sólo de bandas que ya tuvieron (y pagaron) una sesión con ese ingeniero. */
exports.eligibleReservations = async ({ bandId, engineerId }) => {
  const sessions = await Reservation.find({ bandId, engineerId, isDemo: { $ne: true }, paymentStatus: { $in: ['deposit_paid', 'paid'] } }).sort({ date: -1 });
  const reviewed = new Set((await EngineerReview.find({ bandId, engineerId }).select('reservationId')).map((item) => String(item.reservationId)));
  return sessions.filter((session) => sessionStart(session).getTime() + session.duration * 3600000 < Date.now() && !reviewed.has(session.id));
};

exports.addReview = async ({ bandId, engineerId, rating, comment }) => {
  findEngineer(engineerId);
  const value = Number(rating);
  assert(Number.isInteger(value) && value >= 1 && value <= 5, 400, 'La calificación va de 1 a 5.');
  const [session] = await exports.eligibleReservations({ bandId, engineerId });
  assert(session, 403, 'Sólo puedes reseñar a un ingeniero después de una sesión terminada con él.');
  const review = await EngineerReview.create({ engineerId, bandId, reservationId: session._id, rating: value, comment: cleanString(comment, 800) });
  await notify({ recipientType: 'engineer', recipientId: engineerId, kind: 'review_received', title: `Nueva reseña: ${value}★`, body: review.comment || 'Una banda calificó tu sesión.', link: '/ingenieria' });
  return review;
};

// ---------- Portafolio de audio del ingeniero ----------
exports.myProfile = async (engineerId) => (await EngineerProfile.findOne({ engineerId })) || { engineerId, bio: '', samples: [] };

exports.saveBio = async ({ engineerId, bio }) => EngineerProfile.findOneAndUpdate({ engineerId }, { $set: { bio: cleanString(bio, 1000) } }, { upsert: true, new: true });

exports.addSample = async ({ engineerId, file, title, genre }) => {
  assert(file, 400, 'Adjunta una muestra de audio.');
  const media = sniffMedia(await readHead(file.path, 16));
  assert(media?.kind === 'audio', 400, 'Las muestras del portafolio deben ser audio (WAV, FLAC, MP3, M4A u OGG).');
  const profile = await EngineerProfile.findOne({ engineerId }) || new EngineerProfile({ engineerId });
  assert(profile.samples.length < 6, 409, 'Puedes tener hasta 6 muestras. Elimina una para subir otra.');
  const key = storage.newKey(`portfolio/${engineerId}`, media.ext);
  const stored = await storage.store({ key, filePath: file.path, size: file.size, contentType: media.mime });
  profile.samples.push({ title: cleanString(title, 100) || 'Muestra', genre: cleanString(genre, 40), storageKey: key, mime: media.mime, size: stored.size, sha256: stored.sha256, lossless: media.lossless });
  await profile.save();
  return profile.samples.map((sample) => ({ id: sample.id, title: sample.title, genre: sample.genre }));
};

exports.removeSample = async ({ engineerId, sampleId }) => {
  const profile = await EngineerProfile.findOne({ engineerId }).select('+samples.storageKey');
  const sample = profile?.samples.id(sampleId);
  assert(sample, 404, 'No se encontró la muestra.');
  await storage.remove(sample.storageKey);
  profile.samples.pull(sampleId);
  await profile.save();
};

// El portafolio es público (promoción del ingeniero): se reproduce en línea sin descarga.
exports.streamSample = async ({ engineerId, sampleId, req, res }) => {
  const profile = await EngineerProfile.findOne({ engineerId }).select('+samples.storageKey');
  const sample = profile?.samples.id(sampleId);
  assert(sample, 404, 'No se encontró la muestra.');
  return storage.streamTo(req, res, { key: sample.storageKey, size: sample.size, mime: sample.mime, filename: `muestra-${sampleId}` });
};

// ---------- Solicitudes directas banda → ingeniero ----------
exports.createRequest = async ({ bandId, engineerId, body }) => {
  const engineer = findEngineer(engineerId);
  const room = rooms.find((item) => item.id === body.roomId);
  assert(room, 400, 'Selecciona una sala válida.');
  const duration = Number(body.duration);
  assert(Number.isInteger(duration) && duration >= 1 && duration <= 4, 400, 'La sesión dura de 1 a 4 horas.');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(body.date || '') && body.date > todayInMexicoCity(), 400, 'Elige una fecha futura.');
  assert(/^([01]\d|2[0-3]):[0-5]\d$/.test(body.startTime || ''), 400, 'La hora debe tener el formato HH:MM.');
  assert(!(await EngineerRequest.exists({ bandId, engineerId, status: 'pending' })), 409, 'Ya tienes una solicitud pendiente con este ingeniero.');
  const request = await EngineerRequest.create({ bandId, engineerId, roomId: room.id, date: body.date, startTime: body.startTime, duration, message: cleanString(body.message, 600) });
  const band = await Band.findById(bandId).select('name');
  await notify({ recipientType: 'engineer', recipientId: engineer.id, kind: 'engineer_request', title: 'Solicitud de sesión', body: `${band?.name || 'Una banda'} propone ${body.date} a las ${body.startTime} en ${room.name}.`, link: '/ingenieria' });
  return request;
};

exports.requestsForBand = async (bandId) => (await EngineerRequest.find({ bandId }).sort({ createdAt: -1 }).limit(30)).map((request) => ({ ...request.toObject(), engineerName: engineers.find((item) => item.id === request.engineerId)?.name }));

exports.requestsForEngineer = async (engineerId) => {
  const requests = await EngineerRequest.find({ engineerId }).populate('bandId', 'name leaderName').sort({ createdAt: -1 }).limit(50);
  return requests.map((request) => ({ ...request.toObject(), roomName: rooms.find((room) => room.id === request.roomId)?.name }));
};

exports.respond = async ({ engineerId, requestId, accept, response }) => {
  assert(isObjectId(requestId), 400, 'Identificador no válido.');
  const request = await EngineerRequest.findOne({ _id: requestId, engineerId });
  assert(request, 404, 'No se encontró la solicitud.');
  assert(request.status === 'pending', 409, 'Esta solicitud ya fue respondida.');
  request.status = accept ? 'accepted' : 'declined';
  request.response = cleanString(response, 500);
  request.respondedAt = new Date();
  await request.save();
  const engineer = findEngineer(engineerId);
  await notify({
    recipientType: 'band', recipientId: request.bandId, kind: 'engineer_response',
    title: accept ? `${engineer.name} aceptó tu propuesta` : `${engineer.name} no puede en esa fecha`,
    body: accept ? `Reserva la sala el ${request.date} a las ${request.startTime} para confirmar la sesión.` : (request.response || 'Prueba con otra fecha u otro ingeniero.'), link: '/banda'
  });
  return request;
};
