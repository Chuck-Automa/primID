const prisma = require('../../shared/db/prisma');
const axios = require('axios');
const { validateOtp, generateOtp, sendOtp } = require('../../shared/utils/otp.util');
const { computeAndSaveTier } = require('../../shared/utils/computeTier');
const { generateToken } = require('../../shared/utils/jwt.util');
const features = require('../../shared/flags/features');

// POST /api/verify/phone/initiate
const initiatePhone = async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: 'phoneNumber is required.' });
    }

    // Ensure user record exists (Ghost)
    await prisma.user.upsert({
      where: { phoneNumber },
      update: {},
      create: { phoneNumber },
    });

    const code = generateOtp();
    const devCode = await sendOtp(phoneNumber, code);

    const response = { success: true, message: 'OTP sent.' };
    if (devCode) response.devCode = devCode; // only present when Twilio is not configured

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

    const valid = validateOtp(phoneNumber, code);
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    // Mark phone verified
    let user = await prisma.user.upsert({
      where: { phoneNumber },
      update: {
        phoneVerified: true,
        phoneVerifiedAt: new Date(),
      },
      create: {
        phoneNumber,
        phoneVerified: true,
        phoneVerifiedAt: new Date(),
      },
    });

    // Compute and save tier
    user = await computeAndSaveTier(user.id);

    const token = generateToken(user.id, user.currentTier);

    return res.status(200).json({
      success: true,
      message: 'Phone verified.',
      token,
      user: {
        id: user.id,
        tier: user.currentTier,
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/verify/oauth  (also called from auth.controller for method=oauth)
const verifyOAuth = async (req, res, next) => {
  try {
    const { provider, token } = req.body;
    if (!provider || !token) {
      return res.status(400).json({ success: false, message: 'provider and token are required.' });
    }

    let oauthUserId, email;

    if (provider === 'google') {
      try {
        const resp = await axios.get(
          `https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${token}`
        );
        oauthUserId = resp.data.sub;
        email = resp.data.email;
      } catch {
        return res.status(401).json({ success: false, message: 'Invalid Google token.' });
      }
    } else if (provider === 'apple') {
      // Apple token verification requires JWT decoding + Apple public key fetch.
      // In dev/test, accept a stub token "apple_test_token" for convenience.
      if (process.env.NODE_ENV === 'development' && token === 'apple_test_token') {
        oauthUserId = 'apple_dev_stub_id';
        email = null;
      } else {
        // TODO Sprint 2: implement full Apple Sign-In JWT verification
        return res.status(501).json({
          success: false,
          message: 'Apple Sign-In full verification not yet implemented.',
        });
      }
    } else {
      return res.status(400).json({ success: false, message: 'provider must be "google" or "apple".' });
    }

    // Upsert user by a stable lookup key.
    // For Google, we use a dedicated oauthId lookup approach.
    // Since our schema uses phoneNumber as unique, we use a synthetic phone-like key
    // or we look up by oauthProvider+oauthId. Since schema doesn't have oauthId field,
    // we'll use a combination: find any user with matching oauthProvider where
    // we store oauthUserId in a lookup. For Sprint 1, we create/find by a
    // deterministic synthetic identifier stored as phone_number.
    // The cleanest approach with our schema: store oauthUserId as phoneNumber with prefix.
    // This avoids a schema migration and works correctly for Sprint 1.
    const phoneKey = `oauth:${provider}:${oauthUserId}`;

    let user = await prisma.user.upsert({
      where: { phoneNumber: phoneKey },
      update: {
        oauthProvider: provider,
        oauthVerifiedAt: new Date(),
      },
      create: {
        phoneNumber: phoneKey,
        oauthProvider: provider,
        oauthVerifiedAt: new Date(),
      },
    });

    user = await computeAndSaveTier(user.id);
    const jwtToken = generateToken(user.id, user.currentTier);

    return res.status(200).json({
      success: true,
      message: `${provider} OAuth verified.`,
      token: jwtToken,
      user: {
        id: user.id,
        tier: user.currentTier,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Alias for use by auth.controller
const verifyOAuthToken = verifyOAuth;

// Sprint 2 stubs — return 501 if feature flag is off
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
