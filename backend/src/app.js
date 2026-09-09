const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const prisma = require('./shared/db/prisma');
const listenerRegistry = require('../../config/listeners.registry');
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

app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));

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

// GET /health — bare liveness for the Render health check, resolved nodeEnv, and one boolean
// per registered listener. Unauthenticated by design (see CLAUDE_HEALTH.md §4) — this is the
// one documented exception to the authenticate -> requireTier(n) -> handler stack; do not use
// it as precedent for skipping `authenticate` on any other route.
//
// Full spec: CLAUDE_HEALTH.md. Enumerates config/listeners.registry.js and nothing else.
const healthRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const HEALTH_CACHE_TTL_MS = 5000; // WEB_CONCURRENCY=1 (CLAUDE_ENVIRONMENTS.md) — in-process cache is coherent
let healthCache = null; // { body, expiresAt } | null — success bodies only, never the 503 path

// This deployment resolves NODE_ENV to exactly two literal values in practice: 'development'
// (shared by both the dev and staging deployments today — see otp.util.js's
// isOnStagingWhitelist comment; there is no literal 'staging' NODE_ENV value) and 'production'.
// The registry's environments arrays use the three-way dev/staging/prod vocabulary, so this
// bucket mapping exists purely to make that filter actually match something real. It affects
// ONLY which registry entries are considered — the `nodeEnv` field in the response below is
// still the raw, verbatim `process.env.NODE_ENV` value, never coerced or defaulted.
function resolveEnvBuckets(nodeEnv) {
  if (nodeEnv === 'production') return ['prod'];
  if (nodeEnv === 'development') return ['dev', 'staging'];
  return [];
}

// enabledFlag is boolean-checked (=== 'true') for every entry except the github/Category B
// entry, whose real gate (CATEGORY_B_PROVIDER) is an enum ('stub'|'live') — see the inline
// comment on that registry entry and CLAUDE_HEALTH.md §4.
function isFlagEnabled(enabledFlag) {
  if (!enabledFlag) return true;
  if (enabledFlag === 'CATEGORY_B_PROVIDER') return process.env.CATEGORY_B_PROVIDER === 'live';
  return process.env[enabledFlag] === 'true';
}

app.get('/health', healthRateLimit, async (req, res) => {
  const nodeEnv = process.env.NODE_ENV;

  if (healthCache && healthCache.expiresAt > Date.now()) {
    return res.status(200).json(healthCache.body);
  }

  const envBuckets = resolveEnvBuckets(nodeEnv);
  const activeEntries = listenerRegistry.filter((entry) =>
    entry.environments.some((e) => envBuckets.includes(e))
  );

  let statusRows;
  try {
    statusRows = activeEntries.length
      ? await prisma.listenerStatus.findMany({
          where: { provider: { in: activeEntries.map((entry) => entry.statusProvider) } },
        })
      : [];
  } catch (err) {
    // The only 503 condition: the API's own inability to reach Postgres. Listener staleness
    // never affects HTTP status — see CLAUDE_HEALTH.md §4/§9.
    return res.status(503).json({ status: 'degraded', nodeEnv, listeners: {} });
  }

  const statusByProvider = new Map(statusRows.map((row) => [row.provider, row]));
  const now = Date.now();
  const listeners = {};

  for (const entry of activeEntries) {
    const row = statusByProvider.get(entry.statusProvider);
    const staleAfterSeconds =
      parseInt(process.env[entry.staleAfterEnv], 10) || entry.staleAfterDefault;
    const withinWindow = row
      ? (now - new Date(row.lastSeenAt).getTime()) / 1000 <= staleAfterSeconds
      : false;
    listeners[entry.key] = Boolean(isFlagEnabled(entry.enabledFlag) && row && withinWindow);
  }

  const body = { status: 'ok', nodeEnv, listeners };
  healthCache = { body, expiresAt: now + HEALTH_CACHE_TTL_MS };
  res.status(200).json(body);
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
