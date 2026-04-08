const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./modules/auth/auth.routes');
const verifyRoutes = require('./modules/verify/verify.routes');
const userRoutes = require('./modules/user/user.routes');
const attestationsRoutes = require('./modules/attestations/attestations.routes');
const socialRoutes = require('./modules/social/social.routes');
const publicRoutes = require('./modules/public/public.routes');
const { errorHandler } = require('./shared/middleware/errorHandler');
const { attachSafeBody } = require('./shared/middleware/loggerScrub');

const app = express();

app.set('trust proxy', 1);

app.use(helmet());

// Chrome Private Network Access
app.use((req, res, next) => {
  if (req.method === 'OPTIONS' && req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  next();
});

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(attachSafeBody);

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/user', userRoutes);
app.use('/api/attestations', attestationsRoutes);
app.use('/api/social-accounts', socialRoutes);

app.all('/api/agent/*', (req, res) => {
  res.status(501).json({ success: false, message: 'Not available in Sprint 1.' });
});
app.all('/api/verify/ein', (req, res) => {
  res.status(501).json({ success: false, message: 'Not available in Sprint 1.' });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.', path: req.path });
});

app.use(errorHandler);

module.exports = app;
