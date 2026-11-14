const express = require('express');
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const service = require('./service');
const { requireActor } = require('../../middlewares/actor');
const rateLimit = require('../../middlewares/rateLimit');
const { wrap } = require('../../lib/http');

const tmpDir = path.join(os.tmpdir(), 'groovespace-uploads');
fs.mkdirSync(tmpDir, { recursive: true });
const upload = multer({ dest: tmpDir, limits: { files: 1, fileSize: Number(process.env.DELIVERABLE_MAX_MB || 800) * 1024 * 1024 } });

const router = express.Router();
const engineerOnly = requireActor('engineer');

router.get('/:id/versions/:n/file', wrap(service.streamFor));
router.get('/reservation/:reservationId', requireActor(), wrap(async (req, res) => res.status(200).json(await service.listForReservation({ actor: req.actor, reservationId: req.params.reservationId }))));
router.post('/', engineerOnly, wrap(async (req, res) => res.status(201).json(await service.create({ engineerId: req.actor.id, reservationId: req.body?.reservationId, title: req.body?.title }))));
router.patch('/:id/stage', engineerOnly, wrap(async (req, res) => res.status(200).json(await service.setStage({ engineerId: req.actor.id, id: req.params.id, stage: req.body?.stage }))));
router.post('/:id/versions', engineerOnly, rateLimit(60 * 60 * 1000, 40), upload.single('file'), wrap(async (req, res) => {
  try { return res.status(201).json(await service.addVersion({ engineerId: req.actor.id, id: req.params.id, file: req.file, label: req.body?.label, notes: req.body?.notes })); }
  finally { if (req.file) fs.rm(req.file.path, { force: true }, () => {}); }
}));
router.post('/:id/comments', requireActor(), rateLimit(60 * 1000, 40), wrap(async (req, res) => res.status(201).json(await service.comment({ actor: req.actor, id: req.params.id, ...req.body }))));
router.post('/:id/versions/:n/approve', requireActor('band', 'member'), wrap(async (req, res) => res.status(200).json(await service.approve({ actor: req.actor, id: req.params.id, versionN: req.params.n }))));
router.post('/:id/versions/:n/stream-token', requireActor(), rateLimit(60 * 1000, 40), wrap(async (req, res) => res.status(200).json(await service.issueStreamUrl({ actor: req.actor, id: req.params.id, versionN: req.params.n, download: req.body?.download === true }))));

module.exports = router;
