const express = require('express');
const service = require('./service');
const { requireActor, requireBandAccess } = require('../../middlewares/actor');
const rateLimit = require('../../middlewares/rateLimit');
const { wrap } = require('../../lib/http');

const router = express.Router();
router.get('/terms', requireBandAccess(), wrap(async (req, res) => res.status(200).json(await service.termsStatus(req.actor))));
router.post('/terms/accept', requireBandAccess('lider'), rateLimit(60 * 1000, 10), wrap(async (req, res) => res.status(200).json(await service.acceptTerms({ actor: req.actor, typedName: req.body?.typedName }))));
router.get('/', requireActor('band', 'member', 'engineer'), wrap(async (req, res) => res.status(200).json(await service.list(req.actor))));
router.post('/co-production', requireBandAccess('lider', 'tesorero'), rateLimit(60 * 1000, 10), wrap(async (req, res) => res.status(201).json(await service.createCoProduction({ actor: req.actor, ...req.body }))));
router.post('/:id/sign', requireActor('band', 'member', 'engineer'), rateLimit(60 * 1000, 10), wrap(async (req, res) => res.status(200).json(await service.sign({ actor: req.actor, id: req.params.id, typedName: req.body?.typedName }))));

module.exports = router;
