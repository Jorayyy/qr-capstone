-- AlterTable
ALTER TABLE "departments" ADD COLUMN "officeOpen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "headInOffice" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "statusUpdatedAt" TIMESTAMP(3),
ADD COLUMN "statusUpdatedBy" TEXT;
