const express = require('express');
const rateLimit = require('express-rate-limit');
const phoneAdapters = require('./adapters/phone');
const telegramAdapter = require('./adapters/telegram.adapter');

const app = express();

app.set('trust proxy', 1);

// Deliberately no global body parser — the phone webhook routes need the raw,
// untouched request body for byte-for-byte HMAC signature verification, so
// each route applies express.raw() itself (see adapters/phone/*.adapter.js).

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Render marks a web service healthy only if it binds $PORT — this must hold
// regardless of feature-flag/mode state (see CLAUDE_ENVIRONMENTS.md Render
// service topology trap #1), so this route reports adapter state rather than
// gating on it. 'off' means the adapter isn't active, not that it's missing.
app.get('/healthz', (req, res) => {
  const telegramActive =
    process.env.TELEGRAM_SOCIAL_LISTENER === 'true' &&
    (process.env.TELEGRAM_LISTENER_MODE === 'polling' || process.env.TELEGRAM_LISTENER_MODE === 'webhook');

  res.status(200).json({
    status: 'ok',
    adapters: {
      telegram: telegramActive ? process.env.TELEGRAM_LISTENER_MODE : 'off',
      phone: process.env.PHONE_LISTENER_PROVIDER || 'off',
    },
  });
});

// Machine-to-machine webhook receiver — no browser CSP/referrer concerns, so
// helmet is intentionally omitted. Signature verification (mandatory, fail
// closed) is the real perimeter control, not IP/network placement.
const webhookLimiter = rateLimit({ windowMs: 60_000, max: 120 });
app.use('/webhooks', webhookLimiter);

phoneAdapters.mount(app);
telegramAdapter.mount(app);

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

module.exports = app;
