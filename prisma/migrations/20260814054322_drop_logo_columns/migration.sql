/*
  Warnings:

  - You are about to drop the column `logo` on the `Favorite` table. All the data in the column will be lost.
  - You are about to drop the column `logo` on the `WatchHistory` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Favorite" DROP COLUMN "logo";

-- AlterTable
ALTER TABLE "WatchHistory" DROP COLUMN "logo";
