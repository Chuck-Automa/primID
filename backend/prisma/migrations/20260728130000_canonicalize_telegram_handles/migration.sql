-- No schema change. This migration exists only to mark, in Prisma's migration
-- history, the point after which social_accounts.handle_hmac for
-- platform = 'telegram' is guaranteed canonical (lowercased, @ / t.me/ stripped).
-- The actual data migration is the companion backfill.js in this same folder —
-- run it once, manually, after this migration applies:
--   node prisma/migrations/20260728130000_canonicalize_telegram_handles/backfill.js
-- See PLAN_telegram_listener.md Step 2 for the canonicalization rule and the
-- HMAC-collision / invalid-handle handling this backfill performs.
SELECT 1;
