-- AlterTable
ALTER TABLE "User" ADD COLUMN     "extraPerms" TEXT;

-- CreateTable
CREATE TABLE "RoleConfig" (
    "role" TEXT NOT NULL,
    "perms" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleConfig_pkey" PRIMARY KEY ("role")
);
