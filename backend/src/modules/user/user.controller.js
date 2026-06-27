const prisma = require('../../shared/db/prisma');
const { eraseUser } = require('../../shared/services/erasure.service');

// GET /api/user/me
const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        displayName: user.displayName,
        phoneVerified: user.phoneVerified,
        phoneVerifiedAt: user.phoneVerifiedAt,
        oauthProvider: user.oauthProvider,
        oauthVerifiedAt: user.oauthVerifiedAt,
        // biometricLastUsedAt: exposed as boolean only — never as timestamp
        biometricEverUsed: !!user.biometricLastUsedAt,
        zkPassportVerified: user.zkPassportVerified,
        zkPassportVerifiedAt: user.zkPassportVerifiedAt,
        zkEmailVerified: user.zkEmailVerified,
        zkEmailVerifiedAt: user.zkEmailVerifiedAt,
        pohVerified: user.pohVerified,
        pohVerifiedAt: user.pohVerifiedAt,
        ecointerVerified: user.ecointerVerified,
        ecointerVerifiedAt: user.ecointerVerifiedAt,
        currentTier: user.currentTier,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/user/me — profile updates only; allowed: displayName
const updateMe = async (req, res, next) => {
  try {
    const forbidden = [
      'currentTier', 'phoneVerified', 'phoneVerifiedAt',
      'oauthProvider', 'oauthVerifiedAt', 'biometricLastUsedAt',
      'zkPassportVerified', 'zkPassportVerifiedAt', 'zkEmailVerified',
      'zkEmailVerifiedAt', 'pohVerified', 'pohVerifiedAt',
      'ecointerVerified', 'ecointerVerifiedAt', 'walletAddress',
    ];

    const attempted = forbidden.filter((f) => f in req.body);
    if (attempted.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot update restricted fields: ${attempted.join(', ')}`,
      });
    }

    const updates = {};

    if ('displayName' in req.body) {
      const raw = req.body.displayName;
      if (raw === null || raw === undefined) {
        updates.displayName = null;
      } else if (typeof raw !== 'string') {
        return res.status(400).json({ success: false, message: 'displayName must be a string or null.' });
      } else {
        const trimmed = raw.trim();
        if (trimmed.length === 0) {
          updates.displayName = null;
        } else if (trimmed.length > 50) {
          return res.status(400).json({ success: false, message: 'displayName must be 50 characters or fewer.' });
        } else {
          updates.displayName = trimmed;
        }
      }
    }

    const user = Object.keys(updates).length > 0
      ? await prisma.user.update({ where: { id: req.userId }, data: updates })
      : await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        displayName: user.displayName,
        currentTier: user.currentTier,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/user/me — GDPR right to erasure
const deleteMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.userId },
      select: { gdprErasedAt: true },
    });

    if (!user || user.gdprErasedAt !== null) {
      return res.status(410).json({ success: false, code: 'ACCOUNT_ERASED', message: 'This account no longer exists.' });
    }

    await eraseUser(req.userId);
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
};

module.exports = { getMe, updateMe, deleteMe };
