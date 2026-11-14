const mongoose = require('mongoose');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** Envuelve un handler async para que cualquier error llegue al manejador global de Express. */
exports.wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
exports.HttpError = HttpError;
exports.isObjectId = (value) => typeof value === 'string' && mongoose.isValidObjectId(value) && /^[a-f\d]{24}$/i.test(value);

/** Lanza 404/400 en lugar de devolver null: simplifica los servicios. */
exports.assert = (condition, status, message) => { if (!condition) throw new HttpError(status, message); };

exports.cleanString = (value, max = 200) => (typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
