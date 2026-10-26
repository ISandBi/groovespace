const express = require('express');
const bandController = require('../controllers/bandController');
const upload = require('../middlewares/upload');
const { requireStaff } = require('../middlewares/staffAuth');
const { requireBand } = require('../middlewares/bandAuth');
const rateLimit = require('../middlewares/rateLimit');

const router = express.Router();

router.post('/register', rateLimit(15 * 60 * 1000, 5), upload.fields([
	{ name: 'logo', maxCount: 1 },
	{ name: 'instrumentPhotos', maxCount: 12 }
]), bandController.registerBand);
router.post('/login', rateLimit(15 * 60 * 1000, 10), bandController.loginBand);

// Canal para que el tablero del Staff consulte la bitácora general de registros
router.get('/all', requireStaff, bandController.getAllBands);
router.delete('/:bandId', requireStaff, bandController.deleteBand);
router.get('/engineers', bandController.getEngineers);
router.get('/email-domains', bandController.getBandEmailDomains);
router.post('/invite', requireBand, bandController.createInvite);
router.get('/invite/:token', bandController.getInvite);
router.post('/invite/:token/members', bandController.joinBand);
router.get('/:bandId/profile', requireBand, bandController.getBandProfile);
router.patch('/:bandId/profile', requireBand, bandController.updateBandProfile);
router.post('/:bandId/instruments', requireBand, upload.fields([{ name: 'instrumentPhotos', maxCount: 12 }]), bandController.addBandInstruments);
router.delete('/:bandId/members/:memberId', requireBand, bandController.removeBandMember);

module.exports = router;
