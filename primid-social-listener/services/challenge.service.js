const prisma = require('../../backend/src/shared/db/prisma');
const { computeHmac } = require('../../backend/src/shared/utils/crypto.util');

/**
 * Validate an incoming challenge code and mark it used.
 * All DB operations run inside a single transaction.
 *
 * Security rule: the HMAC comparison against social_accounts.handle_hmac is the
 * authoritative identity check. Never compare against the ALE-encrypted handle column.
 */
async function validateAndMark({ code, senderHandle, platform }) {
  await prisma.$transaction(async (tx) => {
    // Step 1: look up the challenge — must be unused and unexpired.
    const challenge = await tx.verificationChallenge.findFirst({
      where: { code, usedAt: null, expiresAt: { gt: new Date() } },
    });

    if (!challenge) {
      console.log(`[challenge-service] MISS code_prefix=${code.slice(0, 3)} platform=${platform} reason=NOT_FOUND_OR_EXPIRED`);
      return;
    }

    // Step 2: confirm platform matches.
    if (challenge.platform !== platform) {
      console.log(`[challenge-service] MISS code_prefix=${code.slice(0, 3)} platform=${platform} reason=PLATFORM_MISMATCH`);
      return;
    }

    // Step 3: confirm sender handle via HMAC — the security check.
    const incomingHmac = computeHmac(senderHandle);
    const socialAccount = await tx.socialAccount.findUnique({
      where:  { id: challenge.socialAccountId },
      select: { handleHmac: true },
    });

    if (!socialAccount || socialAccount.handleHmac === null) {
      console.log(`[challenge-service] MISS code_prefix=${code.slice(0, 3)} platform=${platform} reason=HANDLE_HMAC_NOT_SET`);
      return;
    }

    if (incomingHmac !== socialAccount.handleHmac) {
      console.log(`[challenge-service] MISS code_prefix=${code.slice(0, 3)} platform=${platform} reason=HANDLE_MISMATCH`);
      return;
    }

    // Step 4: mark used and set verified_at — both writes in the same transaction.
    await tx.verificationChallenge.update({
      where: { id: challenge.id },
      data:  { usedAt: new Date() },
    });

    await tx.socialAccount.update({
      where: { id: challenge.socialAccountId },
      data:  { verifiedAt: new Date() },
    });

    console.log(`[challenge-service] VERIFIED code_prefix=${code.slice(0, 3)} platform=${platform}`);
  });
}

module.exports = { validateAndMark };
