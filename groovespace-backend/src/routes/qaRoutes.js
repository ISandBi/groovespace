const express = require('express');
const qaController = require('../controllers/qaController');
const rateLimit = require('../middlewares/rateLimit');
const { requireQa } = require('../middlewares/qaAuth');

const router = express.Router();
router.use(requireQa);
router.get('/events', rateLimit(60 * 1000, 60), qaController.listEvents);
router.get('/events/stream', rateLimit(60 * 1000, 10), qaController.streamEvents);
router.post('/events', rateLimit(60 * 1000, 30), qaController.ingestUiEvent);

module.exports = router;
