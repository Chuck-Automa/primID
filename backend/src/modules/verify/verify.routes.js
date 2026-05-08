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
  ecoinmterStub,
} = require('./verify.controller');

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

// Sprint 2 stubs
router.post('/zkpassport', zkPassportStub);
router.post('/zkemail', zkEmailStub);
router.post('/poh', pohStub);
router.post('/ecoinmter', ecoinmterStub);

module.exports = router;
