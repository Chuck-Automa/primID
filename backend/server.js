require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./src/modules/auth/auth.routes');
const verifyRoutes = require('./src/modules/verify/verify.routes');
const userRoutes = require('./src/modules/user/user.routes');
const attestationsRoutes = require('./src/modules/attestations/attestations.routes');
const socialRoutes = require('./src/modules/social/social.routes');
const { errorHandler } = require('./src/shared/middleware/errorHandler');
const features = require('./src/shared/flags/features');

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);

// Security
app.use(helmet());

// Chrome Private Network Access — must run before cors() so the header is included
// in the preflight response that cors() sends.
app.use((req, res, next) => {
  if (req.method === 'OPTIONS' && req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  next();
});

// CORS
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, same-origin)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));


// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Dev: serve CA cert over plain HTTP on port 3002 so iPhone can download before trusting the cert
if (process.env.NODE_ENV !== 'production') {
  const caPath = path.join(__dirname, '../certs/rootCA.crt');
  const caApp = express();
  caApp.get('/ca.crt', (req, res) => res.download(caPath, 'primID-dev-ca.crt'));
  http.createServer(caApp).listen(3002, '0.0.0.0', () =>
    console.log(`CA cert available at http://<your-local-ip>:3002/ca.crt`)
  );
}

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/user', userRoutes);
app.use('/api/attestations', attestationsRoutes);
app.use('/api/social-accounts', socialRoutes);

// Sprint 2 stubs
app.all('/api/agent/*', (req, res) => {
  res.status(501).json({ success: false, message: 'Not available in Sprint 1.' });
});
app.all('/api/verify/ein', (req, res) => {
  res.status(501).json({ success: false, message: 'Not available in Sprint 1.' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.', path: req.path });
});

// Error handler
app.use(errorHandler);

const certPath = path.join(__dirname, '../certs/cert.pem');
const keyPath = path.join(__dirname, '../certs/key.pem');
const useHttps = fs.existsSync(certPath) && fs.existsSync(keyPath);

const server = useHttps
  ? https.createServer({ cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }, app)
      .listen(PORT, '0.0.0.0', () => {
        console.log(`primID backend running on port ${PORT} (HTTPS)`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`CORS origin: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
        console.log('Feature flags:', features);
      })
  : app.listen(PORT, '0.0.0.0', () => {
      console.log(`primID backend running on port ${PORT} (HTTP)`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`CORS origin: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
      console.log('Feature flags:', features);
    });

function gracefulShutdown(signal) {
  console.log(`${signal} received: shutting down...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  gracefulShutdown('unhandledRejection');
});

module.exports = app;
