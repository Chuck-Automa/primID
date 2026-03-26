const prisma = require('../../shared/db/prisma');

// POST /api/attestations
const createAttestation = async (req, res, next) => {
  try {
    const { subjectUserId, attestationType } = req.body;

    if (!subjectUserId || !attestationType) {
      return res.status(400).json({
        success: false,
        message: 'subjectUserId and attestationType are required.',
      });
    }

    if (subjectUserId === req.userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot issue attestation to yourself.',
      });
    }

    // Verify subject exists
    const subject = await prisma.user.findUnique({ where: { id: subjectUserId } });
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject user not found.' });
    }

    // Farcaster Hub anchor: stubbed per Sprint 1
    // TODO Sprint 2: anchor to Farcaster Hub when features.FARCASTER_HUB is true

    const attestation = await prisma.attestation.create({
      data: {
        issuerId: req.userId,
        subjectId: subjectUserId,
        attestationType,
        // consentGivenAt, publicAt: null — pending consent
      },
    });

    return res.status(201).json({ success: true, attestation });
  } catch (err) {
    next(err);
  }
};

// GET /api/attestations?userId=
const listAttestations = async (req, res, next) => {
  try {
    const { userId } = req.query;

    // Only allow querying your own records. Ignore ?userId= if it differs from caller.
    const targetId = userId && userId === req.userId ? userId : req.userId;
    const where = { OR: [{ issuerId: targetId }, { subjectId: targetId }] };

    const attestations = await prisma.attestation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ success: true, attestations });
  } catch (err) {
    next(err);
  }
};

// GET /api/attestations/:id
const getAttestation = async (req, res, next) => {
  try {
    const attestation = await prisma.attestation.findUnique({
      where: { id: req.params.id },
    });

    if (!attestation) {
      return res.status(404).json({ success: false, message: 'Attestation not found.' });
    }

    if (attestation.issuerId !== req.userId && attestation.subjectId !== req.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    return res.status(200).json({ success: true, attestation });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/attestations/:id/consent
const giveConsent = async (req, res, next) => {
  try {
    const attestation = await prisma.attestation.findUnique({
      where: { id: req.params.id },
    });

    if (!attestation) {
      return res.status(404).json({ success: false, message: 'Attestation not found.' });
    }

    if (attestation.subjectId !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the subject can grant consent.',
      });
    }

    if (attestation.consentGivenAt) {
      return res.status(400).json({ success: false, message: 'Consent already given.' });
    }

    const now = new Date();
    const updated = await prisma.attestation.update({
      where: { id: req.params.id },
      data: { consentGivenAt: now, publicAt: now },
    });

    return res.status(200).json({ success: true, attestation: updated });
  } catch (err) {
    next(err);
  }
};

// POST /api/attestations/:id/revoke — sets revokedAt, never deletes
const revokeAttestation = async (req, res, next) => {
  try {
    const attestation = await prisma.attestation.findUnique({
      where: { id: req.params.id },
    });

    if (!attestation) {
      return res.status(404).json({ success: false, message: 'Attestation not found.' });
    }

    // Only issuer or subject may revoke
    if (attestation.issuerId !== req.userId && attestation.subjectId !== req.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to revoke.' });
    }

    if (attestation.revokedAt) {
      return res.status(400).json({ success: false, message: 'Attestation already revoked.' });
    }

    const updated = await prisma.attestation.update({
      where: { id: req.params.id },
      data: { revokedAt: new Date() },
    });

    return res.status(200).json({ success: true, attestation: updated });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createAttestation,
  listAttestations,
  getAttestation,
  giveConsent,
  revokeAttestation,
};
