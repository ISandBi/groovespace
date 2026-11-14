const express = require('express');
const service = require('./service');
const { requireBandManager } = require('../../middlewares/actor');
const rateLimit = require('../../middlewares/rateLimit');
const { wrap } = require('../../lib/http');

const router = express.Router();
router.use(requireBandManager);

router.get('/', wrap(async (req, res) => { res.set('Cache-Control', 'no-store'); return res.status(200).json(await service.summary(req.bandId)); }));
router.post('/topup', rateLimit(60 * 1000, 10), wrap(async (req, res) => res.status(201).json(await service.startTopup({ actor: req.actor, amount: req.body?.amount }))));
router.post('/pay-reservation', rateLimit(60 * 1000, 10), wrap(async (req, res) => res.status(200).json(await service.payReservation({ actor: req.actor, reservationId: req.body?.reservationId, paymentType: req.body?.paymentType }))));

module.exports = router;
