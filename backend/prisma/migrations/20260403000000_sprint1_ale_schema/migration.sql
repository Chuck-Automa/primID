-- Sprint 1 ALE schema update
-- Adds: phone_number_hmac, oauth_sub, oauth_sub_hmac, invite_code_used on users
-- Adds: conflict_flagged, removed_at on social_accounts
-- Creates: social_handle_conflicts, invite_codes tables
-- Removes: unique constraint on phone_number (uniqueness now enforced via phone_number_hmac)

-- DropIndex (phone_number is now ALE-encrypted ciphertext — not unique-comparable)
DROP INDEX "users_phone_number_key";

-- AlterTable: social_accounts
ALTER TABLE "social_accounts"
  ADD COLUMN "conflict_flagged" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "removed_at" TIMESTAMP(3);

-- AlterTable: users
ALTER TABLE "users"
  ADD COLUMN "invite_code_used" TEXT,
  ADD COLUMN "oauth_sub" TEXT,
  ADD COLUMN "oauth_sub_hmac" TEXT,
  ADD COLUMN "phone_number_hmac" TEXT;

-- CreateTable: social_handle_conflicts
CREATE TABLE "social_handle_conflicts" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "social_account_id_a" TEXT NOT NULL,
    "social_account_id_b" TEXT NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolution_note" TEXT,

    CONSTRAINT "social_handle_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: invite_codes
CREATE TABLE "invite_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_by" TEXT,
    "used_by" TEXT,
    "used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invite_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invite_codes_code_key" ON "invite_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_number_hmac_key" ON "users"("phone_number_hmac");

-- CreateIndex
CREATE UNIQUE INDEX "users_oauth_sub_hmac_key" ON "users"("oauth_sub_hmac");

-- AddForeignKey
ALTER TABLE "social_handle_conflicts" ADD CONSTRAINT "social_handle_conflicts_social_account_id_a_fkey"
  FOREIGN KEY ("social_account_id_a") REFERENCES "social_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_handle_conflicts" ADD CONSTRAINT "social_handle_conflicts_social_account_id_b_fkey"
  FOREIGN KEY ("social_account_id_b") REFERENCES "social_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_used_by_fkey"
  FOREIGN KEY ("used_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
