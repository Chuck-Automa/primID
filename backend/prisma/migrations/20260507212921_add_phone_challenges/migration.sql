-- CreateTable
CREATE TABLE "phone_challenges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "phone_number_hmac" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),

    CONSTRAINT "phone_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "phone_challenges_phone_number_hmac_idx" ON "phone_challenges"("phone_number_hmac");

-- AddForeignKey
ALTER TABLE "phone_challenges" ADD CONSTRAINT "phone_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
