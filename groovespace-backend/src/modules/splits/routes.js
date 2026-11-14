const express = require('express');
const service = require('./service');
const { requireBandAccess, requireBandManager } = require('../../middlewares/actor');
const rateLimit = require('../../middlewares/rateLimit');
const { wrap } = require('../../lib/http');

const router = express.Router();
router.get('/:reservationId', requireBandAccess(), wrap(async (req, res) => res.status(200).json({ plan: await service.getPlan({ actor: req.actor, reservationId: req.params.reservationId }) })));
router.post('/:reservationId', requireBandManager, wrap(async (req, res) => res.status(201).json({ plan: await service.createPlan({ actor: req.actor, reservationId: req.params.reservationId, ...req.body }) })));
router.delete('/:reservationId', requireBandManager, wrap(async (req, res) => { await service.cancelPlan({ actor: req.actor, reservationId: req.params.reservationId }); return res.sendStatus(204); }));
router.post('/:reservationId/pay', requireBandAccess(), rateLimit(60 * 1000, 20), wrap(async (req, res) => res.status(201).json(await service.payShare({ actor: req.actor, reservationId: req.params.reservationId, memberId: req.body?.memberId }))));

module.exports = router;
