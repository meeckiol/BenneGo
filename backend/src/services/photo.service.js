/**
 * Stockage des photos de commande (chargement, ticket de pesée, litige, preuve de livraison).
 * Les fichiers sont écrits sur disque (UPLOAD_DIR) sous un nom aléatoire et servis par /uploads :
 * la base ne contient que l'URL, jamais le contenu de l'image.
 */
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const multer = require('multer');
const { AppError } = require('../middlewares/error.middleware');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** Vérifie la signature réelle du fichier : le mimetype vient du client et ne suffit pas. */
const hasImageSignature = (buf) => (
  (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF)
  || (buf.slice(0, 4).toString('hex') === '89504e47')
  || (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP')
);

/** Multer en mémoire : la taille et le format sont contrôlés avant écriture sur disque. */
const uploadPhotos = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 6 },
  fileFilter: (req, file, cb) => (
    EXTENSIONS[file.mimetype]
      ? cb(null, true)
      : cb(new AppError('Format image invalide (JPEG, PNG ou WebP uniquement)', 400))
  ),
});

/** @returns {Promise<string>} URL publique relative, ex. /uploads/3f9c...jpg */
const saveImage = async (file) => {
  if (!file || !hasImageSignature(file.buffer)) {
    throw new AppError('Fichier image invalide', 400);
  }
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${crypto.randomBytes(16).toString('hex')}.${EXTENSIONS[file.mimetype]}`;
  await fs.writeFile(path.join(UPLOAD_DIR, name), file.buffer, { mode: 0o640 });
  return `/uploads/${name}`;
};

module.exports = { uploadPhotos, saveImage, hasImageSignature, UPLOAD_DIR };
