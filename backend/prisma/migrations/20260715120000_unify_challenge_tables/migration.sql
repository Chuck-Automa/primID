-- Unify phone_challenges and verification_challenges into a single challenges
-- table, discriminated by `channel`. Legacy tables are NOT dropped here —
-- see the follow-up drop migration shipped once this has run cleanly through
-- a full 24h+expiry cleanup cycle in every environment.

-- CreateTable
CREATE TABLE "challenges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "phone_number_hmac" TEXT,
    "social_account_id" TEXT,
    "platform" TEXT,
    "expected_handle" TEXT,
    "resolved_via" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

-- Backfill: phone_challenges rows, preserving id so in-flight challengeIds
-- held by polling clients keep resolving across the deploy.
INSERT INTO "challenges" ("id", "user_id", "channel", "code", "phone_number_hmac", "created_at", "expires_at", "used_at")
SELECT "id", "user_id", 'phone', "code", "phone_number_hmac", "created_at", "expires_at", "used_at"
FROM "phone_challenges";

-- Backfill: verification_challenges rows.
INSERT INTO "challenges" ("id", "user_id", "channel", "code", "social_account_id", "platform", "expected_handle", "created_at", "expires_at", "used_at")
SELECT "id", "user_id", 'social', "code", "social_account_id", "platform", "expected_handle", "created_at", "expires_at", "used_at"
FROM "verification_challenges";

-- CreateIndex
CREATE INDEX "challenges_code_idx" ON "challenges"("code");

-- CreateIndex
CREATE INDEX "challenges_phone_number_hmac_idx" ON "challenges"("phone_number_hmac");

-- AddForeignKey
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_social_account_id_fkey" FOREIGN KEY ("social_account_id") REFERENCES "social_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
