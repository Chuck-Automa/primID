const prisma = require('../db/prisma');

/**
 * Erase a user per GDPR Article 17.
 *
 * Sequence (per CLAUDE_GDPR.md):
 *   1. KMS key deletion (production only — skipped in dev when ALE_KMS_KEY_ARN is not set)
 *   2. DB transaction: null PII fields on users + social_accounts + social_handle_conflicts,
 *      revoke refresh tokens, set tombstone marker
 *
 * KMS call happens BEFORE the transaction. If KMS fails, abort without touching the DB.
 * Never call this function inline in a controller — always call eraseUser(userId).
 */
async function eraseUser(userId) {
  // ── 1. KMS key deletion ───────────────────────────────────────────────────
  // Production: delete the per-user data key so all ciphertexts become permanently unrecoverable.
  // Dev/staging: ALE_KMS_KEY_ARN is not set — skip KMS step (plaintext erasure only).
  if (process.env.ALE_KMS_KEY_ARN) {
    // TODO (pre-prod): implement KMS key deletion.
    // const { KMSClient, ScheduleKeyDeletionCommand } = require('@aws-sdk/client-kms');
    // const client = new KMSClient({ region: process.env.AWS_REGION });
    // await client.send(new ScheduleKeyDeletionCommand({
    //   KeyId: <per-user key ARN for userId>,
    //   PendingWindowInDays: 7,
    // }));
    throw new Error('KMS per-user key deletion not yet implemented. Implement before production launch.');
  }

  // ── 2. DB transaction ─────────────────────────────────────────────────────
  await prisma.$transaction(async (tx) => {
    // Collect the user's social account IDs before nulling (needed for conflict table).
    const accountIds = await tx.socialAccount.findMany({
      where:  { userId },
      select: { id: true },
    }).then((rows) => rows.map((r) => r.id));

    // Null PII fields on users row.
    await tx.user.update({
      where: { id: userId },
      data: {
        phoneNumber:    null,
        phoneNumberHmac: null,
        oauthSub:       null,
        oauthSubHmac:   null,
        displayName:    null,
        oauthProvider:  null,
      },
    });

    // Null handle data on all social_accounts rows for this user.
    await tx.socialAccount.updateMany({
      where: { userId },
      data: {
        handle:       null,
        handleHmac:   null,
        handleSearch: null,
      },
    });

    // Null handle on social_handle_conflicts rows involving this user's accounts.
    if (accountIds.length > 0) {
      await tx.socialHandleConflict.updateMany({
        where: {
          OR: [
            { socialAccountIdA: { in: accountIds } },
            { socialAccountIdB: { in: accountIds } },
          ],
        },
        data: { handle: null },
      });
    }

    // Revoke all active refresh tokens.
    await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data:  { revokedAt: new Date() },
    });

    // Set tombstone marker — this is the last write.
    await tx.user.update({
      where: { id: userId },
      data:  { gdprErasedAt: new Date() },
    });
  });
}

module.exports = { eraseUser };
