// Fields that must never appear in logs, error traces, or debug output.
// phone_number, oauth_sub, and wallet_address are ALE-encrypted PII.
// Log the user UUID only — never the sensitive identifier alongside it.
const PII_FIELDS = [
  'phoneNumber', 'phone_number',
  'oauthSub', 'oauth_sub',
  'walletAddress', 'wallet_address',
  // token fields could carry OAuth identity tokens with sub claims
  'token', 'id_token', 'access_token',
];

/**
 * Return a shallow copy of obj with PII fields replaced by '[REDACTED]'.
 * Safe to use in any logging context.
 */
function scrubForLog(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const scrubbed = { ...obj };
  for (const field of PII_FIELDS) {
    if (field in scrubbed) scrubbed[field] = '[REDACTED]';
  }
  return scrubbed;
}

/**
 * Express middleware that attaches req.safeBody — a PII-scrubbed view of
 * req.body. Use req.safeBody in any logging context instead of req.body.
 * Does NOT mutate req.body; handlers still receive full data.
 */
const attachSafeBody = (req, res, next) => {
  Object.defineProperty(req, 'safeBody', {
    get: () => scrubForLog(req.body),
    enumerable: false,
    configurable: true,
  });
  next();
};

module.exports = { scrubForLog, attachSafeBody };
