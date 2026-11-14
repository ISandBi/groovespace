const express = require('express');
const paymentController = require('../controllers/paymentController');
const { requireBand, optionalBand } = require('../middlewares/bandAuth');
const { optionalActor, requireBandManager } = require('../middlewares/actor');
const rateLimit = require('../middlewares/rateLimit');

const router = express.Router();

router.post('/checkout', requireBandManager, paymentController.createCheckoutSession);
router.get('/config', paymentController.getPaymentConfig);
router.get('/session/:sessionId', rateLimit(60 * 1000, 60), paymentController.describeSession);
router.post('/simulate', rateLimit(60 * 1000, 20), optionalActor, paymentController.simulatePayment);
router.get('/verify/:reservationId/:sessionId', requireBand, paymentController.verifyCheckoutSession);

module.exports = router;