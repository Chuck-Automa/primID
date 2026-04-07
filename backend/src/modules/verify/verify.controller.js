const prisma = require('../../shared/db/prisma');
const { createRemoteJWKSet, jwtVerify } = require('jose');
const { validateOtp, generateOtp, sendOtp, isOnStagingWhitelist } = require('../../shared/utils/otp.util');
const { computeAndSaveTier } = require('../../shared/utils/computeTier');
const { generateToken } = require('../../shared/utils/jwt.util');
const { normalizePhone, computeHmac, encrypt } = require('../../shared/utils/crypto.util');
const features = require('../../shared/flags/features');

// ── Phone OTP ─────────────────────────────────────────────────────────────────

// POST /api/verify/phone/initiate
const initiatePhone = async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: 'phoneNumber is required.' });
    }

    // E.164 normalization is the first step — always before HMAC or encryption.
    let normalized;
    try {
      normalized = normalizePhone(phoneNumber);
    } catch {
      return res.status(400).json({ success: false, code: 'INVALID_PHONE', message: 'Please enter a valid phone number.' });
    }

    // Staging whitelist check — non-whitelisted numbers are rejected in staging.
    if (!isOnStagingWhitelist(normalized)) {
      return res.status(403).json({
        success: false,
        code:    'DEMO_RESTRICTED',
        message: 'This number is not approved for demo access.',
      });
    }

    const hmac = computeHmac(normalized);
    const existing = await prisma.user.findUnique({ where: { phoneNumberHmac: hmac } });

    if (!existing) {
      // New user — create a Ghost account and proceed to OTP.
      const encrypted = encrypt(normalized);
      await prisma.user.create({
        data: { phoneNumber: encrypted, phoneNumberHmac: hmac },
      });
    }

    const code = generateOtp();
    const devCode = await sendOtp(normalized, code);

    const response = { success: true, message: 'OTP sent.' };
    if (devCode) response.devCode = devCode;

    return res.status(200).json(response);
  } catch (err) {
    next(err);
  }
};

// POST /api/verify/phone/confirm
const confirmPhone = async (req, res, next) => {
  try {
    const { phoneNumber, code } = req.body;
    if (!phoneNumber || !code) {
      return res.status(400).json({ success: false, message: 'phoneNumber and code are required.' });
    }

    let normalized;
    try {
      normalized = normalizePhone(phoneNumber);
    } catch {
      return res.status(400).json({ success: false, code: 'INVALID_PHONE', message: 'Please enter a valid phone number.' });
    }

    const valid = validateOtp(normalized, code);
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    const hmac = computeHmac(normalized);

    // User must exist — created during initiate. Never create here.
    const existingUser = await prisma.user.findUnique({ where: { phoneNumberHmac: hmac } });
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'No account found for this phone number. Please start over.',
      });
    }

    let user = await prisma.user.update({
      where: { phoneNumberHmac: hmac },
      data:  { phoneVerified: true, phoneVerifiedAt: new Date() },
    });

    user = await computeAndSaveTier(user.id);
    const token = generateToken(user.id, user.currentTier);

    return res.status(200).json({
      success: true,
      message: 'Phone verified.',
      token,
      user: { id: user.id, currentTier: user.currentTier },
    });
  } catch (err) {
    next(err);
  }
};

// ── OAuth ─────────────────────────────────────────────────────────────────────

// Apple JWKS — cached with 1-hour TTL to avoid redundant fetches.
let _appleJwks = null;
function getAppleJwks() {
  if (!_appleJwks) {
    _appleJwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
  }
  return _appleJwks;
}

async function verifyAppleIdentityToken(token) {
  const clientId = process.env.APPLE_CLIENT_ID;

  if (!clientId) {
    if (process.env.NODE_ENV === 'production') {
      throw Object.assign(new Error('Apple Sign In is not available.'), { statusCode: 503 });
    }
    // Dev / staging stub — no Apple credentials configured.
    // Hash the token so the same test token always resolves to the same stub account,
    // and different tokens produce different accounts.
    const crypto = require('crypto');
    const stubSub = 'apple-stub-' + crypto.createHash('sha256').update(token).digest('hex').slice(0, 16);
    return stubSub;
  }

  const { payload } = await jwtVerify(token, getAppleJwks(), {
    issuer:   'https://appleid.apple.com',
    audience: clientId,
  });
  if (!payload.sub) throw new Error('Apple token missing sub claim.');
  return payload.sub;
}

