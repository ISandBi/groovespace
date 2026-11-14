const express = require('express');
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const service = require('./service');
const Band = require('../../models/Band');
const rateLimit = require('../../middlewares/rateLimit');
const { requireActor, requireBandAccess, requireBandManager } = require('../../middlewares/actor');
const { wrap, assert } = require('../../lib/http');

const tmpDir = path.join(os.tmpdir(), 'groovespace-uploads');
fs.mkdirSync(tmpDir, { recursive: true });
const upload = multer({ dest: tmpDir, limits: { files: 1, fileSize: 60 * 1024 * 1024 } });

// ---------- Mi banda (líder o integrantes) ----------
const mine = express.Router();
const anyMember = requireBandAccess();
const leaderOnly = requireBandAccess('lider');

mine.get('/me', requireActor('band', 'member'), wrap(async (req, res) => {
  const band = await Band.findById(req.actor.bandId).select('name leaderName logoPath members slug isPublic');
  assert(band, 404, 'No se encontró la banda.');
  const member = req.actor.type === 'member' ? band.members.id(req.actor.id) : null;
  assert(req.actor.type === 'band' || member, 403, 'Ya no formas parte de esta banda.');
  return res.status(200).json({ type: req.actor.type, role: member ? member.role : 'lider', name: member ? member.name : band.leaderName, bandId: band.id, bandName: band.name, logoPath: band.logoPath, slug: band.slug, isPublic: band.isPublic });
}));

mine.get('/team', anyMember, wrap(async (req, res) => res.status(200).json(await service.team(req.bandId))));
mine.patch('/members/:memberId/role', leaderOnly, wrap(async (req, res) => res.status(200).json(await service.setMemberRole({ bandId: req.bandId, memberId: req.params.memberId, role: req.body?.role }))));
mine.post('/members/:memberId/access-link', leaderOnly, rateLimit(60 * 1000, 20), wrap(async (req, res) => res.status(201).json(await service.memberAccessLink({ bandId: req.bandId, memberId: req.params.memberId }))));

mine.post('/invite-links', requireBandManager, rateLimit(60 * 1000, 20), wrap(async (req, res) => res.status(201).json(await service.createInviteLinks(req.bandId))));
mine.post('/invite-email', requireBandManager, rateLimit(60 * 60 * 1000, 20), wrap(async (req, res) => res.status(200).json(await service.sendInviteEmails({ bandId: req.bandId, emails: req.body?.emails }))));

mine.get('/calendar', anyMember, wrap(async (req, res) => res.status(200).json(await service.calendar(req.actor))));
mine.post('/reservations/:id/attendance', anyMember, wrap(async (req, res) => res.status(200).json({ attendance: await service.setAttendance({ actor: req.actor, reservationId: req.params.id, status: req.body?.status }) })));

mine.get('/setlist', anyMember, wrap(async (req, res) => res.status(200).json((await service.getStagePack(req.bandId)).setlist)));
mine.put('/setlist', requireBandManager, wrap(async (req, res) => res.status(200).json(await service.saveSetlist({ bandId: req.bandId, songs: req.body?.songs }))));
mine.get('/rider', anyMember, wrap(async (req, res) => res.status(200).json((await service.getStagePack(req.bandId)).rider)));
mine.put('/rider', requireBandManager, wrap(async (req, res) => res.status(200).json(await service.saveRider({ bandId: req.bandId, body: req.body || {} }))));
mine.patch('/epk', requireBandManager, wrap(async (req, res) => res.status(200).json(await service.updateProfile({ bandId: req.bandId, body: req.body || {} }))));

mine.get('/files', anyMember, wrap(async (req, res) => res.status(200).json(await service.listFiles(req.bandId))));
mine.post('/files', requireBandManager, rateLimit(60 * 60 * 1000, 40), upload.single('file'), wrap(async (req, res) => {
  try {
    return res.status(201).json(await service.uploadFile({ actor: req.actor, file: req.file, visibility: req.body?.visibility }));
  } finally {
    if (req.file) fs.rm(req.file.path, { force: true }, () => {});
  }
}));
mine.delete('/files/:id', requireBandManager, wrap(async (req, res) => { await service.removeFile({ bandId: req.bandId, id: req.params.id }); return res.sendStatus(204); }));

// Descarga de archivos: banda propietaria, ingeniero con sesión (si es visible para él) o staff.
const files = express.Router();
files.get('/:id', requireActor(), wrap(async (req, res) => service.openFile({ actor: req.actor, id: req.params.id, req, res })));

// Paquete técnico (setlist + rider) para el ingeniero con sesión.
const stage = express.Router();
stage.get('/:bandId', requireActor('engineer', 'staff'), wrap(async (req, res) => res.status(200).json(
  req.actor.type === 'staff' ? await service.getStagePack(req.params.bandId) : await service.stagePackForEngineer({ engineerId: req.actor.id, bandId: req.params.bandId })
)));

// ---------- Público ----------
const epk = express.Router();
epk.get('/', wrap(async (req, res) => res.status(200).json(await service.directory(req.query))));
epk.get('/:slug', wrap(async (req, res) => res.status(200).json(await service.publicProfile(req.params.slug))));

module.exports = { mine, files, stage, epk };
