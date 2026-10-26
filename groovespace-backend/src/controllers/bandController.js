const Band = require('../models/Band');
const Reservation = require('../models/Reservation');
const ReservationSlot = require('../models/ReservationSlot');
const mongoose = require('mongoose');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { createBandToken } = require('../middlewares/bandAuth');
const paymentController = require('./paymentController');
const { engineers } = require('../config/engineers');
const { ensureDefaultBandEmailDomains } = require('../config/bandEmailDomains');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Exportación directa en la línea de creación para el registro de la banda
exports.registerBand = async (req, res) => {
  try {
    const { name, leaderName, email, password, requiresEngineer, engineerId } = req.body;

    if (!process.env.BAND_TOKEN_SECRET) {
      return res.status(503).json({ error: 'La autenticación de bandas no está configurada en el servidor.' });
    }

    if (!name || !leaderName || typeof email !== 'string' || !email || typeof password !== 'string' || !password) {
      return res.status(400).json({ error: 'Banda, líder, correo y contraseña son obligatorios.' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const emailParts = normalizedEmail.split('@');
    if (emailParts.length !== 2 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(emailParts[0]) ||
      !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(emailParts[1]) || password.length < 10) {
      return res.status(400).json({ error: 'Usa un correo válido y una contraseña de al menos 10 caracteres.' });
    }
    const allowedEmailDomains = await ensureDefaultBandEmailDomains();
    if (!allowedEmailDomains.some(({ domain }) => domain === emailParts[1])) {
      return res.status(400).json({ error: 'El dominio de correo seleccionado no está permitido para el registro.' });
    }

    const logoFile = req.files?.logo?.[0];
    if (!logoFile) {
      return res.status(400).json({ error: 'Es obligatorio cargar la identidad visual (Logo) de la agrupación.' });
    }

    let instrumentNames;
    try {
      instrumentNames = JSON.parse(req.body.instruments || '[]');
    } catch {
      return res.status(400).json({ error: 'La lista de instrumentos no tiene un formato válido.' });
    }
    const instrumentFiles = req.files?.instrumentPhotos || [];
    if (!Array.isArray(instrumentNames) || instrumentNames.length === 0 ||
      instrumentNames.length !== instrumentFiles.length ||
      instrumentNames.some((instrument) => !instrument.name?.trim())) {
      return res.status(400).json({ error: 'Cada instrumento debe tener nombre y fotografía.' });
    }

    const needsEngineer = requiresEngineer === 'true';
    if (needsEngineer && !engineers.some((engineer) => engineer.id === engineerId)) {
      return res.status(400).json({ error: 'Selecciona uno de los ingenieros disponibles.' });
    }

    const bandExists = await Band.findOne({ $or: [{ name: name.trim() }, { email: normalizedEmail }] });
    if (bandExists) {
      return res.status(400).json({ error: 'Esta agrupación ya se encuentra registrada en el sistema.' });
    }

    const logoPath = `/uploads/${logoFile.filename}`;
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const passwordSalt = crypto.randomBytes(16).toString('hex');
    const passwordHash = crypto.scryptSync(password, passwordSalt, 64).toString('hex');

    const newBand = new Band({
      name: name.trim(),
      leaderName: leaderName.trim(),
      email: normalizedEmail,
      passwordHash,
      passwordSalt,
      logoPath,
      requiresEngineer: needsEngineer,
      engineerId: needsEngineer ? engineerId : null,
      instruments: instrumentNames.map((instrument, index) => ({
        name: instrument.name.trim(),
        photoPath: `/uploads/${instrumentFiles[index].filename}`
      })),
      inviteTokenHash: hashToken(inviteToken),
      inviteExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    await newBand.save();
    const bandResponse = newBand.toObject();
    delete bandResponse.passwordHash;
    delete bandResponse.passwordSalt;
    delete bandResponse.inviteTokenHash;
    delete bandResponse.inviteExpiresAt;
    return res.status(201).json({ message: 'Banda registrada de forma exitosa.', band: bandResponse, inviteToken, accessToken: createBandToken(newBand.id) });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno en el servidor al registrar la agrupación.' });
  }
};

exports.loginBand = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!process.env.BAND_TOKEN_SECRET) return res.status(503).json({ error: 'La autenticación de bandas no está configurada.' });
    const band = await Band.findOne({ email: String(email || '').trim().toLowerCase() }).select('+passwordHash +passwordSalt');
    if (!band || typeof password !== 'string') return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    const attempt = crypto.scryptSync(password, band.passwordSalt, 64);
    const stored = Buffer.from(band.passwordHash, 'hex');
    if (attempt.length !== stored.length || !crypto.timingSafeEqual(attempt, stored)) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }
    return res.status(200).json({
      band: { _id: band.id, name: band.name, bandName: band.name, leaderName: band.leaderName, logoPath: band.logoPath },
      accessToken: createBandToken(band.id)
    });
  } catch {
    return res.status(500).json({ error: 'No se pudo iniciar sesión.' });
  }
};

exports.getEngineers = (req, res) => res.status(200).json(engineers.map(({ id, name, specialty }) => ({ id, name, specialty })));

exports.getBandEmailDomains = async (req, res) => {
  try {
    const domains = await ensureDefaultBandEmailDomains();
    return res.status(200).json(domains.map(({ domain }) => domain));
  } catch (error) {
    console.error('[GrooveSpace] No se pudieron consultar los dominios de correo.', error.message);
    return res.status(500).json({ error: 'No se pudieron cargar los dominios de correo.' });
  }
};

exports.getBandProfile = async (req, res) => {
  try {
    if (req.params.bandId !== req.bandId) return res.status(403).json({ error: 'No tienes acceso a este perfil.' });
    const band = await Band.findById(req.params.bandId).select('-inviteTokenHash -inviteExpiresAt');
    if (!band) return res.status(404).json({ error: 'No se encontró la banda.' });
    return res.status(200).json({ ...band.toObject(), engineer: engineers.find((item) => item.id === band.engineerId) || null });
  } catch {
    return res.status(400).json({ error: 'El identificador de banda no es válido.' });
  }
};

exports.updateBandProfile = async (req, res) => {
  try {
    if (req.params.bandId !== req.bandId) return res.status(403).json({ error: 'No tienes acceso a este perfil.' });
    const { name, leaderName, requiresEngineer, engineerId } = req.body;
    const updates = {};
    if (typeof name === 'string' && name.trim()) updates.name = name.trim();
    if (typeof leaderName === 'string' && leaderName.trim()) updates.leaderName = leaderName.trim();
    if (requiresEngineer !== undefined) {
      const needsEngineer = requiresEngineer === true || requiresEngineer === 'true';
      if (needsEngineer && !engineers.some((engineer) => engineer.id === engineerId)) {
        return res.status(400).json({ error: 'Selecciona uno de los ingenieros disponibles.' });
      }
      updates.requiresEngineer = needsEngineer;
      updates.engineerId = needsEngineer ? engineerId : null;
    }
    const band = await Band.findByIdAndUpdate(req.bandId, { $set: updates }, { new: true, runValidators: true })
      .select('-inviteTokenHash -inviteExpiresAt');
    if (!band) return res.status(404).json({ error: 'No se encontró la banda.' });
    return res.status(200).json(band);
  } catch {
    return res.status(400).json({ error: 'No se pudo actualizar el perfil. El nombre podría estar en uso.' });
  }
};

exports.addBandInstruments = async (req, res) => {
  try {
    if (req.params.bandId !== req.bandId) return res.status(403).json({ error: 'No tienes acceso a este perfil.' });
    let instruments;
    try { instruments = JSON.parse(req.body.instruments || '[]'); }
    catch { return res.status(400).json({ error: 'La lista de instrumentos no es válida.' }); }
    const files = req.files?.instrumentPhotos || [];
    if (!Array.isArray(instruments) || instruments.length === 0 || instruments.length !== files.length ||
      instruments.some((instrument) => !instrument.name?.trim())) {
      return res.status(400).json({ error: 'Cada instrumento debe incluir nombre y fotografía.' });
    }
    const additions = instruments.map((instrument, index) => ({
      name: instrument.name.trim(),
      photoPath: `/uploads/${files[index].filename}`
    }));
    const currentBand = await Band.findById(req.bandId).select('instruments');
    if (!currentBand || currentBand.instruments.length + additions.length > 12) {
      return res.status(400).json({ error: 'La banda puede registrar hasta 12 instrumentos.' });
    }
    const band = await Band.findByIdAndUpdate(req.bandId, { $push: { instruments: { $each: additions } } }, { new: true });
    return res.status(200).json({ instruments: band.instruments });
  } catch {
    return res.status(500).json({ error: 'No se pudieron agregar los instrumentos.' });
  }
};

exports.removeBandMember = async (req, res) => {
  try {
    if (req.params.bandId !== req.bandId) return res.status(403).json({ error: 'No tienes acceso a este perfil.' });
    const band = await Band.findById(req.bandId);
    const member = band?.members.id(req.params.memberId);
    if (!member) return res.status(404).json({ error: 'No se encontró al integrante.' });
    member.deleteOne();
    await band.save();
    return res.status(200).json({ members: band.members });
  } catch {
    return res.status(400).json({ error: 'No se pudo quitar al integrante.' });
  }
};

exports.getInvite = async (req, res) => {
  try {
    const band = await Band.findOne({
      inviteTokenHash: hashToken(req.params.token),
      inviteExpiresAt: { $gt: new Date() }
    }).select('name');
    if (!band) return res.status(404).json({ error: 'La invitación no existe o ya expiró.' });
    return res.status(200).json({ bandName: band.name });
  } catch {
    return res.status(400).json({ error: 'La invitación no es válida.' });
  }
};

exports.createInvite = async (req, res) => {
  try {
    const band = await Band.findById(req.bandId);
    if (!band) return res.status(404).json({ error: 'No se encontró la banda.' });
    const inviteToken = crypto.randomBytes(32).toString('hex');
    band.inviteTokenHash = hashToken(inviteToken);
    band.inviteExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await band.save();
    return res.status(201).json({ inviteToken });
  } catch {
    return res.status(500).json({ error: 'No se pudo crear la invitación.' });
  }
};

exports.joinBand = async (req, res) => {
  try {
    const { name, instrument } = req.body;
    if (!name?.trim() || !instrument?.trim()) {
      return res.status(400).json({ error: 'Nombre e instrumento son obligatorios.' });
    }
    const band = await Band.findOne({
      inviteTokenHash: hashToken(req.params.token),
      inviteExpiresAt: { $gt: new Date() }
    });
    if (!band) return res.status(404).json({ error: 'La invitación no existe o ya expiró.' });
    if (band.members.some((member) => member.name.toLowerCase() === name.trim().toLowerCase())) {
      return res.status(409).json({ error: 'Ese integrante ya forma parte de la banda.' });
    }
    if (band.members.length >= 100) {
      return res.status(409).json({ error: 'La banda ya alcanzó el máximo de 100 integrantes.' });
    }
    const updatedBand = await Band.findOneAndUpdate(
      { _id: band._id, 'members.99': { $exists: false } },
      { $push: { members: { name: name.trim(), instrument: instrument.trim() } } },
      { new: true, runValidators: true }
    );
    if (!updatedBand) {
      return res.status(409).json({ error: 'La banda ya alcanzó el máximo de 100 integrantes.' });
    }
    return res.status(201).json({ message: 'Te uniste a la banda.', bandName: band.name });
  } catch {
    return res.status(500).json({ error: 'No se pudo agregar al integrante.' });
  }
};

exports.getAllBands = async (req, res) => {
  try {
    // Agregar cabeceras de salida explícitas de tipo JSON para destrabar el fetch de React
    res.setHeader('Content-Type', 'application/json');
    
    const bands = await Band.find({}).sort({ createdAt: -1 });
    return res.status(200).json(bands);
  } catch (error) {
    return res.status(500).json({ error: 'Error al consultar la bitácora operativa de agrupaciones.' });
  }
};

exports.deleteBand = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.bandId)) {
    return res.status(400).json({ error: 'El identificador de banda no es válido.' });
  }

  let session;
  let deletedBand;
  let deletedReservations = 0;
  let deletedSlots = 0;
  let transactionUnavailable = false;
  try {
    const currentBand = await Band.findById(req.params.bandId).select('_id');
    if (!currentBand) return res.status(404).json({ error: 'No se encontró la banda.' });
    const reservationsWithCheckout = await Reservation.find({ bandId: currentBand._id })
      .select('stripeDepositSessionId stripeBalanceSessionId');
    await paymentController.expireOpenCheckoutSessions(reservationsWithCheckout);

    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      const band = await Band.findById(req.params.bandId).session(session);
      if (!band) return;
      deletedBand = { logoPath: band.logoPath, instrumentPaths: band.instruments.map(({ photoPath }) => photoPath) };
      const reservations = await Reservation.find({ bandId: band._id }).select('_id').session(session);
      const reservationIds = reservations.map(({ _id }) => _id);
      const slotResult = await ReservationSlot.deleteMany({ reservationId: { $in: reservationIds } }, { session });
      const reservationResult = await Reservation.deleteMany({ bandId: band._id }, { session });
      await Band.deleteOne({ _id: band._id }, { session });
      deletedSlots = slotResult.deletedCount;
      deletedReservations = reservationResult.deletedCount;
    });
  } catch (error) {
    if (error.status === 409) return res.status(409).json({ error: error.message });
    if (error.status) {
      console.error('[GrooveSpace] No se pudo cerrar una sesión de pago antes del borrado.', error.message);
      return res.status(error.status).json({ error: 'No se pudo confirmar el estado de las sesiones de pago; la banda no fue eliminada.' });
    }
    console.error('[GrooveSpace] No se pudo completar el borrado transaccional de la banda.', error.message);
    transactionUnavailable = error.code === 20 || /transaction numbers are only allowed|replica set|replicaset/i.test(error.message);
    if (!transactionUnavailable) {
      return res.status(500).json({ error: 'No se pudo eliminar la banda y sus reservas.' });
    }
  } finally {
    if (session) await session.endSession();
  }

  if (transactionUnavailable) {
    try {
      const band = await Band.findById(req.params.bandId);
      if (!band) return res.status(404).json({ error: 'No se encontró la banda.' });
      deletedBand = { logoPath: band.logoPath, instrumentPaths: band.instruments.map(({ photoPath }) => photoPath) };
      const reservations = await Reservation.find({ bandId: band._id }).select('_id');
      const reservationIds = reservations.map(({ _id }) => _id);
      const slotResult = await ReservationSlot.deleteMany({ reservationId: { $in: reservationIds } });
      const reservationResult = await Reservation.deleteMany({ bandId: band._id });
      await Band.deleteOne({ _id: band._id });
      deletedSlots = slotResult.deletedCount;
      deletedReservations = reservationResult.deletedCount;
    } catch (error) {
      console.error('[GrooveSpace] Falló el borrado secuencial de la banda.', error.message);
      return res.status(500).json({
        error: 'No se pudo completar el borrado de la banda. Verifica el estado de sus reservas y vuelve a intentarlo.'
      });
    }
  }

  if (!deletedBand) return res.status(404).json({ error: 'No se encontró la banda.' });

  let deletedFiles = 0;
  const fileFailures = [];
  const uploadDirectory = path.resolve(__dirname, '..', 'uploads');
  for (const uploadPath of [deletedBand.logoPath, ...deletedBand.instrumentPaths]) {
    if (typeof uploadPath !== 'string' || !uploadPath.startsWith('/uploads/')) continue;
    const filePath = path.join(uploadDirectory, path.basename(uploadPath));
    try {
      await fs.unlink(filePath);
      deletedFiles += 1;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('[GrooveSpace] No se pudo eliminar un archivo de banda.', error.message);
        fileFailures.push(path.basename(uploadPath));
      }
    }
  }
  return res.status(200).json({
    message: 'La banda, sus reservas y los horarios asociados fueron eliminados.',
    deleted: { reservations: deletedReservations, slots: deletedSlots, files: deletedFiles },
    ...(fileFailures.length ? { warning: 'Algunos archivos no pudieron eliminarse.', fileFailures } : {})
  });
};