// POST /api/verify/oauth  (also called from auth.controller for method=oauth)
const verifyOAuth = async (req, res, next) => {
  try {
    const { provider, token } = req.body;
    if (!provider || !token) {
      return res.status(400).json({ success: false, message: 'provider and token are required.' });
    }

    let oauthUserId;

    if (provider === 'google') {
      try {
        const axios = require('axios');
        const resp = await axios.get(
          `https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${token}`
        );
        oauthUserId = resp.data.sub;
        if (!oauthUserId) throw new Error('Missing sub in Google token response.');
      } catch (err) {
        if (err.response || !err.statusCode) {
          return res.status(401).json({ success: false, message: 'Invalid Google token.' });
        }
        throw err;
      }
    } else if (provider === 'apple') {
      try {
        oauthUserId = await verifyAppleIdentityToken(token);
      } catch (err) {
        if (err.statusCode === 503) return res.status(503).json({ success: false, message: err.message });
        return res.status(401).json({ success: false, message: 'Invalid Apple identity token.' });
      }
    } else {
      return res.status(400).json({ success: false, message: 'provider must be "google" or "apple".' });
    }

    // Look up user by HMAC of the provider sub — never by raw or encrypted sub.
    const subHmac      = computeHmac(oauthUserId);
    const encryptedSub = encrypt(oauthUserId);

    const existingUser = await prisma.user.findUnique({ where: { oauthSubHmac: subHmac } });

    // _isLoginOnly is set by auth.controller.login to enforce that the account must
    // already exist. Direct calls to /api/verify/oauth (the "Continue with" buttons)
    // and /api/auth/register always upsert — new users are created on first sign-in.
    if (!existingUser && req.body._isLoginOnly) {
      return res.status(404).json({
        success: false,
        message: 'No account found for this OAuth identity. Please sign up first.',
      });
    }

    let user = await prisma.user.upsert({
      where:  { oauthSubHmac: subHmac },
      update: { oauthProvider: provider, oauthVerifiedAt: new Date() },
      create: {
        oauthSub:        encryptedSub,
        oauthSubHmac:    subHmac,
        oauthProvider:   provider,
        oauthVerifiedAt: new Date(),
      },
    });

    user = await computeAndSaveTier(user.id);
    const jwtToken = generateToken(user.id, user.currentTier);

    return res.status(200).json({
      success: true,
      message: `${provider} OAuth verified.`,
      token: jwtToken,
      user: { id: user.id, currentTier: user.currentTier },
    });
  } catch (err) {
    next(err);
  }
};

// Alias for use by auth.controller
const verifyOAuthToken = verifyOAuth;

// ── Sprint 2 stubs ────────────────────────────────────────────────────────────

const zkPassportStub = (req, res) => {
  if (!features.ZK_PASSPORT) {
    return res.status(501).json({ success: false, message: 'ZK Passport verification not available in Sprint 1.' });
  }
};

const zkEmailStub = (req, res) => {
  if (!features.ZK_EMAIL) {
    return res.status(501).json({ success: false, message: 'ZK Email verification not available in Sprint 1.' });
  }
};

const pohStub = (req, res) => {
  if (!features.POH) {
    return res.status(501).json({ success: false, message: 'Proof of Humanity not available in Sprint 1.' });
  }
};

const ecoinmterStub = (req, res) => {
  if (!features.ECOINMTER) {
    return res.status(501).json({ success: false, message: 'Ecoinmter verification not available in Sprint 1.' });
  }
};

module.exports = {
  initiatePhone,
  confirmPhone,
  verifyOAuth,
  verifyOAuthToken,
  zkPassportStub,
  zkEmailStub,
  pohStub,
  ecoinmterStub,
};
