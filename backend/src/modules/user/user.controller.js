const prisma = require('../../shared/db/prisma');

// GET /api/user/me
const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
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
        ecoinmterVerified: user.ecoinmterVerified,
        ecoinmterVerifiedAt: user.ecoinmterVerifiedAt,
        currentTier: user.currentTier,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/user/me — profile updates only, no tier/verification fields
const updateMe = async (req, res, next) => {
  try {
    // Whitelist: only allow safe profile fields
    // In Sprint 1, no profile fields exist beyond what's verified.
    // We'll accept no-op updates and return the current user.
    // Reject any attempt to modify tier or verification fields.
    const forbidden = [
      'currentTier', 'phoneVerified', 'phoneVerifiedAt',
      'oauthProvider', 'oauthVerifiedAt', 'biometricLastUsedAt',
      'zkPassportVerified', 'zkPassportVerifiedAt', 'zkEmailVerified',
      'zkEmailVerifiedAt', 'pohVerified', 'pohVerifiedAt',
      'ecoinmterVerified', 'ecoinmterVerifiedAt', 'walletAddress',
    ];

    const attempted = forbidden.filter((f) => f in req.body);
    if (attempted.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot update restricted fields: ${attempted.join(', ')}`,
      });
    }

    // No non-restricted profile fields defined in Sprint 1 schema.
    // Return current user unchanged.
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        currentTier: user.currentTier,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getMe, updateMe };
