const express = require('express');
const staffController = require('../controllers/staffController');
const checkinController = require('../controllers/checkinController');
const { requireStaff } = require('../middlewares/staffAuth');
const rateLimit = require('../middlewares/rateLimit');

const router = express.Router();

router.post('/login', rateLimit(15 * 60 * 1000, 5), staffController.login);

router.get('/rooms/status', requireStaff, checkinController.roomsStatus);
router.get('/checkin/today', requireStaff, checkinController.today);
router.get('/checkin/:code', requireStaff, checkinController.lookup);
router.post('/checkin/:code', requireStaff, rateLimit(60 * 1000, 60), checkinController.confirm);

module.exports = router;