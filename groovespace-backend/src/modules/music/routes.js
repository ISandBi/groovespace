const express = require('express');
const service = require('./service');
const rateLimit = require('../../middlewares/rateLimit');
const { wrap } = require('../../lib/http');

const router = express.Router();

router.get('/catalog', wrap(async (req, res) => res.status(200).json(await service.catalog())));
router.get('/songs/:id/stream', wrap(service.streamSong));

router.post('/register', rateLimit(60 * 60 * 1000, 20), wrap(async (req, res) => res.status(201).json(await service.register(req.body || {}))));
router.post('/login', rateLimit(15 * 60 * 1000, 30), wrap(async (req, res) => res.status(200).json(await service.login(req.body || {}))));
router.get('/me', service.requireListener, wrap(async (req, res) => res.status(200).json({ listener: { id: String(req.listener._id), name: req.listener.name, email: req.listener.email } })));

router.post('/plays/start', service.requireListener, rateLimit(60 * 1000, 60), wrap(async (req, res) => res.status(201).json(await service.startPlay({ listener: req.listener, songId: req.body?.songId }))));
router.post('/plays/:id/complete', service.requireListener, rateLimit(60 * 1000, 60), wrap(async (req, res) => res.status(200).json(await service.completePlay({ listener: req.listener, playId: req.params.id }))));

module.exports = router;
