const multer = require('multer');
const path = require('path');

// Las imágenes se leen en memoria y se guardan en el almacenamiento configurado (R2/S3 o disco),
// nunca en una carpeta local del servidor: en Render el disco se borra en cada despliegue.
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (extname && mimetype) return cb(null, true);
  cb(new Error('El archivo debe ser una imagen válida (.jpg, .jpeg, .png, .webp)'));
};

module.exports = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { files: 13, fileSize: 10 * 1024 * 1024 }
});
