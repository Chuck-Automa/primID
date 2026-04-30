-- CreateTable: verification_challenges
-- Stores pending social account verification challenge codes.
-- Rows are eligible for deletion 24 hours after COALESCE(used_at, expires_at).
CREATE TABLE "verification_challenges" (
    "id"                TEXT         NOT NULL,
    "user_id"           TEXT         NOT NULL,
    "social_account_id" TEXT         NOT NULL,
    "code"              TEXT         NOT NULL,
    "platform"          TEXT         NOT NULL,
    "expected_handle"   TEXT         NOT NULL,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at"        TIMESTAMP(3) NOT NULL,
    "used_at"           TIMESTAMP(3),

    CONSTRAINT "verification_challenges_pkey" PRIMARY KEY ("id")
);

-- Index on code for fast lookup during listener validation
CREATE INDEX "verification_challenges_code_idx" ON "verification_challenges"("code");

-- Foreign keys
ALTER TABLE "verification_challenges"
    ADD CONSTRAINT "verification_challenges_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "verification_challenges"
    ADD CONSTRAINT "verification_challenges_social_account_id_fkey"
    FOREIGN KEY ("social_account_id") REFERENCES "social_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
