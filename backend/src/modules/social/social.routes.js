const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  listSocialAccounts,
  addSocialAccount,
  removeSocialAccount,
  initiateSocialVerification,
} = require('./social.controller');
const { authenticate } = require('../../shared/middleware/authenticate');

const router = express.Router();

// Narrowest-scope rate limit — prevents challenge-row spam, not a security-critical
// gate (mirrors the phone /initiate limiter in verify.routes.js).
const initiateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { success: false, message: 'Too many verification attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip,
});

router.get('/',          authenticate, listSocialAccounts);
router.post('/',         authenticate, addSocialAccount);
router.patch('/:id/remove', authenticate, removeSocialAccount);
router.post('/:id/verify/initiate', authenticate, initiateLimiter, initiateSocialVerification);

module.exports = router;
