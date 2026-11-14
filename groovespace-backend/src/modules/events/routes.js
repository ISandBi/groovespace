const express = require('express');
const service = require('./service');
const { requireActor, requireBandManager } = require('../../middlewares/actor');
const rateLimit = require('../../middlewares/rateLimit');
const { wrap } = require('../../lib/http');

const router = express.Router();
const staffOnly = requireActor('staff');

router.get('/', wrap(async (req, res) => res.status(200).json(await service.listPublic())));
router.get('/admin/all', staffOnly, wrap(async (req, res) => res.status(200).json(await service.listAll())));
router.get('/mine/applications', requireBandManager, wrap(async (req, res) => res.status(200).json(await service.myApplications(req.bandId))));
router.post('/', staffOnly, wrap(async (req, res) => res.status(201).json(await service.create({ staffId: req.actor.id, body: req.body || {} }))));
router.get('/:id', wrap(async (req, res) => res.status(200).json(await service.getPublic(req.params.id))));
router.patch('/:id', staffOnly, wrap(async (req, res) => res.status(200).json(await service.update({ id: req.params.id, body: req.body || {} }))));
router.post('/:id/apply', requireBandManager, rateLimit(60 * 1000, 10), wrap(async (req, res) => res.status(201).json(await service.apply({ actor: req.actor, eventId: req.params.id, message: req.body?.message }))));
router.get('/:id/applications', staffOnly, wrap(async (req, res) => res.status(200).json(await service.listApplications(req.params.id))));
router.post('/:id/applications/:applicationId/decision', staffOnly, wrap(async (req, res) => res.status(200).json(await service.decide({ eventId: req.params.id, applicationId: req.params.applicationId, status: req.body?.status, note: req.body?.note }))));
router.post('/:id/tickets', rateLimit(60 * 1000, 10), wrap(async (req, res) => res.status(201).json(await service.startPurchase({ eventId: req.params.id, ...req.body }))));

module.exports = router;
