-- Pre-registration pass flow: affiliations, reference codes, validity windows,
-- per-office stops, and multi-visit support.

ALTER TYPE "IdType" ADD VALUE IF NOT EXISTS 'NATIONAL_ID';
ALTER TYPE "IdType" ADD VALUE IF NOT EXISTS 'DRIVERS_LICENSE';
ALTER TYPE "IdType" ADD VALUE IF NOT EXISTS 'UMID';
ALTER TYPE "IdType" ADD VALUE IF NOT EXISTS 'PRC';
ALTER TYPE "IdType" ADD VALUE IF NOT EXISTS 'POSTAL_ID';
ALTER TYPE "IdType" ADD VALUE IF NOT EXISTS 'COMPANY_ID';

CREATE TYPE "Affiliation" AS ENUM ('VISITOR', 'STUDENT', 'FACULTY', 'STAFF', 'ALUMNI', 'PARENT', 'SUPPLIER', 'GOVERNMENT', 'OTHER');
CREATE TYPE "VisitType" AS ENUM ('ONE_DAY', 'MULTIPLE');
CREATE TYPE "RegistrationMethod" AS ENUM ('PRE_REGISTERED', 'WALK_IN');
CREATE TYPE "HostPreference" AS ENUM ('SPECIFIC', 'ANY');

ALTER TABLE "visitors"
  ADD COLUMN "middleName" TEXT,
  ADD COLUMN "dateOfBirth" TIMESTAMP(3),
  ADD COLUMN "affiliation" "Affiliation" NOT NULL DEFAULT 'VISITOR';

ALTER TABLE "visits"
  ADD COLUMN "referenceCode" TEXT,
  ADD COLUMN "validFrom" TIMESTAMP(3),
  ADD COLUMN "visitType" "VisitType" NOT NULL DEFAULT 'ONE_DAY',
  ADD COLUMN "method" "RegistrationMethod" NOT NULL DEFAULT 'WALK_IN';

UPDATE "visits" v
SET "referenceCode" = 'EVSU-' || to_char(v."createdAt", 'YYYY') || '-' || lpad(seq.rn::text, 5, '0')
FROM (
  SELECT "id", row_number() OVER (PARTITION BY to_char("createdAt", 'YYYY') ORDER BY "createdAt", "id") AS rn
  FROM "visits"
) seq
WHERE v."id" = seq."id";

ALTER TABLE "visits" ALTER COLUMN "referenceCode" SET NOT NULL;
CREATE UNIQUE INDEX "visits_referenceCode_key" ON "visits"("referenceCode");

ALTER TABLE "visit_stops"
  ADD COLUMN "purpose" "VisitPurpose",
  ADD COLUMN "hostName" TEXT,
  ADD COLUMN "hostPreference" "HostPreference" NOT NULL DEFAULT 'ANY',
  ALTER COLUMN "checkedInAt" DROP DEFAULT,
  ALTER COLUMN "checkedInAt" DROP NOT NULL;

CREATE INDEX "visit_stops_departmentId_idx" ON "visit_stops"("departmentId");
