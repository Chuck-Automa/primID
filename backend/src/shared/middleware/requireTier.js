const prisma = require('../db/prisma');

/**
 * requireTier(minTier) — enforce minimum tier level on a route.
 * Always re-reads currentTier from DB. Never trusts the JWT claim.
 * Tier 0 is highest trust; Ghost (null) is lowest.
 * minTier=2 means: user must be Tier 0, 1, or 2.
 */
const requireTier = (minTier) => async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { currentTier: true },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    const tier = user.currentTier;

    // Ghost (null) never passes any tier check
    if (tier === null || tier === undefined) {
      return res.status(403).json({
        success: false,
        message: `Tier ${minTier} or higher required.`,
      });
    }

    // Lower number = higher trust. tier <= minTier means sufficient access.
    if (tier <= minTier) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Tier ${minTier} or higher required. Your current tier: ${tier}.`,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { requireTier };
