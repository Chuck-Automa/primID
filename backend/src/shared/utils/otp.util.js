const crypto = require('crypto');

// 62-char charset; 8 chars → 62^8 ≈ 218 trillion combinations.
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateCode(length = 8) {
  let result = '';
  while (result.length < length) {
    const bytes = crypto.randomBytes(length * 2);
    for (let i = 0; i < bytes.length && result.length < length; i++) {
      // Reject bytes ≥ 248 to avoid modulo bias (256 % 62 = 8).
      if (bytes[i] < 248) result += CHARSET[bytes[i] % 62];
    }
  }
  return result;
}

// Returns true if the number is allowed to initiate a challenge.
// Gated on NODE_ENV === 'development' — this project runs a single
// non-production deployment (the Android SMS Gateway interim environment),
// labeled 'development' rather than 'staging' to keep the deployed NODE_ENV
// value consistent across services. Only STAGING_PHONE_WHITELIST numbers pass
// in that environment; every other NODE_ENV value (including 'production')
// is unrestricted. STAGING_PHONE_WHITELIST itself is unrenamed — it's an
// unrelated env var name, not the NODE_ENV gate this function checks.
function isOnStagingWhitelist(phoneNumber) {
  if (process.env.NODE_ENV !== 'development') return true;
  const whitelist = (process.env.STAGING_PHONE_WHITELIST || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  return whitelist.includes(phoneNumber);
}

module.exports = { generateCode, isOnStagingWhitelist };
