const prisma = require('../../shared/db/prisma');
const { generateOtp, sendOtp, isOnStagingWhitelist } = require('../../shared/utils/otp.util');
const { normalizePhone, computeHmac, encrypt } = require('../../shared/utils/crypto.util');
const { verifyOAuthToken } = require('../verify/verify.controller');

// ── Register ──────────────────────────────────────────────────────────────────
/**
 * POST /api/auth/register
 * method=otp  → normalize phone → staging whitelist check → check new user →
 *               create Ghost user → send OTP
 * method=oauth → signal new-user creation is allowed → delegate to verifyOAuthToken
 *
 * Staging access gate:
 *   OTP path:   only whitelisted numbers may register (STAGING_OTP_WHITELIST in .env).
 *   OAuth path: enforced upstream by Google Cloud Console; no backend allowlist needed.
 */
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

      // Staging whitelist check.
      if (!isOnStagingWhitelist(normalized)) {
        return res.status(403).json({
          success: false,
          code:    'DEMO_RESTRICTED',
          message: 'This number is not approved for demo access.',
        });
      }

      const hmac = computeHmac(normalized);

      // Check if user already exists — if so, redirect to login.
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
/**
 * POST /api/auth/login
 * User must already exist — no account creation on the login path.
 * method=otp  → normalize phone → confirm user exists → send OTP
 * method=oauth → delegate to verifyOAuthToken
 */
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
      // Login is account-lookup only — do not create new users on this path.
      req.body._isLoginOnly = true;
      return verifyOAuthToken(req, res, next);
    }

    return res.status(400).json({ success: false, message: 'method must be "otp" or "oauth".' });
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res) => {
  // Stateless JWT — client discards token. Endpoint exists for UX consistency.
  return res.status(200).json({ success: true, message: 'Logged out successfully.' });
};

module.exports = { register, login, logout };
