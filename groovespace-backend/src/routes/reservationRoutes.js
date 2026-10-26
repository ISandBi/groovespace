const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservationController');
const { requireStaff } = require('../middlewares/staffAuth');
const { requireBand } = require('../middlewares/bandAuth');

router.post('/book', requireBand, reservationController.createReservation);
router.post('/demo', requireBand, reservationController.createDemoReservation);
router.get('/all', requireStaff, reservationController.getAllReservations);
router.get('/:reservationId', requireBand, reservationController.getReservation);
router.patch('/:reservationId/layout', requireBand, reservationController.updateRoomLayout);
router.get('/band/:bandId', requireBand, reservationController.getBandReservations);

router.get('/room/:roomId', reservationController.getRoomsReservations);

module.exports = router;