const express = require('express');
const paymentController = require('../controllers/paymentController');
const { requireBand } = require('../middlewares/bandAuth');

const router = express.Router();

router.post('/checkout', requireBand, paymentController.createCheckoutSession);
router.get('/verify/:reservationId/:sessionId', requireBand, paymentController.verifyCheckoutSession);

module.exports = router;