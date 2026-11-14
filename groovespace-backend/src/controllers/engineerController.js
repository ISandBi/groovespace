const crypto = require('crypto');
const Reservation = require('../models/Reservation');
const Band = require('../models/Band');
const { HOLD_MS } = require('../config/payment');
const { engineers } = require('../config/engineers');
const { createEngineerToken } = require('../middlewares/engineerAuth');
const { constantTimeEquals } = require('../middlewares/staffAuth');

exports.login = (req, res) => {
  const { engineerId, username, password } = req.body;
  const engineer = engineers.find((profile) => profile.id === engineerId);
  if (!engineer || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(401).json({ error: 'Perfil o credenciales incorrectos.' });
  }

  const isDevelopment = process.env.NODE_ENV !== 'production';
  const expectedUsername = process.env[`ENGINEER_${engineer.key}_USERNAME`] || (isDevelopment ? `${engineer.key.toLowerCase()}_groove` : '');
  const expectedPassword = process.env[`ENGINEER_${engineer.key}_PASSWORD`] || (isDevelopment ? `${engineer.key.toLowerCase()}2026` : '');
  if (!expectedUsername || !expectedPassword || !process.env.ENGINEER_TOKEN_SECRET) {
    return res.status(503).json({ error: 'El acceso de ingeniería no está configurado en el servidor.' });
  }
  if (!constantTimeEquals(username, expectedUsername) || !constantTimeEquals(password, expectedPassword)) {
    return res.status(401).json({ error: 'Perfil o credenciales incorrectos.' });
  }
  return res.status(200).json({ token: createEngineerToken(engineer.id), engineer: { id: engineer.id, name: engineer.name, specialty: engineer.specialty } });
};

exports.getSchedule = async (req, res) => {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
    const holdCutoff = new Date(Date.now() - HOLD_MS);
    // Sesiones confirmadas y también las apartadas que aún están dentro de sus 12 horas para pagar el anticipo.
    const reservations = await Reservation.find({
      engineerId: req.engineerId,
      date: { $gte: today },
      isDemo: { $ne: true },
      $or: [
        { paymentStatus: { $in: ['deposit_paid', 'paid'] } },
        { paymentStatus: 'deposit_pending', createdAt: { $gte: holdCutoff } }
      ]
    }).populate('bandId', 'name leaderName').sort({ date: 1, startTime: 1 });
    return res.status(200).json(reservations);
  } catch {
    return res.status(500).json({ error: 'No se pudo cargar tu agenda de sesiones.' });
  }
};

exports.getAssignedBands = async (req, res) => {
  try {
    const bands = await Band.find({ requiresEngineer: true, engineerId: req.engineerId })
      .select('name leaderName members instruments createdAt').sort({ createdAt: -1 });
    return res.status(200).json(bands.map((band) => ({
      _id: band._id,
      name: band.name,
      leaderName: band.leaderName,
      membersCount: band.members?.length || 0,
      instrumentsCount: band.instruments?.length || 0,
      assignedAt: band.createdAt
    })));
  } catch {
    return res.status(500).json({ error: 'No se pudieron cargar tus bandas asignadas.' });
  }
};
