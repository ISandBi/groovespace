const crypto = require('crypto');
const EventEmitter = require('events');
const QaEvent = require('./models/QaEvent');
const { constantTimeEquals } = require('./middlewares/staffAuth');

const events = new EventEmitter();
events.setMaxListeners(100);
const suspiciousWindows = new Map();
const trafficWindows = new Map();
const getHashSecret = () => process.env.QA_HASH_SECRET || process.env.STAFF_TOKEN_SECRET || process.env.QA_INGEST_TOKEN || 'qa-monitoring-disabled';

const hashValue = (value) => value
  ? crypto.createHmac('sha256', getHashSecret()).update(String(value)).digest('hex')
  : '';

const isEnabled = () => process.env.QA_MONITORING_ENABLED === 'true' &&
  process.env.NODE_ENV !== 'production' &&
  typeof process.env.QA_INGEST_TOKEN === 'string' &&
  process.env.QA_INGEST_TOKEN.length >= 32;

const recordEvent = async (event) => {
  if (!isEnabled()) return null;
  try {
    const savedEvent = await QaEvent.create(event);
    const payload = savedEvent.toObject();
    events.emit('event', payload);
    return payload;
  } catch (error) {
    console.error('[GrooveSpace SIEM] No se pudo persistir un evento de QA.', error.message);
    return null;
  }
};

const getSafeRoute = (req) => {
  if (req.route?.path) return `${req.baseUrl}${req.route.path}`.replace(/^\/api(?=\/)/, '').slice(0, 180);
  const path = req.path.replace(/\/(?:[a-f\d]{24}|[a-f\d-]{36}|[a-f\d]{40,})/gi, '/:id');
  return path.replace(/\/invite\/[^/]+/i, '/invite/:token').slice(0, 180);
};

