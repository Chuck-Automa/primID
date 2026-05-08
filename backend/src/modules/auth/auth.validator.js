const { body, validationResult } = require('express-validator');

// Phone validation: only check that the value starts with '+' and is non-empty.
// Full E.164 validation (libphonenumber-js) happens in the controller via normalizePhone().
const registerValidation = [
  body('method')
    .isIn(['phone', 'oauth'])
    .withMessage('method must be "phone" or "oauth"'),
  body('phoneNumber')
    .if(body('method').equals('phone'))
    .notEmpty()
    .withMessage('phoneNumber is required')
    .bail()
    .matches(/^\+/)
    .withMessage('Please enter a valid phone number.'),
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
