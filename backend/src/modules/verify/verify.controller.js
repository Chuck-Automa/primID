const prisma = require('../../shared/db/prisma');
const { createRemoteJWKSet, jwtVerify } = require('jose');
const { generateCode, isOnStagingWhitelist } = require('../../shared/utils/otp.util');
const { computeAndSaveTier } = require('../../shared/utils/computeTier');
const { generateAccessToken, generateRefreshToken, hashToken } = require('../../shared/utils/jwt.util');
const { normalizePhone, computeHmac, encrypt } = require('../../shared/utils/crypto.util');
const features = require('../../shared/flags/features');

const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const CHALLENGE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Evaluated at startup — cannot activate in prod even if env vars are present.
const AUTO_RESOLVE_ENABLED = process.env.NODE_ENV !== 'production';

function setRefreshCookie(res, rawToken) {
  res.cookie('primid_rt', rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'test',
    sameSite: 'None',
    maxAge: REFRESH_TOKEN_TTL_MS,
    path: '/api/auth',
  });
}

// ── Phone challenge (inverted flow) ──────────────────────────────────────────

// POST /api/verify/phone/initiate
// Returns {challengeId, listenerNumber, code[, maintenanceNotice]}. The user texts
// the code to the listener number; the server marks usedAt when the SMS arrives
// (or auto-resolves it, in the stub branches below). No outbound SMS, ever.
//
// Three-branch routing, checked in this order (order is load-bearing — see
// CLAUDE.md §15 and CLAUDE_SOCIAL_VERIFICATION.md):
//   1. Whitelisted number  → auto-resolve stub, unconditional (ignores the flag
//      and heartbeat entirely — demo continuity never depends on device state).
//   2. Not whitelisted, FEATURE_PHONE_VERIFICATION_LIVE off → 403 DEMO_RESTRICTED,
//      no row created. The flag is the sole live-path access control.
//   3. Not whitelisted, flag on → check the phone listener heartbeat:
//        fresh  → live path, resolved later by a real inbound SMS.
//        stale, NODE_ENV=production → 503, no row created (prod fails closed, always).
//        stale, non-production      → stub-fallback (same auto-resolve mechanics as
//          branch 1) plus an additive maintenanceNotice field.
const initiatePhone = async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: 'phoneNumber is required.' });
    }

    // E.164 normalization — always before HMAC or encryption.
    let normalized;
    try {
      normalized = normalizePhone(phoneNumber);
    } catch {
      return res.status(400).json({ success: false, code: 'INVALID_PHONE', message: 'Please enter a valid phone number.' });
    }

    // isOnStagingWhitelist() returns true unconditionally when NODE_ENV !== 'development'
    // (see otp.util.js) — an intentional, tested contract that predates this feature.
    // Branches 2 and 3 below are therefore only reachable when NODE_ENV=development;
    // outside that value every number is treated as whitelisted (branch 1), matching
    // the "unset: all stubs" / "prod: no live phone verification yet" posture. The
    // NODE_ENV=production check inside branch 3 is defensive code for once Telnyx
    // activates in prod (Sprint 2) and this interaction is revisited.
    const whitelisted = isOnStagingWhitelist(normalized);

    // Branch 2 — reject before any DB write.
    if (!whitelisted && process.env.FEATURE_PHONE_VERIFICATION_LIVE !== 'true') {
      return res.status(403).json({
        success: false,
        code:    'DEMO_RESTRICTED',
        message: 'This number is not approved for demo access.',
      });
    }

    // Branch 3 — heartbeat staleness check. Read fresh on every call (no caching)
    // so heartbeat recovery takes effect on the very next call with no manual reset.
    let heartbeatStale = false;
    if (!whitelisted) {
      const status = await prisma.listenerStatus.findUnique({
        where: { provider: process.env.PHONE_LISTENER_PROVIDER || 'stub' },
      });
      const staleAfterS = Number(process.env.ANDROID_HEARTBEAT_STALE_AFTER_S) || 600;
      heartbeatStale = !status || (Date.now() - new Date(status.lastSeenAt).getTime()) / 1000 > staleAfterS;

      if (heartbeatStale && process.env.NODE_ENV === 'production') {
        return res.status(503).json({ success: false, code: 'PHONE_VERIFICATION_UNAVAILABLE' });
      }
    }

    const hmac = computeHmac(normalized);
    let user = await prisma.user.findUnique({ where: { phoneNumberHmac: hmac } });

    if (!user) {
      const encrypted = encrypt(normalized);
      user = await prisma.user.create({
        data: { phoneNumber: encrypted, phoneNumberHmac: hmac },
      });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

    const challenge = await prisma.challenge.create({
      data: { userId: user.id, channel: 'phone', phoneNumberHmac: hmac, code, expiresAt },
    });

    // Stub path applies to branch 1 (whitelisted) and branch 3's stale-heartbeat
    // degrade (3c) — both auto-resolve server-side rather than waiting on a real SMS.
    const isStubPath = whitelisted || heartbeatStale;
    if (AUTO_RESOLVE_ENABLED && isStubPath) {
      const delayMs = parseInt(process.env.STAGING_PHONE_STUB_DELAY_MS) || 3000;
      const resolvedVia = whitelisted ? 'stub_demo' : 'stub_fallback';
      setTimeout(async () => {
        try {
          await prisma.challenge.updateMany({
            where: { id: challenge.id, usedAt: null },
            data:  { usedAt: new Date(), resolvedVia },
          });
        } catch {
          // Swallow — challenge may have expired or been consumed already.
        }
      }, delayMs);
    }

    const listenerNumber = whitelisted
      ? 'STAGING'
      : (process.env.ANDROID_LISTENER_NUMBER || process.env.LISTENER_NUMBER || 'STAGING');

    const response = { success: true, challengeId: challenge.id, listenerNumber, code };
    if (!whitelisted && heartbeatStale && process.env.PHONE_MAINTENANCE_NOTICE) {
      response.maintenanceNotice = process.env.PHONE_MAINTENANCE_NOTICE;
    }

    return res.status(200).json(response);
  } catch (err) {
    next(err);
  }
};

