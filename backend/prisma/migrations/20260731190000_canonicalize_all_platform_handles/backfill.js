/**
 * Generalized handle canonicalization backfill — recomputes handle_hmac (and
 * re-encrypts handle) for existing social_accounts rows using the
 * canonicalization rule in handleCanonicalization.util.js. Generalizes the
 * telegram-only backfill in
 * prisma/migrations/20260728130000_canonicalize_telegram_handles/backfill.js
 * to run across any one platform, or every registered platform.
 *
 * Run ONCE per platform (or with --platform=all) after applying migration
 * 20260731190000_canonicalize_all_platform_handles, and before enabling any
 * listener/crawler for a given platform:
 *   node prisma/migrations/20260731190000_canonicalize_all_platform_handles/backfill.js --platform=<name|all>
 * or: npm run db:backfill-handle-canonical -- --platform=<name|all>
 *
 * Idempotent: re-running recomputes the same canonical handle_hmac for an
 * already-canonicalized row (a fresh ciphertext each time, since AES-256-GCM
 * uses a random IV — the decrypted plaintext and handle_hmac are unchanged).
 *
 * Rows whose canonical handle collides with another active row's handle_hmac
 * (within the same platform) are flagged via conflict_flagged + a
 * social_handle_conflicts record — the same never-reject, always-flag path
 * addSocialAccount uses on insert — never silently dropped or overwritten
 * without a trace.
 *
 * Rows whose handle fails validation (e.g. INVALID_NOSTR_HANDLE) are left
 * completely unchanged and printed for manual review; they cannot ever
 * satisfy the HMAC comparison in validateAndMarkSocial as-is, so they're
 * already functionally excluded from verification until the user re-registers
 * with a valid handle. Several registry rules are marked ⚠ (conservative
 * floors, unverified against real platform docs) — a failed validation must
 * never destroy or lock a legitimate handle, hence "leave untouched" rather
 * than any corrective rewrite.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const prisma = require('../../../src/shared/db/prisma');
const { encrypt, decrypt, computeHmac } = require('../../../src/shared/utils/crypto.util');
const { canonicalizeHandle, hasCanonicalizationRule } = require('../../../src/shared/utils/handleCanonicalization.util');

// Mirrors VALID_PLATFORMS in social.controller.js. Kept as a literal list
// (not imported) so this script only ever touches platforms the registration
// path actually supports, even if that list drifts in the future.
const ALL_PLATFORMS = [
  'facebook', 'x', 'signal', 'telegram', 'linkedin', 'instagram',
  'farcaster', 'nostr', 'bluesky', 'github', 'bitchat',
];

function parsePlatformArg() {
  const arg = process.argv.find((a) => a.startsWith('--platform='));
  const value = arg ? arg.split('=')[1] : null;
  if (!value) {
    console.error('[backfill] Usage: node backfill.js --platform=<name|all>');
    process.exit(1);
  }
  if (value === 'all') return ALL_PLATFORMS;
  if (!ALL_PLATFORMS.includes(value)) {
    console.error(`[backfill] Unknown platform "${value}". Valid: ${ALL_PLATFORMS.join(', ')}, all`);
    process.exit(1);
  }
  return [value];
}

async function backfillPlatform(platform) {
  if (!hasCanonicalizationRule(platform)) {
    console.log(`[backfill] platform=${platform}: skipped — no canonicalization rule registered.`);
    return { updated: 0, invalid: [], collisions: [] };
  }

  const rows = await prisma.socialAccount.findMany({
    where:  { platform, removedAt: null, handle: { not: null } },
    select: { id: true, handle: true },
  });

  console.log(`[backfill] platform=${platform}: found ${rows.length} active row(s) to process.`);

  let updated = 0;
  const invalid = [];
  const collisions = [];

  for (const row of rows) {
    // Decrypt failures are a distinct, pre-existing data-quality issue (e.g. a
    // legacy row whose `handle` was never ALE-encrypted, or was encrypted
    // under a since-rotated key) — not a canonicalization validation failure.
    // Treated identically either way: leave the row completely untouched and
    // report it, never destroy or overwrite on an unreadable ciphertext.
    let plaintext;
    try {
      plaintext = decrypt(row.handle);
    } catch (err) {
      invalid.push({ id: row.id, reason: `DECRYPT_FAILED: ${err.message}` });
      continue;
    }

    let canonical;
    try {
      canonical = canonicalizeHandle(platform, plaintext);
    } catch (err) {
      invalid.push({ id: row.id, reason: err.message });
      continue; // leave the row completely untouched
    }

    const newHmac = computeHmac(canonical);

    const existingMatch = await prisma.socialAccount.findFirst({
      where: {
        platform,
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

      // Idempotency guard: re-running the backfill on a pair that was already
      // flagged in a prior run must be a no-op, not a fresh duplicate
      // social_handle_conflicts row every time — check both ID orderings
      // before inserting.
      const alreadyRecorded = await prisma.socialHandleConflict.findFirst({
        where: {
          platform,
          OR: [
            { socialAccountIdA: existingMatch.id, socialAccountIdB: row.id },
            { socialAccountIdA: row.id, socialAccountIdB: existingMatch.id },
          ],
        },
      });

      const ops = [
        prisma.socialAccount.update({ where: { id: row.id }, data: { conflictFlagged: true } }),
        prisma.socialAccount.update({ where: { id: existingMatch.id }, data: { conflictFlagged: true } }),
      ];
      if (!alreadyRecorded) {
        ops.push(
          prisma.socialHandleConflict.create({
            data: {
              platform,
              handle:           canonical,
              socialAccountIdA: existingMatch.id,
              socialAccountIdB: row.id,
            },
          })
        );
      }
      await prisma.$transaction(ops);
    }
  }

  console.log(`[backfill] platform=${platform}: ${updated} row(s) canonicalized.`);
  if (invalid.length > 0) {
    console.log(`[backfill] platform=${platform}: ${invalid.length} row(s) failed validation — left unchanged, review manually:`);
    invalid.forEach((r) => console.log(`  social_account id=${r.id} reason=${r.reason}`));
  }
  if (collisions.length > 0) {
    console.log(`[backfill] platform=${platform}: ${collisions.length} handle_hmac collision(s) flagged — review social_handle_conflicts:`);
    collisions.forEach((c) => console.log(`  ${c.a} <-> ${c.b}`));
  }

  return { updated, invalid, collisions };
}

async function run() {
  const platforms = parsePlatformArg();

  let totalUpdated = 0;
  let totalInvalid = 0;
  let totalCollisions = 0;

  for (const platform of platforms) {
    const result = await backfillPlatform(platform);
    totalUpdated += result.updated;
    totalInvalid += result.invalid.length;
    totalCollisions += result.collisions.length;
  }

  console.log(`[backfill] Done. ${totalUpdated} row(s) canonicalized, ${totalInvalid} left for manual review, ${totalCollisions} collision(s) flagged.`);
  await prisma.$disconnect();
}

run().catch((err) => {
  console.error('[backfill] Error:', err.message);
  process.exit(1);
});
