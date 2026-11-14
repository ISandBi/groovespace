const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { pipeline } = require('stream/promises');

// Almacenamiento en disco. La carpeta queda FUERA de src/ y no se sirve estáticamente:
// los archivos sólo salen por rutas autenticadas.
const root = () => path.resolve(process.env.STORAGE_LOCAL_DIR || path.join(__dirname, '..', '..', '..', 'storage'));
const resolveKey = (key) => {
  const full = path.resolve(root(), key);
  if (!full.startsWith(root() + path.sep)) throw new Error('Clave de almacenamiento no válida.');
  return full;
};

exports.name = 'local';

exports.put = async ({ key, filePath }) => {
  const target = resolveKey(key);
  await fsp.mkdir(path.dirname(target), { recursive: true });
  await pipeline(fs.createReadStream(filePath), fs.createWriteStream(target, { flags: 'wx' }));
};

exports.head = async (key) => {
  const stats = await fsp.stat(resolveKey(key));
  return { size: stats.size };
};

exports.open = async (key, { start, end } = {}) => fs.createReadStream(resolveKey(key), start === undefined ? {} : { start, end });

exports.remove = async (key) => { await fsp.rm(resolveKey(key), { force: true }); };
