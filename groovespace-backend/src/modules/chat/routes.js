const express = require('express');
const Message = require('./Message');
const Reservation = require('../../models/Reservation');
const Band = require('../../models/Band');
const { requireActor } = require('../../middlewares/actor');
const rateLimit = require('../../middlewares/rateLimit');
const { notify } = require('../notifications/service');
const { engineers } = require('../../config/engineers');
const { wrap, assert, cleanString, isObjectId } = require('../../lib/http');

// Chat por sesión: cada conversación pertenece a una reserva y la ven la banda, su ingeniero y el staff.
const router = express.Router();
router.use(requireActor());

const loadForActor = async (reservationId, actor) => {
  assert(isObjectId(reservationId), 400, 'Identificador de reserva no válido.');
  const reservation = await Reservation.findById(reservationId);
  assert(reservation && !reservation.isDemo, 404, 'No se encontró la sesión.');
  const allowed = actor.type === 'staff'
    || (actor.bandId && String(reservation.bandId) === actor.bandId)
    || (actor.type === 'engineer' && reservation.engineerId === actor.id);
  assert(allowed, 403, 'No tienes acceso a esta conversación.');
  return reservation;
};

router.get('/:reservationId', wrap(async (req, res) => {
  await loadForActor(req.params.reservationId, req.actor);
  const filter = { reservationId: req.params.reservationId };
  if (req.query.after && !Number.isNaN(Date.parse(req.query.after))) filter.createdAt = { $gt: new Date(req.query.after) };
  const messages = await Message.find(filter).sort({ createdAt: 1 }).limit(200);
  res.set('Cache-Control', 'no-store');
  return res.status(200).json(messages.map((message) => ({ id: message.id, senderType: message.senderType, senderId: message.senderId, senderName: message.senderName, text: message.text, createdAt: message.createdAt })));
}));

router.post('/:reservationId', rateLimit(60 * 1000, 40), wrap(async (req, res) => {
  const reservation = await loadForActor(req.params.reservationId, req.actor);
  const text = cleanString(req.body?.text, 1000);
  assert(text, 400, 'Escribe un mensaje.');
  const { actor } = req;
  let senderName = 'GrooveSpace';
  const band = await Band.findById(reservation.bandId).select('name leaderName members email');
  if (actor.type === 'band') senderName = band?.leaderName || 'Líder';
  else if (actor.type === 'member') senderName = band?.members.id(actor.id)?.name || 'Integrante';
  else if (actor.type === 'engineer') senderName = engineers.find((item) => item.id === actor.id)?.name || 'Ingeniero';
  else senderName = 'Staff GrooveSpace';

  const message = await Message.create({ reservationId: reservation._id, senderType: actor.type, senderId: actor.id, senderName, text });

  // Aviso a los demás participantes (máx. uno por conversación cada 10 minutos para no saturar).
  const bucket = Math.floor(Date.now() / 600000);
  const title = `Mensaje de ${senderName}`;
  const preview = text.slice(0, 120);
  const link = '/banda';
  if (actor.type !== 'band' && band) await notify({ recipientType: 'band', recipientId: band._id, kind: 'chat', title, body: preview, link, dedupeKey: `chat:${reservation.id}:band:${bucket}` });
  if (actor.type !== 'engineer' && reservation.engineerId) await notify({ recipientType: 'engineer', recipientId: reservation.engineerId, kind: 'chat', title, body: preview, link: '/ingenieria', dedupeKey: `chat:${reservation.id}:eng:${bucket}` });
  return res.status(201).json({ id: message.id, senderType: message.senderType, senderId: message.senderId, senderName, text, createdAt: message.createdAt });
}));

module.exports = router;
