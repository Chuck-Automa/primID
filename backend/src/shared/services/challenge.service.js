const prisma = require('../db/prisma');
const { computeHmac } = require('../utils/crypto.util');

// Shared "mark used" step for both channels — always runs inside the caller's
// transaction, always sets resolvedVia in the same write that sets usedAt.
async function _markUsed(tx, challengeId, resolvedVia) {
  await tx.challenge.update({
    where: { id: challengeId },
    data:  { usedAt: new Date(), resolvedVia },
  });
}

/**
 * Validate an incoming social challenge code (DM or crawl-discovered artifact)
 * and mark it used. All DB operations run inside a single transaction.
 *
 * Security rule: the HMAC comparison against social_accounts.handle_hmac is the
 * authoritative identity check. Never compare against the ALE-encrypted handle column.
 *
 * Returns true if the challenge was validated and marked used, false on any miss
 * (not found/expired, platform mismatch, or handle mismatch) — callers that need
 * to react to the outcome (e.g. a Category A adapter's reply, a Category B crawl
 * controller's response) use this return value rather than re-deriving it.
 */
async function validateAndMarkSocial({ code, senderHandle, platform }) {
  let verified = false;

  await prisma.$transaction(async (tx) => {
    // Step 1: look up the challenge — must be unused and unexpired.
    const challenge = await tx.challenge.findFirst({
      where: { code, channel: 'social', usedAt: null, expiresAt: { gt: new Date() } },
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

    // Step 4: mark used (resolvedVia stays null for social — see schema.prisma
    // comment) and set verified_at — both writes in the same transaction.
    await _markUsed(tx, challenge.id, null);

    await tx.socialAccount.update({
      where: { id: challenge.socialAccountId },
      data:  { verifiedAt: new Date() },
    });

    verified = true;
    console.log(`[challenge-service] VERIFIED code_prefix=${code.slice(0, 3)} platform=${platform}`);
  });

  return verified;
}

/**
 * Validate an incoming phone challenge code and mark it used.
 * senderHandle is the already-normalized E.164 sender number.
 *
 * Security rule: the HMAC comparison against the challenge's own phoneNumberHmac
 * is the authoritative identity check — the FROM-vs-expected match. This is the
 * security property for inverted-SMS phone verification.
 */
async function validateAndMarkPhone({ code, senderHandle }) {
  await prisma.$transaction(async (tx) => {
    const challenge = await tx.challenge.findFirst({
      where: { code, channel: 'phone', usedAt: null, expiresAt: { gt: new Date() } },
    });

    if (!challenge) {
      console.log(`[challenge-service] MISS code_prefix=${code.slice(0, 3)} channel=phone reason=NOT_FOUND_OR_EXPIRED`);
      return;
    }

    const incomingHmac = computeHmac(senderHandle);
    if (incomingHmac !== challenge.phoneNumberHmac) {
      console.log(`[challenge-service] MISS code_prefix=${code.slice(0, 3)} channel=phone reason=PHONE_MISMATCH`);
      return;
    }

    await _markUsed(tx, challenge.id, 'sms');

    console.log(`[challenge-service] VERIFIED code_prefix=${code.slice(0, 3)} channel=phone`);
  });
}

module.exports = { validateAndMarkSocial, validateAndMarkPhone };
