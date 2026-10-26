const Reservation = require('../models/Reservation');
const ReservationSlot = require('../models/ReservationSlot');
const Band = require('../models/Band');
const { rooms, rentalGear } = require('../config/catalog');

exports.createReservation = async (req, res) => {
    try {
        const { bandId, roomId: requestedRoomId, roomID, date, startTime, duration, attendees, rentedGear = [] } = req.body;
        const resolvedRoomId = requestedRoomId || roomID;

        if (String(bandId) !== req.bandId) {
            return res.status(403).json({ error: 'No puedes reservar en nombre de otra banda.' });
        }

        if (!bandId || !resolvedRoomId || !date || !startTime || duration === undefined || attendees === undefined) {
            return res.status(400).json({ error: 'Faltan parámetros críticos de logística de red para procesar la sesión.' });
        }

        const room = rooms.find((item) => item.id === resolvedRoomId);
        const normalizedDuration = Number(duration);
        const normalizedAttendees = Number(attendees);
        if (!room || !Number.isInteger(normalizedDuration) || normalizedDuration < 1 || normalizedDuration > 4 ||
            !Number.isInteger(normalizedAttendees) || normalizedAttendees < 1 || normalizedAttendees > room.capacity) {
            return res.status(400).json({ error: 'La sala, duración o cantidad de integrantes no es válida.' });
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date ||
            !/^\d{2}:\d{2}$/.test(startTime) || Number(startTime.slice(0, 2)) > 23 || Number(startTime.slice(3, 5)) > 59 || Number(startTime.slice(3, 5)) % 15 !== 0) {
            return res.status(400).json({ error: 'La fecha y hora de la sesión no tienen un formato válido.' });
        }

        const sessionStart = new Date(`${date}T${startTime}:00-06:00`);
        if (Number.isNaN(sessionStart.getTime()) || sessionStart.getTime() <= Date.now()) {
            return res.status(400).json({ error: 'La fecha y hora de la sesión deben ser válidas y futuras.' });
        }
        const startMinutes = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3, 5));
        if (startMinutes + normalizedDuration * 60 > 24 * 60) {
            return res.status(400).json({ error: 'La sesión debe finalizar antes de la medianoche.' });
        }

        const balanceDueAt = new Date(sessionStart.getTime() - 24 * 60 * 60 * 1000);
        if (balanceDueAt.getTime() <= Date.now()) {
            return res.status(400).json({ error: 'La reserva debe realizarse con al menos 24 horas de anticipación para liquidar el saldo.' });
        }

        const band = await Band.findById(bandId).select('requiresEngineer engineerId');
        if (!band) return res.status(404).json({ error: 'No se encontró la banda de esta reserva.' });

        const holdCutoff = new Date(Date.now() - 35 * 60 * 1000);
        await Reservation.updateMany(
            { roomId: resolvedRoomId, date, isDemo: { $ne: true }, paymentStatus: 'deposit_pending', createdAt: { $lt: holdCutoff } },
            { $set: { paymentStatus: 'expired' } }
        );
        const demoReservations = await Reservation.find({ roomId: resolvedRoomId, date, isDemo: true }).select('_id');
        if (demoReservations.length) {
            await ReservationSlot.deleteMany({ reservationId: { $in: demoReservations.map((reservation) => reservation._id) } });
        }
        await ReservationSlot.deleteMany({ roomId: resolvedRoomId, date, expiresAt: { $lte: new Date() } });
        const sameDayReservations = await Reservation.find({
            roomId: resolvedRoomId,
            date,
            isDemo: { $ne: true },
            paymentStatus: { $nin: ['expired', 'refunded'] }
        });

        const requestedStartMinutes = startMinutes;
        const requestedEndMinutes = requestedStartMinutes + normalizedDuration * 60;
        const collisionExists = sameDayReservations.some((reservation) => {
            if (reservation.paymentStatus === 'deposit_pending' && reservation.createdAt < holdCutoff) {
                return false;
            }
            const existingStartMinutes = Number(reservation.startTime.slice(0, 2)) * 60 + Number(reservation.startTime.slice(3, 5));
            const existingEndMinutes = existingStartMinutes + Number(reservation.duration) * 60;
            return requestedStartMinutes < existingEndMinutes && existingStartMinutes < requestedEndMinutes;
        });

        if (collisionExists) {
            return res.status(400).json({
                error: 'La sala ya tiene una reserva que se traslapa con ese horario.'
            });
        }

        if (!Array.isArray(rentedGear) || rentedGear.some((item) => !rentalGear.some((gear) => gear.id === item.id))) {
            return res.status(400).json({ error: 'El equipo de renta solicitado no es válido.' });
        }
        const selectedGear = [...new Map(rentedGear.map((item) => [item.id, rentalGear.find((gear) => gear.id === item.id)])).values()];
        const normalizedTotal = (room.price + selectedGear.reduce((sum, item) => sum + item.price, 0)) * normalizedDuration;

        const newReservation = new Reservation({
            bandId,
            roomId: resolvedRoomId,
            roomName: room.name,
            date,
            startTime,
            duration: normalizedDuration,
            attendees: normalizedAttendees,
            rentedGear: selectedGear,
            engineerId: band.requiresEngineer ? band.engineerId : null,
            totalPrice: normalizedTotal,
            depositAmount: Math.ceil(normalizedTotal / 2),
            balanceAmount: normalizedTotal - Math.ceil(normalizedTotal / 2),
            balanceDueAt
        });

        await newReservation.save();
        const expiresAt = new Date(Date.now() + 35 * 60 * 1000);
        const slots = [];
        for (let slotStart = requestedStartMinutes; slotStart < requestedEndMinutes; slotStart += 15) {
            slots.push({
                roomId: resolvedRoomId,
                date,
                slotStart,
                ...(band.requiresEngineer ? { engineerId: band.engineerId } : {}),
                reservationId: newReservation._id,
                expiresAt
            });
        }
        try {
            await ReservationSlot.insertMany(slots, { ordered: true });
        } catch (error) {
            await ReservationSlot.deleteMany({ reservationId: newReservation._id });
            newReservation.paymentStatus = 'expired';
            await newReservation.save();
            if (error.code === 11000) {
                return res.status(409).json({ error: 'La sala o el ingeniero ya tiene una sesión en ese horario. Elige otro bloque.' });
            }
            throw error;
        }
        return res.status(201).json({ message: 'Reserva creada. El anticipo del 50% debe confirmarse para bloquear la sala.', reservation: newReservation });
    } catch (error) {
        return res.status(500).json({ error: 'Error interno en el servidor al consolidar la inmovilización de la sala.' });
    }
};

