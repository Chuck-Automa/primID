const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { validateRequest } = require('../auth/auth.validator');
const { authenticate } = require('../../shared/middleware/authenticate');
const {
  initiatePhone,
  getPhoneStatus,
  verifyOAuth,
  zkPassportStub,
  zkEmailStub,
  pohStub,
  ecointerStub,
} = require('./verify.controller');
const { crawlSocialAccount } = require('./category-b/crawl.controller');

const router = express.Router();

const initiateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { success: false, message: 'Too many verification attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body.phoneNumber || req.ip,
});

// Inverted phone challenge — pre-check that phoneNumber starts with '+'; full validation in normalizePhone().
router.post(
  '/phone/initiate',
  initiateLimiter,
  [body('phoneNumber').matches(/^\+/).withMessage('Please enter a valid phone number.')],
  validateRequest,
  initiatePhone
);

router.get('/phone/status/:challengeId', getPhoneStatus);

// OAuth — authenticate required; this is an upgrade path for existing users only
router.post(
  '/oauth',
  authenticate,
  [
    body('provider').isIn(['google', 'apple']).withMessage('provider must be "google" or "apple"'),
    body('token').notEmpty().withMessage('token is required'),
  ],
  validateRequest,
  verifyOAuth
);

// Category B (post-and-crawl) — narrowest-scope rate limit, one crawl per
// click is the expected cadence; this just guards against a stuck/looping frontend.
const crawlLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 6,
  message: { success: false, message: 'Too many verification attempts. Please wait a moment and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.userId}:${req.params.socialAccountId}`,
});
router.post('/social/:socialAccountId/crawl', authenticate, crawlLimiter, crawlSocialAccount);

// Sprint 2 stubs — QV endpoints namespaced under /qv/
router.post('/qv/zkpassport', zkPassportStub);
router.post('/qv/zkemail', zkEmailStub);
router.post('/qv/poh', pohStub);
router.post('/qv/ecointer', ecointerStub);

module.exports = router;