// GET /api/verify/phone/status/:challengeId
// Polls whether the user has texted the code to the listener number.
// On usedAt set: marks phone verified, computes tier, issues 24h JWT.
// Polls identically regardless of which /initiate branch created the row.
const getPhoneStatus = async (req, res, next) => {
  try {
    const { challengeId } = req.params;

    const challenge = await prisma.challenge.findFirst({
      where: { id: challengeId, channel: 'phone', expiresAt: { gt: new Date() } },
    });

    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge not found or expired.' });
    }

    if (!challenge.usedAt) {
      return res.status(200).json({ success: true, verified: false });
    }

    // Challenge confirmed — mark phone verified and issue 24h token.
    let user = await prisma.user.findUnique({ where: { id: challenge.userId } });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (user.gdprErasedAt) {
      return res.status(410).json({ success: false, message: 'Account no longer exists.' });
    }

    user = await prisma.user.update({
      where: { id: user.id },
      data:  { phoneVerified: true, phoneVerifiedAt: user.phoneVerifiedAt ?? new Date() },
    });

    user = await computeAndSaveTier(user.id);
    const accessToken = generateAccessToken(user.id, user.currentTier);

    return res.status(200).json({
      success:     true,
      verified:    true,
      accessToken,
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
    // Dev / staging stub — hash the token so the same test token always resolves to the
    // same stub account, and different tokens produce different accounts.
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
// Issues access token (15 min) + refresh token (90 days) for Tier 2+ users.
const verifyOAuth = async (req, res, next) => {
  try {
    const { provider, token } = req.body;
    if (!provider || !token) {
      return res.status(400).json({ success: false, message: 'provider and token are required.' });
    }

    let oauthUserId;

    if (provider === 'google') {
      try {
        const tokeninfoResp = await fetch(
          `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`
        );
        if (!tokeninfoResp.ok) {
          return res.status(401).json({ success: false, message: 'Invalid Google token.' });
        }
        const tokeninfo = await tokeninfoResp.json();
        if (tokeninfo.aud !== process.env.GOOGLE_CLIENT_ID) {
          return res.status(401).json({ success: false, message: 'Invalid Google token.' });
        }
        oauthUserId = tokeninfo.sub;
        if (!oauthUserId) throw new Error('Missing sub in Google tokeninfo response.');
      } catch (err) {
        if (!err.statusCode) {
          return res.status(401).json({ success: false, message: 'Invalid Google token.' });
        }
        throw err;
      }
    } else if (provider === 'apple') {
      try {
        if (!process.env.APPLE_CLIENT_ID) {
          if (process.env.NODE_ENV === 'production') {
            return res.status(503).json({ success: false, message: 'Apple Sign In is not available.' });
          }
          const stubSeed = req.userId || token;
          const crypto = require('crypto');
          oauthUserId = `apple-stub-${crypto.createHash('sha256').update(stubSeed).digest('hex').slice(0, 16)}`;
        } else {
          oauthUserId = await verifyAppleIdentityToken(token);
        }
      } catch (err) {
        if (err.statusCode === 503) return res.status(503).json({ success: false, message: err.message });
        return res.status(401).json({ success: false, message: 'Invalid Apple identity token.' });
      }
    } else {
      return res.status(400).json({ success: false, message: 'provider must be "google" or "apple".' });
    }

    const subHmac      = computeHmac(oauthUserId);
    const encryptedSub = encrypt(oauthUserId);

    const existingUser = await prisma.user.findUnique({ where: { oauthSubHmac: subHmac } });

    let user;

    if (req.userId) {
      // Authenticated upgrade path (POST /api/verify/oauth from OAuthVerify page).
      if (existingUser && existingUser.id !== req.userId) {
        return res.status(409).json({
          success: false,
          message: 'This OAuth identity is already linked to another account.',
        });
      }
      user = await prisma.user.update({
        where: { id: req.userId },
        data: {
          oauthSub:        encryptedSub,
          oauthSubHmac:    subHmac,
          oauthProvider:   provider,
          oauthVerifiedAt: new Date(),
        },
      });
    } else {
      // Unauthenticated registration/login path (called from auth.controller).
      if (!existingUser && req.body._isLoginOnly) {
        return res.status(404).json({
          success: false,
          message: 'No account found for this OAuth identity. Please sign up first.',
        });
      }
      user = await prisma.user.upsert({
        where:  { oauthSubHmac: subHmac },
        update: { oauthProvider: provider, oauthVerifiedAt: new Date() },
        create: {
          oauthSub:        encryptedSub,
          oauthSubHmac:    subHmac,
          oauthProvider:   provider,
          oauthVerifiedAt: new Date(),
        },
      });
    }

    user = await computeAndSaveTier(user.id);

    const accessToken  = generateAccessToken(user.id, user.currentTier);
    const rawRefresh   = generateRefreshToken();
    const tokenHash    = hashToken(rawRefresh);
    const expiresAt    = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await prisma.refreshToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    setRefreshCookie(res, rawRefresh);

    return res.status(200).json({
      success: true,
      message: `${provider} OAuth verified.`,
      accessToken,
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

const ecointerStub = (req, res) => {
  if (!features.ECOINTER) {
    return res.status(501).json({ success: false, message: 'Ecointer verification not available in Sprint 1.' });
  }
};

module.exports = {
  initiatePhone,
  getPhoneStatus,
  verifyOAuth,
  verifyOAuthToken,
  zkPassportStub,
  zkEmailStub,
  pohStub,
  ecointerStub,
  setRefreshCookie,
  REFRESH_TOKEN_TTL_MS,
};
