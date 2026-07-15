const express = require('express');
const rateLimit = require('express-rate-limit');
const phoneAdapters = require('./adapters/phone');

const app = express();

app.set('trust proxy', 1);

// Deliberately no global body parser — the phone webhook routes need the raw,
// untouched request body for byte-for-byte HMAC signature verification, so
// each route applies express.raw() itself (see adapters/phone/*.adapter.js).

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Machine-to-machine webhook receiver — no browser CSP/referrer concerns, so
// helmet is intentionally omitted. Signature verification (mandatory, fail
// closed) is the real perimeter control, not IP/network placement.
const webhookLimiter = rateLimit({ windowMs: 60_000, max: 120 });
app.use('/webhooks', webhookLimiter);

phoneAdapters.mount(app);

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

module.exports = app;
