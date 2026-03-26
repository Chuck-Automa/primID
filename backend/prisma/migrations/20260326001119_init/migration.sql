-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "wallet_address" TEXT,
    "phone_number" TEXT,
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "phone_verified_at" TIMESTAMP(3),
    "oauth_provider" TEXT,
    "oauth_verified_at" TIMESTAMP(3),
    "biometric_last_used_at" TIMESTAMP(3),
    "zk_passport_verified" BOOLEAN NOT NULL DEFAULT false,
    "zk_passport_verified_at" TIMESTAMP(3),
    "zk_email_verified" BOOLEAN NOT NULL DEFAULT false,
    "zk_email_verified_at" TIMESTAMP(3),
    "poh_verified" BOOLEAN NOT NULL DEFAULT false,
    "poh_verified_at" TIMESTAMP(3),
    "ecoinmter_verified" BOOLEAN NOT NULL DEFAULT false,
    "ecoinmter_verified_at" TIMESTAMP(3),
    "current_tier" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attestations" (
    "id" TEXT NOT NULL,
    "issuer_user_id" TEXT NOT NULL,
    "subject_user_id" TEXT NOT NULL,
    "attestation_type" TEXT NOT NULL,
    "consent_given_at" TIMESTAMP(3),
    "public_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attestations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "attested_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_number_key" ON "users"("phone_number");

-- AddForeignKey
ALTER TABLE "attestations" ADD CONSTRAINT "attestations_issuer_user_id_fkey" FOREIGN KEY ("issuer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attestations" ADD CONSTRAINT "attestations_subject_user_id_fkey" FOREIGN KEY ("subject_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
