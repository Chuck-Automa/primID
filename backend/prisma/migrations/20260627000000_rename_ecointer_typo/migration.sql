-- Rename misspelled columns: ecoinmter → ecointer
ALTER TABLE "users" RENAME COLUMN "ecoinmter_verified" TO "ecointer_verified";
ALTER TABLE "users" RENAME COLUMN "ecoinmter_verified_at" TO "ecointer_verified_at";
