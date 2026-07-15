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
if (process.env.PHONE_LISTENER_PROVIDER === 'android') {
  for (const key of ['ANDROID_FORWARDER_HMAC_SECRET']) {
    if (!process.env[key]) {
      console.error(`[listener] Missing required env var: ${key}`);
      process.exit(1);
    }
  }
}

const prisma        = require('../backend/src/shared/db/prisma');
const redditAdapter  = require('./adapters/reddit.adapter');

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

if (process.env.PHONE_LISTENER_PROVIDER === 'android') {
  const app = require('./app');
  const PORT = process.env.PORT || process.env.LISTENER_WEBHOOK_PORT || 8090;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[listener] Android phone webhook server running on port ${PORT}`);
  });
}

console.log('[listener] primid-social-listener started.');
