const prisma = require('../../shared/db/prisma');
const { generateOtp, sendOtp } = require('../../shared/utils/otp.util');
const { verifyOAuthToken } = require('../verify/verify.controller');

/**
 * POST /api/auth/register
 * POST /api/auth/login
 *
 * Both use the same passwordless upsert logic:
 *   method=otp  → upsert Ghost user, generate + send OTP
 *   method=oauth → delegate to OAuth verify (upsert + issue JWT)
 */
const register = async (req, res, next) => {
  try {
    const { method, phoneNumber, provider, token } = req.body;

    if (method === 'otp') {
      // Upsert Ghost user (phone unverified)
      await prisma.user.upsert({
        where: { phoneNumber },
        update: {},
        create: { phoneNumber },
      });

      const code = generateOtp();
      await sendOtp(phoneNumber, code);

      return res.status(200).json({
        success: true,
        message: 'OTP sent. Please verify your phone number.',
      });
    }

    if (method === 'oauth') {
      return verifyOAuthToken({ body: { provider, token } }, res, next);
    }

    return res.status(400).json({ success: false, message: 'Invalid method.' });
  } catch (err) {
    next(err);
  }
};

// login is identical to register (passwordless — same upsert semantics)
const login = register;

const logout = async (req, res) => {
  // Stateless JWT — client discards token. Endpoint exists for UX consistency.
  return res.status(200).json({ success: true, message: 'Logged out successfully.' });
};

module.exports = { register, login, logout };
