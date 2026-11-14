const crypto = require('crypto');
const fs = require('fs');
const { parseRange } = require('./media');

// STORAGE_DRIVER=s3 para producción; por defecto, disco local.
const driver = () => (process.env.STORAGE_DRIVER === 's3' ? require('./s3') : require('./local'));
exports.driver = driver;

const KEY_PATTERN = /^[a-z0-9][a-z0-9/_.-]{3,200}$/i;
exports.newKey = (folder, ext) => `${folder}/${crypto.randomBytes(16).toString('hex')}.${ext}`;

/** Sube un archivo temporal y calcula su SHA-256 para verificar integridad (el original no se recodifica nunca). */
exports.store = async ({ key, filePath, size, contentType }) => {
  if (!KEY_PATTERN.test(key) || key.includes('..')) throw new Error('Clave de almacenamiento no válida.');
  const sha256 = await new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(filePath).on('data', (chunk) => hash.update(chunk)).on('end', () => resolve(hash.digest('hex'))).on('error', reject);
  });
  await driver().put({ key, filePath, size, contentType });
  return { key, sha256, size };
};

exports.remove = (key) => driver().remove(key).catch((error) => console.warn('[GrooveSpace] No se pudo borrar el archivo.', error.message));

/**
 * Entrega un objeto por HTTP con soporte de Range (necesario para adelantar audio y video).
 * `inline` + `no-store`: el navegador lo reproduce pero no lo guarda en caché ni lo ofrece como descarga.
 */
exports.streamTo = async (req, res, { key, size, mime, filename, download = false }) => {
  const range = parseRange(req.headers.range, size);
  if (range === 'invalid') {
    res.set('Content-Range', `bytes */${size}`);
    return res.status(416).end();
  }
  res.set({
    'Content-Type': mime,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${String(filename || 'archivo').replace(/[^\w.\- ]/g, '_')}"`
  });
  const stream = await driver().open(key, range || undefined);
  if (range) {
    res.status(206).set({ 'Content-Range': `bytes ${range.start}-${range.end}/${size}`, 'Content-Length': range.end - range.start + 1 });
  } else {
    res.status(200).set('Content-Length', size);
  }
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  return stream.pipe(res);
};
