-- AlterTable
ALTER TABLE "social_accounts" ALTER COLUMN "handle" DROP NOT NULL;

-- AlterTable
ALTER TABLE "social_handle_conflicts" ALTER COLUMN "handle" DROP NOT NULL;
