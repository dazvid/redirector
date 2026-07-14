-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'PERSONAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AlterTable
ALTER TABLE "Shortcut" ADD COLUMN "userId" TEXT;
ALTER TABLE "Shortcut" ADD COLUMN "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC';

-- Backfill: shortcuts created before per-user ownership existed are
-- assigned to a placeholder "admin" row. The app's bootstrap step
-- (src/lib/bootstrap-admin.ts, run from instrumentation.ts) overwrites
-- this row's real username/passwordHash from env vars on every boot, so
-- the blank passwordHash here is never actually usable for login.
INSERT INTO "User" ("id", "username", "passwordHash", "isAdmin")
VALUES ('admin', 'admin', '', true)
ON CONFLICT ("id") DO NOTHING;

UPDATE "Shortcut" SET "userId" = 'admin' WHERE "userId" IS NULL;

-- AlterTable: enforce NOT NULL now that every row has an owner
ALTER TABLE "Shortcut" ALTER COLUMN "userId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Shortcut_userId_idx" ON "Shortcut"("userId");

-- AddForeignKey
ALTER TABLE "Shortcut" ADD CONSTRAINT "Shortcut_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
