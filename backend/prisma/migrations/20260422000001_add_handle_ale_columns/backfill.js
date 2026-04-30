/**
 * Backfill script: populate handle_hmac and handle_search for existing social_accounts rows,
 * and encrypt the handle column in-place.
 *
 * Run ONCE after applying migration 20260422000001_add_handle_ale_columns:
 *   node prisma/migrations/20260422000001_add_handle_ale_columns/backfill.js
 *
 * Idempotent: rows with handle_hmac already set are skipped.
 * Re-running is safe.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const prisma  = require('../../../src/shared/db/prisma');
const { encrypt, computeHmac } = require('../../../src/shared/utils/crypto.util');

async function run() {
  const rows = await prisma.socialAccount.findMany({
    where:  { handleHmac: null },
    select: { id: true, handle: true },
  });

  console.log(`[backfill] Found ${rows.length} rows to process.`);

  let processed = 0;
  for (const row of rows) {
    const hmac       = computeHmac(row.handle);
    const ciphertext = encrypt(row.handle);

    await prisma.socialAccount.update({
      where: { id: row.id },
      data: {
        handle:       ciphertext,
        handleHmac:   hmac,
        handleSearch: row.handle,
      },
    });
    processed++;
  }

  console.log(`[backfill] Done. ${processed} rows updated.`);
  await prisma.$disconnect();
}

run().catch((err) => {
  console.error('[backfill] Error:', err.message);
  process.exit(1);
});
