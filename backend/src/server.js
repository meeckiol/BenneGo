require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const orderRoutes = require('./routes/order.routes');
const driverRoutes = require('./routes/driver.routes');
const paymentRoutes = require('./routes/payment.routes');
const adminRoutes = require('./routes/admin.routes');
const companyRoutes = require('./routes/company.routes');
const promoRoutes = require('./routes/promo.routes');
const careerRoutes = require('./routes/career.routes');
const referralRoutes = require('./routes/referral.routes');
const recurringRoutes = require('./routes/recurring.routes');
const { errorHandler } = require('./middlewares/error.middleware');
const reviewRoutes = require('./routes/review.routes');
const { setupSocketIO } = require('./services/socket.service');
const { validateEnv, allowedOrigins } = require('./config/env');
const { pool } = require('./config/database');

validateEnv();
const origins = allowedOrigins();

const corsOriginConfig = (origin, callback) => {
  if (!origin || process.env.NODE_ENV !== 'production' || origins.includes(origin)) {
    return callback(null, true);
  }
  return callback(new Error('Origine non autorisée par CORS'));
};

const app = express();
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV !== 'production' ? true : origins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// =============================================
// Middlewares de sécurité
// =============================================
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: corsOriginConfig, credentials: true }));

// Rate limiting global
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // le suivi GPS de l'appli mobile envoie une position toutes les ~10 s
  message: { error: 'Trop de requêtes, réessayez dans quelques minutes.' },
  skip: () => process.env.NODE_ENV === 'test',
});
app.use(limiter);

// Rate limiting strict pour l'auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives de connexion.' },
  skip: () => process.env.NODE_ENV === 'test',
});

// =============================================
// Middlewares généraux
// =============================================
app.use(compression());
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}
app.use(express.json({ limit: '100kb' }));

// =============================================
// Routes
// =============================================
app.get('/health', async (req, res) => {
  try {
    const dbStart = Date.now();
    await pool.query('SELECT 1');
    const dbLatencyMs = Date.now() - dbStart;
    res.json({
      status: 'ok',
      service: 'BenneGo API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        connected: true,
        latencyMs: dbLatencyMs,
      },
      memory: {
        rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
    });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      service: 'BenneGo API',
      version: '1.0.0',
      error: 'Base de données inaccessible',
      database: { connected: false },
    });
  }
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/promo', promoRoutes);
app.use('/api/careers', careerRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/orders/recurring', recurringRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/vehicle-types', companyRoutes);

// =============================================
// WebSocket pour tracking temps réel
// =============================================
setupSocketIO(io);

// Rendre io accessible dans les controllers
app.set('io', io);

// =============================================
// Gestion des erreurs
// =============================================
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});
app.use(errorHandler);

// =============================================
// Démarrage du serveur et arrêt gracieux
// =============================================
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`BenneGo API démarrée sur le port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  });

  const shutdown = (signal) => {
    console.log(`Signal ${signal} reçu. Arrêt gracieux en cours...`);
    server.close(async () => {
      try {
        await pool.end();
        console.log('Connexions PostgreSQL closes.');
        process.exit(0);
      } catch (e) {
        console.error('Erreur lors de la fermeture du pool:', e);
        process.exit(1);
      }
    });
    setTimeout(() => {
      console.error('Arrêt forcé après timeout de 10s.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = { app, server, io };