const getActivityLabel = (method, route) => {
  if (route === '/bands/login' || route === '/staff/login' || route === '/engineers/login') return 'inicio de sesión';
  if (route === '/bands/register') return 'registro de banda';
  if (route === '/bands/all') return 'consulta del directorio de bandas';
  if (/^\/bands\/[^/]+\/profile$/.test(route)) return method === 'PATCH' ? 'actualización del perfil de banda' : 'consulta del perfil de banda';
  if (/^\/bands\/[^/]+\/instruments$/.test(route)) return 'alta de instrumentos de banda';
  if (/^\/bands\/[^/]+$/.test(route) && method === 'DELETE') return 'eliminación de banda';
  if (route === '/reservations/book') return 'creación de reserva';
  if (route === '/reservations/demo') return 'creación de reserva de demostración';
  if (route === '/reservations/all') return 'consulta de reservas administrativas';
  if (/^\/reservations\/[^/]+\/layout$/.test(route)) return 'guardado de distribución 3D';
  if (route === '/payments/checkout') return 'inicio de Checkout de pago';
  if (/^\/payments\/verify\//.test(route)) return 'verificación de pago';
  if (route === '/engineers/me/schedule') return 'consulta de agenda de ingeniería';
  if (/\/invite/.test(route)) return 'gestión de invitación de banda';
  if (route.startsWith('/bands/')) return 'gestión de perfil o integrantes de banda';
  if (route.startsWith('/reservations/')) return 'consulta o gestión de reserva';
  if (route.startsWith('/payments/')) return 'operación de pago';
  return 'solicitud a la API';
};

const describeActivity = ({ method, route, statusCode, durationMs, summary, severity }) => {
  const result = statusCode >= 500 ? 'falló por error del servidor'
    : statusCode === 429 ? 'fue limitada por exceso de intentos'
      : statusCode >= 400 ? `fue rechazada con HTTP ${statusCode}`
        : 'se completó correctamente';
  const event = summary ? ` Evento: ${summary.replaceAll('_', ' ')}.` : '';
  const warning = severity === 'high' ? ' Severidad alta; revisar actividad QA.' : '';
  return `QA ejecutó ${getActivityLabel(method, route)}: ${method} ${route} ${result} (HTTP ${statusCode}, ${durationMs} ms).${event}${warning}`.slice(0, 300);
};

const auditApiRequest = (req, res, next) => {
  const suppliedQaToken = req.headers['x-qa-token'];
  if (!isEnabled() || req.path.startsWith('/qa/events') ||
    typeof suppliedQaToken !== 'string' ||
    !constantTimeEquals(suppliedQaToken, process.env.QA_INGEST_TOKEN)) return next();
  const requestedSessionId = req.headers['x-qa-session-id'];
  const qaSessionId = typeof requestedSessionId === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(requestedSessionId)
    ? requestedSessionId
    : '';
  const startedAt = Date.now();
  res.once('finish', () => {
    const statusCode = res.statusCode;
    const route = getSafeRoute(req);
    const isLogin = /\/login$/i.test(req.path);
    const isRegistration = /\/register$/i.test(req.path);
    const isBandDelete = req.method === 'DELETE' && /^\/bands\/[^/]+$/i.test(req.path);
    const suspiciousPath = /(?:\.\.|%2e|%2f|%5c|<script)/i.test(req.originalUrl);
    const eventType = suspiciousPath ? 'suspicious_request'
      : isLogin ? 'login_attempt'
        : isRegistration ? 'band_registration_attempt' : 'api_request';
    const severity = suspiciousPath || statusCode === 429 || statusCode >= 500 ? 'high'
      : statusCode >= 400 ? 'warning' : 'info';
    const actorId = req.bandId || req.staff?.username || req.engineerId || '';
    const summary = suspiciousPath ? 'suspicious_path_pattern_detected'
      : statusCode === 429 ? 'rate_limit_triggered'
        : isLogin ? statusCode < 400 ? 'login_succeeded' : 'login_failed'
          : isRegistration ? statusCode < 400 ? 'band_registration_succeeded' : 'band_registration_failed'
            : isBandDelete ? statusCode < 400 ? 'band_deletion_succeeded' : 'band_deletion_failed'
              : statusCode >= 500 ? 'server_error'
                : statusCode >= 400 ? 'request_rejected' : 'request_completed';
    const durationMs = Date.now() - startedAt;
    const actorRole = req.staff ? 'staff' : req.bandId ? 'band' : req.engineerId ? 'engineer' : 'qa';
    const description = describeActivity({ method: req.method, route, statusCode, durationMs, summary, severity });

    void recordEvent({
      eventType,
      severity,
      summary,
      description,
      actorRole,
      actorHash: hashValue(actorId),
      ipHash: hashValue(req.ip),
      qaSessionId,
      method: req.method,
      route,
      statusCode,
      durationMs
    });

    const ipHash = hashValue(req.ip);
    const now = Date.now();
    const trafficKey = `${ipHash}:${qaSessionId || 'qa-session-unknown'}`;
    let trafficWindow = trafficWindows.get(trafficKey);
    if (trafficWindow?.expiresAt <= now) {
      trafficWindows.delete(trafficKey);
      trafficWindow = undefined;
    }
    if (!trafficWindow) {
      if (trafficWindows.size >= 2000) {
        for (const [key, entry] of trafficWindows) {
          if (entry.expiresAt <= now) trafficWindows.delete(key);
        }
      }
      if (trafficWindows.size < 2000) {
        trafficWindow = { count: 0, expiresAt: now + 60 * 1000, alerted: false };
        trafficWindows.set(trafficKey, trafficWindow);
      }
    }
    if (trafficWindow) {
      trafficWindow.count += 1;
      if (trafficWindow.count >= 180 && !trafficWindow.alerted) {
        trafficWindow.alerted = true;
        void recordEvent({
          eventType: 'suspicious_request',
          severity: 'high',
          summary: 'high_api_volume_possible_scraping',
          description: `La sesión QA generó ${trafficWindow.count} solicitudes en menos de un minuto desde una IP pseudonimizada. Posible automatización o extracción; valida el caso de prueba.`,
          actorRole,
          actorHash: hashValue(actorId),
          ipHash,
          qaSessionId,
          method: req.method,
          route: '/api/*',
          statusCode,
          durationMs
        });
      }
    }

    const probe = suspiciousPath || statusCode === 401 || statusCode === 403 || statusCode === 404;
    if (probe) {
      const key = ipHash;
      let window = suspiciousWindows.get(key);
      if (window?.expiresAt <= now) {
        suspiciousWindows.delete(key);
        window = undefined;
      }
      if (!window) {
        if (suspiciousWindows.size >= 2000) {
          for (const [address, entry] of suspiciousWindows) {
            if (entry.expiresAt <= now) suspiciousWindows.delete(address);
          }
        }
        if (suspiciousWindows.size >= 2000) return;
        window = { count: 0, expiresAt: now + 5 * 60 * 1000, alerted: false };
        suspiciousWindows.set(key, window);
      }
      window.count += 1;
      if (window.count >= 8 && !window.alerted) {
        window.alerted = true;
        void recordEvent({
          eventType: 'suspicious_request',
          severity: 'high',
          summary: 'repeated_auth_or_route_probes',
          description: `La sesión QA acumuló ${window.count} respuestas 401/403/404 o patrones de ruta sospechosos en menos de cinco minutos; revisar los endpoints probados.`,
          actorRole,
          actorHash: hashValue(actorId),
          ipHash: key,
          qaSessionId,
          method: req.method,
          route: '/api/*',
          statusCode,
          durationMs: Date.now() - startedAt
        });
      }
    }
  });
  return next();
};

module.exports = { auditApiRequest, events, hashValue, isEnabled, recordEvent };
