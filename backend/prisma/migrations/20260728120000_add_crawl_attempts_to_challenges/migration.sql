-- AlterTable
-- crawl_attempts is Category B only (per-challenge crawl cap of 10). Meaningless
-- for channel = 'phone' rows; left at its default 0 for those.
ALTER TABLE "challenges" ADD COLUMN "crawl_attempts" INTEGER NOT NULL DEFAULT 0;
