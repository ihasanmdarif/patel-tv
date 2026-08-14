-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('CHANNEL', 'MOVIE', 'EPISODE');

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "contentId" TEXT NOT NULL,
    "cmd" TEXT,
    "title" TEXT NOT NULL,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchHistory" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "contentId" TEXT NOT NULL,
    "seriesId" TEXT,
    "title" TEXT NOT NULL,
    "seriesTitle" TEXT,
    "logo" TEXT,
    "positionSec" INTEGER NOT NULL DEFAULT 0,
    "durationSec" INTEGER,
    "cmd" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Favorite_profileId_contentType_idx" ON "Favorite"("profileId", "contentType");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_profileId_contentType_contentId_key" ON "Favorite"("profileId", "contentType", "contentId");

-- CreateIndex
CREATE INDEX "WatchHistory_profileId_updatedAt_idx" ON "WatchHistory"("profileId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WatchHistory_profileId_contentType_contentId_key" ON "WatchHistory"("profileId", "contentType", "contentId");
