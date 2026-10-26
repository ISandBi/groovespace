const QaEvent = require('../models/QaEvent');
const { events, hashValue, recordEvent } = require('../siem');

const publicFields = '_id eventType severity summary description actorRole ipHash qaSessionId method route statusCode durationMs createdAt';

exports.listEvents = async (req, res) => {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
    const query = {};
    if (req.query.after) {
      const after = new Date(req.query.after);
      if (Number.isNaN(after.getTime())) return res.status(400).json({ error: 'El parámetro after debe ser una fecha ISO válida.' });
      query.createdAt = { $gt: after };
    }
    const results = await QaEvent.find(query).select(publicFields).sort({ createdAt: -1 }).limit(limit).lean();
    return res.status(200).json(results);
  } catch (error) {
    console.error('[GrooveSpace SIEM] No se pudieron consultar los eventos QA.', error.message);
    return res.status(500).json({ error: 'No se pudieron consultar los eventos QA.' });
  }
};

exports.streamEvents = async (req, res) => {
  let connected = true;
  let initializing = true;
  const bufferedEvents = [];
  const sentEventIds = new Set();
  const sendEvent = (event) => {
    if (!connected || res.writableEnded) return;
    const eventId = String(event._id);
    if (sentEventIds.has(eventId)) return;
    sentEventIds.add(eventId);
    const { _id, eventType, severity, summary, description, actorRole, ipHash, qaSessionId, method, route, statusCode, durationMs, createdAt } = event;
    res.write(`id: ${_id}\ndata: ${JSON.stringify({ _id, eventType, severity, summary, description, actorRole, ipHash, qaSessionId, method, route, statusCode, durationMs, createdAt })}\n\n`);
  };
  const onEvent = (event) => {
    if (initializing) bufferedEvents.push(event);
    else sendEvent(event);
  };
  events.on('event', onEvent);
  const heartbeat = setInterval(() => {
    if (connected && !res.writableEnded) res.write(': keep-alive\n\n');
  }, 25000);
  res.on('close', () => {
    connected = false;
    clearInterval(heartbeat);
    events.off('event', onEvent);
  });

  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();
  try {
    const recentEvents = await QaEvent.find({}).select(publicFields).sort({ createdAt: -1 }).limit(25).lean();
    for (const event of recentEvents.reverse()) sendEvent(event);
    initializing = false;
    for (const event of bufferedEvents) sendEvent(event);
  } catch (error) {
    initializing = false;
    console.error('[GrooveSpace SIEM] No se pudo inicializar el flujo en tiempo real.', error.message);
    if (!res.writableEnded) res.write('event: error\ndata: {"error":"No se pudo cargar el historial QA."}\n\n');
  }
};

exports.ingestUiEvent = async (req, res) => {
  const { eventType, route, qaSessionId } = req.body || {};
  if (!['ui_copy', 'ui_navigation'].includes(eventType)) {
    return res.status(400).json({ error: 'El evento de interfaz no está permitido.' });
  }
  const safeRoute = typeof route === 'string' && route.startsWith('/') && !route.includes('?')
    ? route.replace(/\/(?:[a-f\d]{24}|[a-f\d-]{36})/gi, '/:id').slice(0, 180)
    : '/';
  const safeSessionId = typeof qaSessionId === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(qaSessionId)
    ? qaSessionId
    : '';
  const saved = await recordEvent({
    eventType,
    severity: eventType === 'ui_copy' ? 'warning' : 'info',
    summary: eventType === 'ui_copy' ? 'ui_copy_action_content_not_collected' : 'qa_page_opened',
    description: eventType === 'ui_copy'
      ? `El evaluador QA copió contenido visible en ${safeRoute}; el texto del portapapeles no fue leído ni guardado.`
      : `El evaluador QA abrió la ruta ${safeRoute}.`,
    actorRole: 'qa',
    actorHash: hashValue(safeSessionId),
    ipHash: hashValue(req.ip),
    qaSessionId: safeSessionId,
    method: 'UI',
    route: safeRoute
  });
  if (!saved) return res.status(503).json({ error: 'No se pudo registrar el evento. Verifica MongoDB y la configuración QA.' });
  return res.status(202).json({ accepted: true });
};
