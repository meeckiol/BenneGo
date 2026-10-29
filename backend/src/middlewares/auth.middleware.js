const { verifyToken } = require('../services/session.service');

/**
 * Middleware d'authentification JWT
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token d\'authentification requis' });
  }
  try {
    // Signature, compte actif, suppression non demandée, appareil non déconnecté
    req.user = await verifyToken(authHeader.split(' ')[1]);
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expirée, reconnectez-vous' });
    }
    if (error.status === 401) return res.status(401).json({ error: error.message });
    if (error.name === 'JsonWebTokenError') return res.status(401).json({ error: 'Token invalide' });
    next(error);
  }
};

/**
 * Middleware de vérification du rôle
 * @param {...string} roles - Rôles autorisés
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      error: `Accès refusé. Rôle requis: ${roles.join(' ou ')}`,
    });
  }
  next();
};

module.exports = { authenticate, requireRole };
