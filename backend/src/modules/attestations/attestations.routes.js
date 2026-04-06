const express = require('express');
const { body } = require('express-validator');
const { validateRequest } = require('../auth/auth.validator');
const {
  createAttestation,
  listAttestations,
  getAttestation,
  giveConsent,
  revokeAttestation,
} = require('./attestations.controller');
const { authenticate } = require('../../shared/middleware/authenticate');
const { requireTier } = require('../../shared/middleware/requireTier');
const { rateLimitAttestations } = require('../../shared/middleware/rateLimitAttestations');

const router = express.Router();

const VALID_PLATFORMS = [
  'facebook', 'x', 'signal', 'telegram', 'linkedin', 'instagram',
  'farcaster', 'nostr', 'bluesky', 'github', 'bitchat',
];

router.post(
  '/',
  authenticate,
  requireTier(2),
  rateLimitAttestations,
  [
    // Accept either subjectUserId (UUID) OR platform + handle — not both, not neither.
    body().custom((body) => {
      const hasDirect = !!body.subjectUserId;
      const hasHandleLookup = !!(body.platform && body.handle);
      if (!hasDirect && !hasHandleLookup) {
        throw new Error('Provide either subjectUserId or both platform and handle.');
      }
      if (hasDirect && hasHandleLookup) {
        throw new Error('Provide subjectUserId or platform+handle, not both.');
      }
      return true;
    }),
    body('subjectUserId')
      .if((value, { req }) => !!req.body.subjectUserId)
      .isUUID().withMessage('subjectUserId must be a valid UUID'),
    body('platform')
      .if((value, { req }) => !!req.body.platform)
      .isIn(VALID_PLATFORMS).withMessage(`platform must be one of: ${VALID_PLATFORMS.join(', ')}`),
    body('handle')
      .if((value, { req }) => !!req.body.handle)
      .notEmpty().withMessage('handle is required when using platform lookup'),
    body('attestationType').notEmpty().withMessage('attestationType is required'),
  ],
  validateRequest,
  createAttestation
);

router.get('/', authenticate, listAttestations);
router.get('/:id', authenticate, getAttestation);
router.patch('/:id/consent', authenticate, giveConsent);
router.post('/:id/revoke', authenticate, revokeAttestation);

module.exports = router;
