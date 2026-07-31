-- No schema change. This migration exists only to mark, in Prisma's migration
-- history, the point after which social_accounts.handle_hmac for every
-- registered platform (see handleCanonicalization.util.js's REGISTRY) is
-- guaranteed canonical — not just telegram (see the companion no-op migration
-- 20260728130000_canonicalize_telegram_handles).
-- The actual data migration is the companion backfill.js in this same folder —
-- run it once, manually, after this migration applies:
--   node prisma/migrations/20260731190000_canonicalize_all_platform_handles/backfill.js --platform=all
-- or via: npm run db:backfill-handle-canonical -- --platform=all
SELECT 1;
