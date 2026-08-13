-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "portalUrl" TEXT NOT NULL,
    "macAddress" TEXT NOT NULL,
    "serialNumber" TEXT,
    "stbType" TEXT,
    "clientType" TEXT,
    "deviceId" TEXT,
    "deviceId2" TEXT,
    "signature" TEXT,
    "hwVersion" TEXT,
    "hwVersion2" TEXT,
    "prehash" TEXT,
    "imageVersion" TEXT,
    "apiSignature" TEXT,
    "timezone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastConnectedAt" TIMESTAMP(3),

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);
