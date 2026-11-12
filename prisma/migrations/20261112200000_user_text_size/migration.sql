-- Per-user Text Size: each user picks how big the app's screen text is
-- (My Preferences / My Profile). Printed PDFs are not affected.
CREATE TYPE "TextSize" AS ENUM ('NORMAL', 'LARGE', 'EXTRA_LARGE');

ALTER TABLE "User" ADD COLUMN "textSize" "TextSize" NOT NULL DEFAULT 'NORMAL';
