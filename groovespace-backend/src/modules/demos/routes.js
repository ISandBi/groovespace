const express = require('express');
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const service = require('./service');
const rateLimit = require('../../middlewares/rateLimit');
const { requireActor, requireBandManager } = require('../../middlewares/actor');
const { wrap } = require('../../lib/http');
const imageUpload = require('../../middlewares/imageUpload');

const MAX_MB = Number(process.env.DEMO_MAX_MB || 600);
const tmpDir = path.join(os.tmpdir(), 'groovespace-uploads');
fs.mkdirSync(tmpDir, { recursive: true });
const upload = multer({ dest: tmpDir, limits: { files: 1, fileSize: MAX_MB * 1024 * 1024 } });

const router = express.Router();

router.get('/agreement', (req, res) => res.status(200).json(service.agreement));

// El reproductor usa un enlace de 10 minutos (los <audio>/<video> no pueden enviar encabezados de sesión).
router.get('/:id/stream', wrap(service.streamFor));

router.post('/', requireBandManager, rateLimit(60 * 60 * 1000, 20), upload.single('file'), wrap(async (req, res) => {
  try {
    const demo = await service.upload({ bandId: req.bandId, file: req.file, body: req.body });
    return res.status(201).json({ demo });
  } finally {
    if (req.file) fs.rm(req.file.path, { force: true }, () => {});
  }
}));

router.get('/mine', requireActor('band', 'member'), wrap(async (req, res) => res.status(200).json(await service.listForBand(req.bandId))));
router.delete('/:id', requireBandManager, wrap(async (req, res) => { await service.remove({ bandId: req.bandId, id: req.params.id }); return res.sendStatus(204); }));

router.patch('/:id/cover', requireBandManager, imageUpload.single('cover'), wrap(async (req, res) => res.status(200).json(await service.setCover({ bandId: req.bandId, id: req.params.id, file: req.file }))));

router.patch('/:id/publish', requireBandManager, wrap(async (req, res) => res.status(200).json(await require('../music/service').publish({ bandId: req.bandId, id: req.params.id, published: req.body?.published, lyrics: req.body?.lyrics }))));

router.get('/inbox', requireActor('engineer'), wrap(async (req, res) => res.status(200).json(await service.listForEngineer(req.actor.id))));
router.post('/:id/sign', requireActor('engineer'), wrap(async (req, res) => res.status(200).json({ demo: await service.sign({ engineerId: req.actor.id, id: req.params.id, fullName: req.body?.fullName, accept: req.body?.accept }) })));
router.post('/:id/review', requireActor('engineer'), wrap(async (req, res) => res.status(200).json({ demo: await service.review({ engineerId: req.actor.id, id: req.params.id, status: req.body?.status, feedback: req.body?.feedback }) })));
router.post('/:id/stream-token', requireActor('engineer', 'band', 'member'), rateLimit(60 * 1000, 30), wrap(async (req, res) => res.status(200).json(await service.issueStreamUrl({ actor: req.actor, id: req.params.id }))));

module.exports = router;
