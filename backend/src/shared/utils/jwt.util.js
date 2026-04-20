const crypto = require('crypto');
const jwt = require('../../../vendor/jsonwebtoken');

const JWT_SECRET = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not set');
  return process.env.JWT_SECRET;
};

// Tier 3 gets a 24h access token with no refresh token.
// Tier 2 and below get a 15-min access token paired with a 90-day refresh token.
function generateAccessToken(userId, tier) {
  const expiresIn = tier === 3 ? '24h' : '15m';
  return jwt.sign({ sub: userId, current_tier: tier }, JWT_SECRET(), { expiresIn });
}

function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET());
}

// Returns a 80-char hex opaque string — never stored; only its SHA-256 hash is persisted.
function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { generateAccessToken, verifyAccessToken, generateRefreshToken, hashToken };
