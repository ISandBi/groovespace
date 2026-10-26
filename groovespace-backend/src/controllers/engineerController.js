const crypto = require('crypto');
const Reservation = require('../models/Reservation');
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
    const today = new Date().toISOString().slice(0, 10);
    const reservations = await Reservation.find({
      engineerId: req.engineerId,
      date: { $gte: today },
      paymentStatus: { $in: ['deposit_paid', 'paid'] },
      isDemo: { $ne: true }
    }).populate('bandId', 'name leaderName').sort({ date: 1, startTime: 1 });
    return res.status(200).json(reservations);
  } catch {
    return res.status(500).json({ error: 'No se pudo cargar tu agenda de sesiones.' });
  }
};