/**
 * Middleware centralisé de gestion des erreurs
 */
const errorHandler = (err, req, res, next) => {
  // Les erreurs métier attendues (4xx) ne polluent pas les logs en test
  const quiet = process.env.NODE_ENV === 'test' && (err.statusCode || 500) < 500;
  if (!quiet) console.error('Erreur:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  // Erreurs d'upload (multer) : taille, nombre ou champ inattendu
  if (err.name === 'MulterError') {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Photo trop lourde (2 Mo maximum par image)'
      : 'Envoi de fichiers invalide';
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: message });
  }

  // Erreur de validation
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  // Erreur de contrainte PostgreSQL (doublon)
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Cette donnée existe déjà' });
  }

  // Erreur de clé étrangère PostgreSQL
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Référence invalide' });
  }

  // Erreur générique
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Erreur interne du serveur'
    : err.message;

  res.status(statusCode).json({ error: message });
};

/**
 * Classe d'erreur personnalisée
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

module.exports = { errorHandler, AppError };
