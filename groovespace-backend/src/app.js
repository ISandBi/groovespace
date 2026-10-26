const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const crypto = require('crypto');
const connectDB = require('./config/db');
const bandRoutes = require('./routes/bandRoutes');
const reservationRoutes = require('./routes/reservationRoutes'); // <-- NUEVA IMPORTACIÓN
const paymentController = require('./controllers/paymentController');
const staffRoutes = require('./routes/staffRoutes');
const engineerRoutes = require('./routes/engineerRoutes');
const qaRoutes = require('./routes/qaRoutes');
const { auditApiRequest } = require('./siem');

dotenv.config();

if (process.env.NODE_ENV !== 'production' && !process.env.BAND_TOKEN_SECRET) {
  process.env.BAND_TOKEN_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('[GrooveSpace] Usando una clave de sesión temporal para desarrollo.');
}
if (process.env.NODE_ENV !== 'production' && !process.env.STAFF_TOKEN_SECRET) {
  process.env.STAFF_TOKEN_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('[GrooveSpace] Usando una clave de staff temporal para desarrollo.');
}
if (process.env.NODE_ENV !== 'production' && !process.env.ENGINEER_TOKEN_SECRET) {
  process.env.ENGINEER_TOKEN_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('[GrooveSpace] Usando una clave de sesión temporal para ingeniería.');
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
const allowedOrigins = new Set([frontendOrigin]);
if (process.env.NODE_ENV !== 'production') {
  const configuredFrontend = new URL(frontendOrigin);
  const localAlias = configuredFrontend.hostname === 'localhost' ? '127.0.0.1'
    : configuredFrontend.hostname === '127.0.0.1' ? 'localhost' : null;
  if (localAlias) {
    configuredFrontend.hostname = localAlias;
    allowedOrigins.add(configuredFrontend.origin);
  }
}

app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-QA-Token', 'X-QA-Session-Id'],
  maxAge: 600
}));

app.use('/api', auditApiRequest);
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), paymentController.handleWebhook);
app.use(express.json({ limit: '1mb' }));

app.use('/uploads', express.static('src/uploads'));

// Enlace de los túneles API de GrooveSpace CDMX
app.use('/api/bands', bandRoutes);
app.use('/api/reservations', reservationRoutes); // <-- INYECCIÓN DE CANALES DE RESERVA
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/staff', staffRoutes);
app.use('/api/engineers', engineerRoutes);
app.use('/api/qa', qaRoutes);

connectDB();

app.get('/api/health', (req, res) => {
  res.json({ status: 'active', message: 'Servidor de GrooveSpace operando correctamente' });
});

app.use((req, res) => {
  res.status(404).json({ error: `Ruta API no encontrada: ${req.method} ${req.originalUrl}` });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = Number.isInteger(error.status) ? error.status : 500;
  console.error('[GrooveSpace] Error HTTP no controlado.', error.message);
  if (error.name === 'MulterError') {
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'Una imagen excede el tamaño máximo permitido de 10 MB.'
      : error.code === 'LIMIT_FILE_COUNT'
        ? 'Se excedió la cantidad máxima de imágenes permitida.'
        : 'No se pudieron procesar las imágenes del formulario.';
    return res.status(400).json({ error: message });
  }
  if (status === 413) return res.status(413).json({ error: 'La solicitud excede el tamaño máximo permitido.' });
  return res.status(status >= 400 && status < 600 ? status : 500).json({
    error: status < 500 ? error.message : 'Error interno del servidor.'
  });
});

const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
app.listen(PORT, HOST, () => {
  console.log(`[GrooveSpace] Servidor encendido en el puerto: ${PORT}`);
});

module.exports = app;
