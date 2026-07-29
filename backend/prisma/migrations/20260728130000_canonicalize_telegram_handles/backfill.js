/**
 * Backfill script: recompute handle_hmac (and re-encrypt handle) for existing
 * social_accounts rows with platform = 'telegram', using the canonicalization
 * rule in handleCanonicalization.util.js (strip @ / t.me/ prefix, lowercase).
 *
 * These rows were self-reported in Sprint 1, before the canonicalization rule
 * existed, and may carry mixed-case or decorated handles whose handle_hmac
 * would never match an incoming (already-canonical) Telegram sender username.
 *
 * Run ONCE after applying migration 20260728130000_canonicalize_telegram_handles,
 * and before setting TELEGRAM_SOCIAL_LISTENER=true / TELEGRAM_LISTENER_MODE
 * to anything other than 'off':
 *   node prisma/migrations/20260728130000_canonicalize_telegram_handles/backfill.js
 *
 * Idempotent: re-running recomputes the same canonical handle_hmac for an
 * already-canonicalized row (a fresh ciphertext each time, since AES-256-GCM
 * uses a random IV — the decrypted plaintext and handle_hmac are unchanged).
 *
 * Rows whose canonical handle collides with another active row's handle_hmac
 * are flagged via conflict_flagged + a social_handle_conflicts record — the
 * same never-reject, always-flag path addSocialAccount uses on insert — not
 * silently dropped or overwritten without a trace.
 *
 * Rows whose handle fails validation (INVALID_TELEGRAM_HANDLE) are left
 * unchanged and printed for manual review; they cannot ever satisfy the HMAC
 * comparison in validateAndMarkSocial as-is, so they're already functionally
 * excluded from verification until the user re-registers with a valid handle.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const prisma = require('../../../src/shared/db/prisma');
const { encrypt, decrypt, computeHmac } = require('../../../src/shared/utils/crypto.util');
const { canonicalizeHandle } = require('../../../src/shared/utils/handleCanonicalization.util');

async function run() {
  const rows = await prisma.socialAccount.findMany({
    where:  { platform: 'telegram', removedAt: null, handle: { not: null } },
    select: { id: true, handle: true },
  });

  console.log(`[backfill] Found ${rows.length} active Telegram row(s) to process.`);

  let updated = 0;
  const invalid = [];
  const collisions = [];

  for (const row of rows) {
    const plaintext = decrypt(row.handle);

    let canonical;
    try {
      canonical = canonicalizeHandle('telegram', plaintext);
    } catch (err) {
      invalid.push({ id: row.id, reason: err.message });
      continue;
    }

    const newHmac = computeHmac(canonical);

    const existingMatch = await prisma.socialAccount.findFirst({
      where: {
        platform:   'telegram',
        handleHmac: newHmac,
        removedAt:  null,
        id:         { not: row.id },
      },
    });

    await prisma.socialAccount.update({
      where: { id: row.id },
      data: {
        handle:       encrypt(canonical),
        handleHmac:   newHmac,
        handleSearch: canonical,
      },
    });
    updated++;

    if (existingMatch) {
      collisions.push({ a: row.id, b: existingMatch.id });
      await prisma.$transaction([
        prisma.socialAccount.update({ where: { id: row.id }, data: { conflictFlagged: true } }),
        prisma.socialAccount.update({ where: { id: existingMatch.id }, data: { conflictFlagged: true } }),
        prisma.socialHandleConflict.create({
          data: {
            platform:         'telegram',
            handle:           canonical,
            socialAccountIdA: existingMatch.id,
            socialAccountIdB: row.id,
          },
        }),
      ]);
    }
  }

  console.log(`[backfill] Done. ${updated} row(s) canonicalized.`);
  if (invalid.length > 0) {
    console.log(`[backfill] ${invalid.length} row(s) failed validation — left unchanged, review manually:`);
    invalid.forEach((r) => console.log(`  social_account id=${r.id} reason=${r.reason}`));
  }
  if (collisions.length > 0) {
    console.log(`[backfill] ${collisions.length} handle_hmac collision(s) flagged — review social_handle_conflicts:`);
    collisions.forEach((c) => console.log(`  ${c.a} <-> ${c.b}`));
  }

  await prisma.$disconnect();
}

run().catch((err) => {
  console.error('[backfill] Error:', err.message);
  process.exit(1);
});