exports.createDemoReservation = async (req, res) => {
    if (process.env.NODE_ENV === 'production') return res.sendStatus(404);
    try {
        const roomId = req.body?.roomId || 'sala_estudio_a';
        const room = rooms.find((item) => item.id === roomId && item.customizable);
        if (!room) return res.status(400).json({ error: 'La sala seleccionada no cuenta con personalización 3D.' });
        const band = await Band.findById(req.bandId).select('instruments members');
        if (!band) return res.status(404).json({ error: 'No se encontró la banda.' });
        if (!band.instruments.length) return res.status(400).json({ error: 'Registra al menos un instrumento para probar la sala 3D.' });

        const existingDemo = await Reservation.findOne({
            bandId: req.bandId,
            roomId: room.id,
            isDemo: true,
            paymentStatus: 'deposit_paid'
        }).sort({ createdAt: -1 });
        if (existingDemo) return res.status(200).json({ reservation: existingDemo });

        const sessionDate = new Date();
        sessionDate.setDate(sessionDate.getDate() + 7);
        const date = sessionDate.toISOString().slice(0, 10);
        const startTime = '12:00';
        const sessionStart = new Date(`${date}T${startTime}:00-06:00`);
        const reservation = await Reservation.create({
            bandId: req.bandId,
            roomId: room.id,
            roomName: room.name,
            date,
            startTime,
            duration: 1,
            attendees: Math.min(band.members.length + 1, room.capacity),
            rentedGear: [],
            engineerId: null,
            totalPrice: 0,
            depositAmount: 0,
            balanceAmount: 0,
            balanceDueAt: new Date(sessionStart.getTime() - 24 * 60 * 60 * 1000),
            paymentStatus: 'deposit_paid',
            isDemo: true
        });
        return res.status(201).json({ reservation });
    } catch {
        return res.status(500).json({ error: 'No se pudo preparar la sala de demostración.' });
    }
};

