const express = require('express');
const staffController = require('../controllers/staffController');
const rateLimit = require('../middlewares/rateLimit');

const router = express.Router();

router.post('/login', rateLimit(15 * 60 * 1000, 5), staffController.login);

module.exports = router;