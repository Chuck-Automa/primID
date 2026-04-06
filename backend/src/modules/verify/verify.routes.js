const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { validateRequest } = require('../auth/auth.validator');
const {
  initiatePhone,
  confirmPhone,
  verifyOAuth,
  zkPassportStub,
  zkEmailStub,
  pohStub,
  ecoinmterStub,
} = require('./verify.controller');

const router = express.Router();

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many OTP attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body.phoneNumber || req.ip,
});

// Phone OTP — pre-check that phoneNumber starts with '+'; full validation in normalizePhone().
router.post(
  '/phone/initiate',
  [body('phoneNumber').matches(/^\+/).withMessage('Please enter a valid phone number.')],
  validateRequest,
  initiatePhone
);

router.post(
  '/phone/confirm',
  otpLimiter,
  [
    body('phoneNumber').matches(/^\+/).withMessage('Please enter a valid phone number.'),
    body('code').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  ],
  validateRequest,
  confirmPhone
);

// OAuth
router.post(
  '/oauth',
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
