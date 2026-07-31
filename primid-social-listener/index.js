require('dotenv').config();

// PHONE_LISTENER_PROVIDER=android is dev/staging only — never prod. Fail closed
// at boot rather than trusting env config (defense in depth alongside the same
// guard in backend/server.js).
if (process.env.NODE_ENV === 'production' && process.env.PHONE_LISTENER_PROVIDER === 'android') {
  console.error('[listener] PHONE_LISTENER_PROVIDER=android is prohibited in production.');
  process.exit(1);
}

// Core env vars — both channels' crypto needs these regardless of which
// adapters are active.
const coreRequired = ['HMAC_SECRET', 'DATABASE_URL'];
for (const key of coreRequired) {
  if (!process.env[key]) {
    console.error(`[listener] Missing required env var: ${key}`);
    process.exit(1);
  }
}
if (!process.env.ALE_ENCRYPTION_KEY && !process.env.ALE_KMS_KEY_ARN) {
  console.error('[listener] Missing env var: ALE_ENCRYPTION_KEY or ALE_KMS_KEY_ARN must be set.');
  process.exit(1);
}

// Adapter-scoped required env vars — only validated when that adapter is active.
if (process.env.REDDIT_SOCIAL_LISTENER === 'true') {
  for (const key of ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET', 'REDDIT_REFRESH_TOKEN']) {
    if (!process.env[key]) {
      console.error(`[listener] Missing required env var: ${key}`);
      process.exit(1);
    }
  }
}
if (process.env.TELEGRAM_SOCIAL_LISTENER === 'true') {
  // Fail closed on an ambiguous/invalid mode rather than silently defaulting —
  // this is the single guard that prevents webhook + polling running together.
  const mode = process.env.TELEGRAM_LISTENER_MODE;
  if (mode !== 'polling' && mode !== 'webhook') {
    console.error(`[listener] TELEGRAM_SOCIAL_LISTENER=true requires TELEGRAM_LISTENER_MODE=polling|webhook, got: ${mode}`);
    process.exit(1);
  }
  const required = mode === 'webhook'
    ? ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET']
    : ['TELEGRAM_BOT_TOKEN'];
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`[listener] Missing required env var: ${key}`);
      process.exit(1);
    }
  }
}
if (process.env.PHONE_LISTENER_PROVIDER === 'android') {
  for (const key of ['ANDROID_FORWARDER_HMAC_SECRET']) {
    if (!process.env[key]) {
      console.error(`[listener] Missing required env var: ${key}`);
      process.exit(1);
    }
  }
  // Not fatal: unset just means the stub-fallback response omits maintenanceNotice.
  if (!process.env.PHONE_MAINTENANCE_NOTICE) {
    console.warn('[listener] PHONE_MAINTENANCE_NOTICE is unset — stub-fallback responses will omit maintenanceNotice.');
  }
}

const prisma          = require('../backend/src/shared/db/prisma');
const redditAdapter   = require('./adapters/reddit.adapter');
const telegramAdapter = require('./adapters/telegram.adapter');

// Daily cleanup: delete expired challenges (both phone and social channels),
// unconditionally — this process now always stays alive to run it, regardless
// of which adapters are active.
async function runCleanup() {
  try {
    await prisma.$executeRaw`
      DELETE FROM challenges
      WHERE COALESCE(used_at, expires_at) < NOW() - INTERVAL '24 hours'
    `;
    console.log('[cleanup] expired challenges purged');
  } catch (err) {
    console.log(`[cleanup] error during purge: ${err.message}`);
  }
}

setInterval(runCleanup, 86_400_000);
runCleanup();

if (process.env.REDDIT_SOCIAL_LISTENER === 'true') {
  redditAdapter.start();
  console.log('[listener] Reddit polling active.');
}

if (process.env.TELEGRAM_SOCIAL_LISTENER === 'true' && process.env.TELEGRAM_LISTENER_MODE === 'polling') {
  telegramAdapter.startPolling();
  console.log('[listener] Telegram polling active.');
}

// The HTTP server binds unconditionally now — Render only marks a web service
// healthy if it binds $PORT, and that must hold regardless of which
// adapters/flags are active (see CLAUDE_ENVIRONMENTS.md Render service
// topology trap #1: with everything defaulted off, the old conditional bind
// left the process alive but never marked healthy). app.js's own mount
// functions (phoneAdapters.mount, telegramAdapter.mount) still self-gate on
// their own env vars, so requiring app.js unconditionally is safe — only the
// active adapter(s) register routes; /healthz always responds regardless.
const app = require('./app');
const PORT = process.env.PORT || process.env.LISTENER_WEBHOOK_PORT || 8090;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[listener] HTTP server running on port ${PORT}`);
});

console.log('[listener] primid-social-listener started.');