exports.getAllReservations = async (req, res) => {
    try {
        const reservations = await Reservation.find({ isDemo: { $ne: true } })
            .populate('bandId', 'name leaderName')
            .sort({ date: 1, startTime: 1 });
        return res.status(200).json(reservations);
    } catch {
        return res.status(500).json({ error: 'No se pudo consultar la agenda de reservas.' });
    }
};

exports.updateRoomLayout = async (req, res) => {
    try {
        const reservation = await Reservation.findById(req.params.reservationId);
        if (!reservation) return res.status(404).json({ error: 'No se encontró la reserva.' });
        if (String(reservation.bandId) !== req.bandId) return res.status(403).json({ error: 'No tienes acceso a esta reserva.' });
        if (!['deposit_paid', 'paid'].includes(reservation.paymentStatus)) {
            return res.status(409).json({ error: 'La personalización se habilita después de confirmar el anticipo.' });
        }

        const { roomLayout } = req.body;
        if (!Array.isArray(roomLayout) || roomLayout.length > 12 || roomLayout.some((item) =>
            typeof item.instrumentId !== 'string' || typeof item.name !== 'string' ||
            !Number.isFinite(item.x) || !Number.isFinite(item.z) ||
            item.x < -7 || item.x > 7 || item.z < -5 || item.z > 5
        )) {
            return res.status(400).json({ error: 'La distribución de instrumentos no es válida.' });
        }

        const band = await Band.findById(reservation.bandId).select('instruments');
        const instrumentIds = new Set(band.instruments.map((instrument) => instrument._id.toString()));
        if (roomLayout.some((item) => !instrumentIds.has(item.instrumentId))) {
            return res.status(400).json({ error: 'La distribución incluye instrumentos que no pertenecen a la banda.' });
        }
        reservation.roomLayout = roomLayout;
        await reservation.save();
        return res.status(200).json({ roomLayout: reservation.roomLayout });
    } catch {
        return res.status(400).json({ error: 'No se pudo guardar la distribución de la sala.' });
    }
};

exports.getBandReservations = async (req, res) => {
    try {
        if (req.params.bandId !== req.bandId) return res.status(403).json({ error: 'No tienes acceso a estas reservas.' });
        const reservations = await Reservation.find({ bandId: req.bandId }).sort({ date: -1, startTime: -1 });
        return res.status(200).json(reservations);
    } catch {
        return res.status(500).json({ error: 'No se pudo consultar el historial de la banda.' });
    }
};

exports.getReservation = async (req, res) => {
    try {
        const reservation = await Reservation.findById(req.params.reservationId);
        if (!reservation) return res.status(404).json({ error: 'No se encontró la reserva.' });
        if (String(reservation.bandId) !== req.bandId) return res.status(403).json({ error: 'No tienes acceso a esta reserva.' });
        return res.status(200).json(reservation);
    } catch {
        return res.status(400).json({ error: 'El identificador de reserva no es válido.' });
    }
};

exports.getRoomsReservations = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { date } = req.query;
        if (date) {
            await Reservation.updateMany(
                { roomId, date, isDemo: { $ne: true }, paymentStatus: 'deposit_pending', createdAt: { $lt: new Date(Date.now() - 35 * 60 * 1000) } },
                { $set: { paymentStatus: 'expired' } }
            );
        }
        const reservations = await Reservation.find({
            roomId,
            ...(date ? { date } : {}),
            isDemo: { $ne: true },
            paymentStatus: { $nin: ['expired', 'refunded'] }
        }).select('date startTime duration paymentStatus createdAt');
        return res.status(200).json(reservations);
    } catch (error) {
        return res.status(500).json({ error: 'Error al consultar la parrilla de ocupación.' })
    }
}