-- Add ALE columns to social_accounts (handle_hmac, handle_search, verified_at)
-- handle_hmac:   HMAC of plaintext handle — used for all exact-match lookups
-- handle_search: plaintext handle — used for prefix search and public display; NULLed on erasure
-- verified_at:   set by the social listener on successful challenge-code verification (Sprint 2)
ALTER TABLE "social_accounts"
  ADD COLUMN "handle_hmac"   TEXT,
  ADD COLUMN "handle_search" TEXT,
  ADD COLUMN "verified_at"   TIMESTAMP(3);

-- Add tombstone marker to users
-- Non-null = erasure completed; row is a hollow tombstone
ALTER TABLE "users"
  ADD COLUMN "gdpr_erased_at" TIMESTAMP(3);
