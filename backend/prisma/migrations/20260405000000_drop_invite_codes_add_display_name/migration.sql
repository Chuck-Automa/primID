-- Drop invite_codes table and remove invite_code_used from users
-- Add display_name to users

-- DropForeignKey
ALTER TABLE "invite_codes" DROP CONSTRAINT "invite_codes_created_by_fkey";
ALTER TABLE "invite_codes" DROP CONSTRAINT "invite_codes_used_by_fkey";

-- DropIndex
DROP INDEX "invite_codes_code_key";

-- DropTable
DROP TABLE "invite_codes";

-- AlterTable: remove invite_code_used, add display_name
ALTER TABLE "users"
  DROP COLUMN IF EXISTS "invite_code_used",
  ADD COLUMN "display_name" TEXT;
