const { body, validationResult } = require('express-validator');

const registerValidation = [
  body('method')
    .isIn(['otp', 'oauth'])
    .withMessage('method must be "otp" or "oauth"'),
  body('phoneNumber')
    .if(body('method').equals('otp'))
    .isMobilePhone()
    .withMessage('A valid phone number is required for OTP registration'),
  body('provider')
    .if(body('method').equals('oauth'))
    .isIn(['google', 'apple'])
    .withMessage('provider must be "google" or "apple"'),
  body('token')
    .if(body('method').equals('oauth'))
    .notEmpty()
    .withMessage('OAuth token is required'),
];

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

module.exports = { registerValidation, validateRequest };
