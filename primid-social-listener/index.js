require('dotenv').config();

// Feature flag check — clean exit if listener is not enabled.
if (process.env.REDDIT_SOCIAL_LISTENER !== 'true') {
  console.log('[listener] REDDIT_SOCIAL_LISTENER is not enabled. Exiting.');
  process.exit(0);
}

// Validate required env vars before starting anything.
const required = [
  'REDDIT_CLIENT_ID',
  'REDDIT_CLIENT_SECRET',
  'REDDIT_REFRESH_TOKEN',
  'HMAC_SECRET',
  'DATABASE_URL',
];

// ALE key: either direct hex key (dev) or KMS ARN (prod) — at least one must be set.
if (!process.env.ALE_ENCRYPTION_KEY && !process.env.ALE_KMS_KEY_ARN) {
  console.error('[listener] Missing env var: ALE_ENCRYPTION_KEY or ALE_KMS_KEY_ARN must be set.');
  process.exit(1);
}

for (const key of required) {
  if (!process.env[key]) {
    console.error(`[listener] Missing required env var: ${key}`);
    process.exit(1);
  }
}

const prisma        = require('../backend/src/shared/db/prisma');
const redditAdapter = require('./adapters/reddit.adapter');

// Daily cleanup: delete verification_challenges rows expired more than 24 hours ago.
async function runCleanup() {
  try {
    await prisma.$executeRaw`
      DELETE FROM verification_challenges
      WHERE COALESCE(used_at, expires_at) < NOW() - INTERVAL '24 hours'
    `;
    console.log('[cleanup] expired verification_challenges purged');
  } catch (err) {
    console.log(`[cleanup] error during purge: ${err.message}`);
  }
}

setInterval(runCleanup, 86_400_000);
runCleanup();

redditAdapter.start();

console.log('[listener] primid-social-listener started. Reddit polling active.');
