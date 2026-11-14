const Demo = require('../demos/Demo');
const BandFile = require('./BandFile');
const Deliverable = require('../deliverables/Deliverable');
const Contract = require('../contracts/Contract');
const Message = require('../chat/Message');
const Notification = require('../notifications/Notification');
const WalletEntry = require('../wallet/WalletEntry');
const PaymentIntent = require('../payments/PaymentIntent');
const { EventApplication } = require('../events/models');
const { EngineerReview, EngineerRequest } = require('../marketplace/models');
const storage = require('../storage');

/** Recoge lo que hay que borrar ANTES de eliminar la banda (después ya no se pueden consultar sus ids). */
exports.snapshot = async (band, reservationIds) => ({
  bandId: band._id,
  reservationIds,
  recipientIds: [String(band._id), ...band.members.map((member) => String(member._id))]
});

/** Limpieza posterior al borrado de la banda: archivos privados en el almacenamiento y datos huérfanos. Mejor esfuerzo, nunca rompe la respuesta. */
exports.purge = async ({ bandId, reservationIds, recipientIds }) => {
  const summary = { storageFiles: 0, failed: 0 };
  const keys = [];
  const withKeys = async (query) => { try { return await query; } catch { summary.failed += 1; return []; } };
  for (const demo of await withKeys(Demo.find({ bandId }).select('+storageKey'))) keys.push(demo.storageKey);
  for (const file of await withKeys(BandFile.find({ bandId }).select('+storageKey'))) keys.push(file.storageKey);
  for (const item of await withKeys(Deliverable.find({ bandId }).select('+versions.storageKey'))) for (const version of item.versions || []) keys.push(version.storageKey);
  for (const key of keys.filter(Boolean)) { await storage.remove(key); summary.storageFiles += 1; }

  const tasks = [
    Demo.deleteMany({ bandId }), BandFile.deleteMany({ bandId }), Deliverable.deleteMany({ bandId }), Contract.deleteMany({ bandId }),
    WalletEntry.deleteMany({ bandId }), EventApplication.deleteMany({ bandId }), EngineerRequest.deleteMany({ bandId }), EngineerReview.deleteMany({ bandId }),
    Message.deleteMany({ reservationId: { $in: reservationIds } }),
    Notification.deleteMany({ recipientType: { $in: ['band', 'member'] }, recipientId: { $in: recipientIds } }),
    PaymentIntent.deleteMany({ actorType: 'band', actorId: String(bandId) })
  ];
  const results = await Promise.allSettled(tasks);
  summary.failed += results.filter((item) => item.status === 'rejected').length;
  return summary;
};
