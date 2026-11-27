const crypto = require('crypto');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const storage = require('../storage');

// Imágenes de banda (logo e instrumentos). Se guardan con clave opaca y se sirven por /api/bands/media/:file.
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const NAME_RE = /^[a-f0-9]{32}\.(jpg|png|webp)$/;
const URL_RE = /^\/api\/bands\/media\/([a-f0-9]{32}\.(?:jpg|png|webp))$/;

/** Guarda un archivo en memoria y devuelve la ruta pública que se almacena en la banda. */
exports.saveImage = async (file) => {
  const ext = EXT[file.mimetype];
  if (!ext) throw new Error('Formato de imagen no permitido.');
  const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
  const tmp = path.join(os.tmpdir(), `gs-img-${crypto.randomBytes(8).toString('hex')}`);
  await fs.writeFile(tmp, file.buffer);
  try {
    await storage.store({ key: `img/${name}`, filePath: tmp, size: file.size, contentType: file.mimetype });
  } finally {
    await fs.rm(tmp, { force: true });
  }
  return `/api/bands/media/${name}`;
};

/** Borra una imagen guardada por este módulo. Las rutas heredadas (/uploads, logos provisionales) se ignoran. */
exports.removeImage = (url) => {
  const match = typeof url === 'string' && url.match(URL_RE);
  return match ? storage.remove(`img/${match[1]}`) : Promise.resolve();
};

exports.serveImage = async (req, res, name) => {
  if (!NAME_RE.test(name)) return res.status(404).end();
  const key = `img/${name}`;
  const { size } = await storage.driver().head(key);
  return storage.streamTo(req, res, { key, size, mime: MIME[name.split('.').pop()], filename: name });
};
