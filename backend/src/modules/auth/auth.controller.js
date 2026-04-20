const prisma = require('../../shared/db/prisma');
const { generateOtp, sendOtp, isOnStagingWhitelist } = require('../../shared/utils/otp.util');
const { normalizePhone, computeHmac, encrypt } = require('../../shared/utils/crypto.util');
const { verifyOAuthToken, setRefreshCookie, REFRESH_TOKEN_TTL_MS } = require('../verify/verify.controller');
const { generateAccessToken, generateRefreshToken, hashToken } = require('../../shared/utils/jwt.util');

function getRefreshTokenFromCookies(req) {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/(?:^|;\s*)primid_rt=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// ── Register ──────────────────────────────────────────────────────────────────
const register = async (req, res, next) => {
  try {
    const { method, phoneNumber, provider, token } = req.body;

    if (method === 'otp') {
      if (!phoneNumber) {
        return res.status(400).json({ success: false, message: 'phoneNumber is required.' });
      }

      let normalized;
      try {
        normalized = normalizePhone(phoneNumber);
      } catch {
        return res.status(400).json({ success: false, code: 'INVALID_PHONE', message: 'Please enter a valid phone number.' });
      }

      if (!isOnStagingWhitelist(normalized)) {
        return res.status(403).json({
          success: false,
          code:    'DEMO_RESTRICTED',
          message: 'This number is not approved for demo access.',
        });
      }

      const hmac = computeHmac(normalized);

      const existing = await prisma.user.findUnique({ where: { phoneNumberHmac: hmac } });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'An account with this phone number already exists. Please use /api/auth/login.',
        });
      }

      const encrypted = encrypt(normalized);
      await prisma.user.create({
        data: { phoneNumber: encrypted, phoneNumberHmac: hmac },
      });

      const code = generateOtp();
      const devCode = await sendOtp(normalized, code);

      const response = { success: true, message: 'OTP sent. Please verify your phone number.' };
      if (devCode) response.devCode = devCode;

      return res.status(200).json(response);
    }

    if (method === 'oauth') {
      return verifyOAuthToken(req, res, next);
    }

    return res.status(400).json({ success: false, message: 'method must be "otp" or "oauth".' });
  } catch (err) {
    next(err);
  }
};

// ── Login ─────────────────────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { method, phoneNumber } = req.body;

    if (method === 'otp') {
      if (!phoneNumber) {
        return res.status(400).json({ success: false, message: 'phoneNumber is required.' });
      }

      let normalized;
      try {
        normalized = normalizePhone(phoneNumber);
      } catch {
        return res.status(400).json({ success: false, code: 'INVALID_PHONE', message: 'Please enter a valid phone number.' });
      }

      const hmac = computeHmac(normalized);
      const existing = await prisma.user.findUnique({ where: { phoneNumberHmac: hmac } });
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'No account found for this phone number. Please register first.',
        });
      }

      const code = generateOtp();
      const devCode = await sendOtp(normalized, code);

      const response = { success: true, message: 'OTP sent.' };
      if (devCode) response.devCode = devCode;

      return res.status(200).json(response);
    }

    if (method === 'oauth') {
      req.body._isLoginOnly = true;
      return verifyOAuthToken(req, res, next);
    }

    return res.status(400).json({ success: false, message: 'method must be "otp" or "oauth".' });
  } catch (err) {
    next(err);
  }
};

// ── Logout ────────────────────────────────────────────────────────────────────
// Tier 2+: revokes the refresh token cookie and clears it.
// Tier 3:  client-side discard only — no refresh token row exists.
const logout = async (req, res, next) => {
  try {
    const rawToken = getRefreshTokenFromCookies(req);

    if (rawToken) {
      const hash = hashToken(rawToken);
      const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
      if (row && !row.revokedAt) {
        await prisma.refreshToken.update({
          where: { tokenHash: hash },
          data:  { revokedAt: new Date() },
        });
      }
      res.clearCookie('primid_rt', { path: '/api/auth' });
    }

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// ── Refresh ───────────────────────────────────────────────────────────────────
// Single-use refresh token rotation (Tier 2+ only).
// Presenting an already-rotated token is a replay attack — revoke the entire
// chain and return 401.
const refresh = async (req, res, next) => {
  try {
    const rawToken = getRefreshTokenFromCookies(req);
    if (!rawToken) {
      return res.status(401).json({ success: false, message: 'No refresh token.' });
    }

    const hash = hashToken(rawToken);
    const row = await prisma.refreshToken.findUnique({
      where:   { tokenHash: hash },
      include: { user: { select: { id: true, currentTier: true } } },
    });

    if (!row) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token.' });
    }

    if (row.rotatedAt !== null) {
      // Replay attack — revoke all active refresh tokens for this user.
      await prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data:  { revokedAt: new Date() },
      });
      res.clearCookie('primid_rt', { path: '/api/auth' });
      return res.status(401).json({ success: false, code: 'REPLAY_DETECTED', message: 'Session invalidated. Please login again.' });
    }

    if (row.revokedAt !== null) {
      res.clearCookie('primid_rt', { path: '/api/auth' });
      return res.status(401).json({ success: false, message: 'Refresh token revoked. Please login again.' });
    }

    if (row.expiresAt < new Date()) {
      res.clearCookie('primid_rt', { path: '/api/auth' });
      return res.status(401).json({ success: false, message: 'Refresh token expired. Please login again.' });
    }

    // Rotate: consume old token, issue new pair.
    const newRawToken = generateRefreshToken();
    const newHash     = hashToken(newRawToken);
    const expiresAt   = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    const newRow = await prisma.refreshToken.create({
      data: { userId: row.userId, tokenHash: newHash, expiresAt },
    });

    await prisma.refreshToken.update({
      where: { id: row.id },
      data:  { rotatedAt: new Date(), replacedBy: newRow.id },
    });

    const accessToken = generateAccessToken(row.user.id, row.user.currentTier);

    setRefreshCookie(res, newRawToken);

    return res.status(200).json({ success: true, accessToken });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, logout, refresh };
