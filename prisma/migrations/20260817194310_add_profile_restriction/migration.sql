-- CreateTable
CREATE TABLE "profile_restriction" (
    "userId" TEXT NOT NULL,

    CONSTRAINT "profile_restriction_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "profile_restriction" ADD CONSTRAINT "profile_restriction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
