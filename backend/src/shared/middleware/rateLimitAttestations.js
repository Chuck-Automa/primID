const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Enforces attestation issuance caps:
 *   - 13 per rolling 13-day window
 *   - 30 per rolling 30-day window
 * Applied only to POST /api/attestations.
 */
const rateLimitAttestations = async (req, res, next) => {
  try {
    const userId = req.userId;
    const now = new Date();

    const thirteenDaysAgo = new Date(now);
    thirteenDaysAgo.setDate(thirteenDaysAgo.getDate() - 13);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [count13, count30] = await Promise.all([
      prisma.attestation.count({
        where: {
          issuerId: userId,
          createdAt: { gte: thirteenDaysAgo },
        },
      }),
      prisma.attestation.count({
        where: {
          issuerId: userId,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
    ]);

    if (count13 >= 13) {
      return res.status(429).json({
        success: false,
        message: 'Attestation limit reached: 13 per 13-day window.',
      });
    }

    if (count30 >= 30) {
      return res.status(429).json({
        success: false,
        message: 'Attestation limit reached: 30 per 30-day window.',
      });
    }

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { rateLimitAttestations };
