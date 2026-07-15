-- CreateTable
CREATE TABLE "listener_status" (
    "provider" TEXT NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "device_id" TEXT,

    CONSTRAINT "listener_status_pkey" PRIMARY KEY ("provider")
);
