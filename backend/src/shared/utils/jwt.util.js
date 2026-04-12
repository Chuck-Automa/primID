const jwt = require('../../../vendor/jsonwebtoken');

const JWT_SECRET = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not set');
  return process.env.JWT_SECRET;
};

/**
 * Generate a signed JWT.
 * tier === 3 → 24h expiry; tier < 3 (or null) → 90d expiry.
 */
function generateToken(userId, tier) {
  const expiresIn = tier === 3 ? '24h' : '90d';
  return jwt.sign({ userId, tier }, JWT_SECRET(), { expiresIn });
}

/**
 * Verify a JWT and return the decoded payload.
 * Throws if invalid or expired.
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET());
}

module.exports = { generateToken, verifyToken };
