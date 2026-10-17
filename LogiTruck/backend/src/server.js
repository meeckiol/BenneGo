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
const { errorHandler } = require('./middlewares/error.middleware');
const reviewRoutes = require('./routes/review.routes');
const { setupSocketIO } = require('./services/socket.service');
const { validateEnv, allowedOrigins } = require('./config/env');

validateEnv();
const origins = allowedOrigins();

const app = express();
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: origins,
    methods: ['GET', 'POST'],
  },
});

// =============================================
// Middlewares de sécurité
// =============================================
app.use(helmet());
app.use(cors({ origin: origins }));

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
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'LogiTruck API', version: '1.0.0' });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);

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
// Démarrage du serveur
// =============================================
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`LogiTruck API démarrée sur le port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  });
}

module.exports = { app, server, io };
