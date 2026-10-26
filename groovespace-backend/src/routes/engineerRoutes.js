const express = require('express');
const engineerController = require('../controllers/engineerController');
const { requireEngineer } = require('../middlewares/engineerAuth');
const rateLimit = require('../middlewares/rateLimit');

const router = express.Router();

router.post('/login', rateLimit(15 * 60 * 1000, 5), engineerController.login);
router.get('/me/schedule', requireEngineer, engineerController.getSchedule);

module.exports = router;