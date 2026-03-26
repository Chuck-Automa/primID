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

router.post(
  '/',
  authenticate,
  requireTier(2),
  rateLimitAttestations,
  [
    body('subjectUserId').isUUID().withMessage('subjectUserId must be a valid UUID'),
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
