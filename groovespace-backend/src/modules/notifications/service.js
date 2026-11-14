const Notification = require('./Notification');
const { sendMail } = require('./mailer');

const frontendBase = () => (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

/**
 * Crea una notificación interna y, si se pide, la espeja por correo.
 * Nunca lanza: una notificación fallida no debe romper un pago ni una reserva.
 */
exports.notify = async ({ recipientType, recipientId, kind, title, body = '', link = '', dedupeKey, email }) => {
  try {
    const created = await Notification.create({ recipientType, recipientId: String(recipientId), kind, title, body, link, dedupeKey });
    if (email) {
      await sendMail({ to: email, subject: title, text: `${body}\n\n${link ? `${frontendBase()}${link}` : ''}`.trim() })
        .catch((error) => console.warn('[GrooveSpace] No se pudo enviar el correo de notificación.', error.message));
    }
    return created;
  } catch (error) {
    if (error.code !== 11000) console.warn('[GrooveSpace] No se pudo crear la notificación.', error.message);
    return null;
  }
};

/** Avisa a la banda (líder) y a todos sus integrantes con cuenta. */
exports.notifyBand = async (band, payload) => {
  const results = [await exports.notify({ recipientType: 'band', recipientId: band._id, email: band.email, ...payload, dedupeKey: payload.dedupeKey && `${payload.dedupeKey}:band` })];
  (band.members || []).forEach((member) => {
    results.push(exports.notify({ recipientType: 'member', recipientId: member._id, ...payload, dedupeKey: payload.dedupeKey && `${payload.dedupeKey}:${member._id}` }));
  });
  await Promise.all(results);
};

const audience = (actor) => ({ recipientType: actor.type, recipientId: actor.type === 'staff' ? { $in: [actor.id, 'all'] } : actor.id });

exports.listFor = (actor, limit = 40) => Notification.find(audience(actor)).sort({ createdAt: -1 }).limit(limit);
exports.unreadCount = (actor) => Notification.countDocuments({ ...audience(actor), readAt: { $exists: false } });
exports.markAllRead = (actor) => Notification.updateMany({ ...audience(actor), readAt: { $exists: false } }, { $set: { readAt: new Date() } });
