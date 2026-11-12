-- Free-text "please specify" values for the OTHER enum options.

-- AlterTable
ALTER TABLE "visitors" ADD COLUMN "affiliationOther" TEXT;
ALTER TABLE "visitors" ADD COLUMN "idTypeOther" TEXT;

-- AlterTable
ALTER TABLE "visits" ADD COLUMN "purposeOther" TEXT;

-- AlterTable
ALTER TABLE "visit_stops" ADD COLUMN "purposeOther" TEXT;
