-- AlterTable
ALTER TABLE "departments" ADD COLUMN "closingMinute" INTEGER;

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- Campus default: 19:00 Asia/Manila
INSERT INTO "settings" ("key", "value") VALUES ('campus_closing_minute', '1140')
ON CONFLICT ("key") DO NOTHING;
