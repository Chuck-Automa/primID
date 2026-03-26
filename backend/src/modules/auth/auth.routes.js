const express = require('express');
const rateLimit = require('express-rate-limit');
const { register, login, logout } = require('./auth.controller');
const { registerValidation, validateRequest } = require('./auth.validator');
const { authenticate } = require('../../shared/middleware/authenticate');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', authLimiter, registerValidation, validateRequest, register);
router.post('/login', authLimiter, registerValidation, validateRequest, login);
router.post('/logout', logout);

module.exports = router;
