-- CreateTable
CREATE TABLE "device_code" (
    "id" TEXT NOT NULL,
    "deviceCode" TEXT NOT NULL,
    "userCode" TEXT NOT NULL,
    "userId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "lastPolledAt" TIMESTAMP(3),
    "pollingInterval" INTEGER,
    "clientId" TEXT,
    "scope" TEXT,

    CONSTRAINT "device_code_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "device_code_userId_idx" ON "device_code"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "device_code_deviceCode_key" ON "device_code"("deviceCode");

-- CreateIndex
CREATE UNIQUE INDEX "device_code_userCode_key" ON "device_code"("userCode");

-- AddForeignKey
ALTER TABLE "device_code" ADD CONSTRAINT "device_code_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
