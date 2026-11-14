const express = require('express');
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const service = require('./service');
const { requireActor, requireBandManager } = require('../../middlewares/actor');
const rateLimit = require('../../middlewares/rateLimit');
const { wrap } = require('../../lib/http');

const tmpDir = path.join(os.tmpdir(), 'groovespace-uploads');
fs.mkdirSync(tmpDir, { recursive: true });
const upload = multer({ dest: tmpDir, limits: { files: 1, fileSize: 80 * 1024 * 1024 } });

const router = express.Router();
const engineerOnly = requireActor('engineer');

// ----- Público -----
router.get('/engineers', wrap(async (req, res) => res.status(200).json(await service.directory(req.query))));
router.get('/engineers/:id/reviews', wrap(async (req, res) => res.status(200).json(await service.reviews(req.params.id))));
router.get('/engineers/:id/samples/:sampleId/stream', rateLimit(60 * 1000, 120), wrap(async (req, res) => service.streamSample({ engineerId: req.params.id, sampleId: req.params.sampleId, req, res })));

// ----- Banda -----
router.get('/engineers/:id/review-eligibility', requireBandManager, wrap(async (req, res) => res.status(200).json({ eligible: (await service.eligibleReservations({ bandId: req.bandId, engineerId: req.params.id })).length > 0 })));
router.post('/engineers/:id/reviews', requireBandManager, rateLimit(60 * 1000, 10), wrap(async (req, res) => res.status(201).json(await service.addReview({ bandId: req.bandId, engineerId: req.params.id, rating: req.body?.rating, comment: req.body?.comment }))));
router.post('/engineers/:id/requests', requireBandManager, rateLimit(60 * 1000, 10), wrap(async (req, res) => res.status(201).json(await service.createRequest({ bandId: req.bandId, engineerId: req.params.id, body: req.body || {} }))));
router.get('/band/requests', requireBandManager, wrap(async (req, res) => res.status(200).json(await service.requestsForBand(req.bandId))));

// ----- Ingeniero -----
router.get('/me/profile', engineerOnly, wrap(async (req, res) => res.status(200).json(await service.myProfile(req.actor.id))));
router.put('/me/bio', engineerOnly, wrap(async (req, res) => res.status(200).json(await service.saveBio({ engineerId: req.actor.id, bio: req.body?.bio }))));
router.post('/me/samples', engineerOnly, rateLimit(60 * 60 * 1000, 20), upload.single('file'), wrap(async (req, res) => {
  try { return res.status(201).json(await service.addSample({ engineerId: req.actor.id, file: req.file, title: req.body?.title, genre: req.body?.genre })); }
  finally { if (req.file) fs.rm(req.file.path, { force: true }, () => {}); }
}));
router.delete('/me/samples/:sampleId', engineerOnly, wrap(async (req, res) => { await service.removeSample({ engineerId: req.actor.id, sampleId: req.params.sampleId }); return res.sendStatus(204); }));
router.get('/me/requests', engineerOnly, wrap(async (req, res) => res.status(200).json(await service.requestsForEngineer(req.actor.id))));
router.post('/me/requests/:requestId/respond', engineerOnly, wrap(async (req, res) => res.status(200).json(await service.respond({ engineerId: req.actor.id, requestId: req.params.requestId, accept: req.body?.accept === true, response: req.body?.response }))));

module.exports = router;
