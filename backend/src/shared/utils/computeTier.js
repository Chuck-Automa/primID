const prisma = require('../db/prisma');

/**
 * Compute tier from user verification booleans (pure function, no DB).
 * Returns integer 0-3 or null (Ghost).
 */
function computeTierFromUser(user) {
  const zkCount = [
    user.zkPassportVerified,
    user.zkEmailVerified,
    user.pohVerified,
    user.ecointerVerified,
  ].filter(Boolean).length;

  if (zkCount >= 2) return 0;
  if (zkCount >= 1) return 1;
  if (user.oauthVerifiedAt) return 2;
  if (user.phoneVerified) return 3;
  return null; // Ghost
}

/**
 * Read user from DB, compute tier, write currentTier back, return updated user.
 */
async function computeAndSaveTier(userId) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const tier = computeTierFromUser(user);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { currentTier: tier },
  });
  return updated;
}

module.exports = { computeTierFromUser, computeAndSaveTier };
