-- Consent evidence for the public privacy notice (RA 10173 accountability).
ALTER TABLE "visits" ADD COLUMN "consentVersion" TEXT,
ADD COLUMN "consentedAt" TIMESTAMP(3);
