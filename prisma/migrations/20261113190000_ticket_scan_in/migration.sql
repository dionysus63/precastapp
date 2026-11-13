-- Scan In: a scanned stack of signed delivery tickets is read page by page,
-- filed as one PDF per ticket, and the tickets are marked delivered. It takes
-- the place of Reconcile Day (whose table stays, unused).

-- 1. The scan being worked on (OPEN, at most one) and one row per click of
--    File (FILED): what was filed together, in paper stack order.
CREATE TYPE "TicketScanStatus" AS ENUM ('OPEN', 'FILED');

CREATE TABLE "TicketScanBatch" (
    "id" TEXT NOT NULL,
    "status" "TicketScanStatus" NOT NULL DEFAULT 'OPEN',
    "sourcesJson" JSONB NOT NULL,
    "pagesJson" JSONB NOT NULL,
    "choicesJson" JSONB NOT NULL DEFAULT '{}',
    "resultJson" JSONB,
    "nextSeq" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 0,
    "filingStartedAt" TIMESTAMP(3),
    "uploadedBy" TEXT,
    "filedBy" TEXT,
    "filedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketScanBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TicketScanBatch_status_filedAt_idx" ON "TicketScanBatch"("status", "filedAt");

-- 2. One row per signed ticket PDF in storage/signed-tickets. A ticket
--    scanned again keeps its earlier rows (isCurrent = false).
CREATE TABLE "SignedTicketFile" (
    "id" TEXT NOT NULL,
    "deliveryTicketId" TEXT NOT NULL,
    "batchId" TEXT,
    "filePath" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "jobFolderCopyPath" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "filedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignedTicketFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SignedTicketFile_deliveryTicketId_isCurrent_idx" ON "SignedTicketFile"("deliveryTicketId", "isCurrent");

CREATE INDEX "SignedTicketFile_batchId_idx" ON "SignedTicketFile"("batchId");

ALTER TABLE "SignedTicketFile" ADD CONSTRAINT "SignedTicketFile_deliveryTicketId_fkey" FOREIGN KEY ("deliveryTicketId") REFERENCES "DeliveryTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SignedTicketFile" ADD CONSTRAINT "SignedTicketFile_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "TicketScanBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. "Delivered, No Signed Copy" on the Still Out list: who closed the ticket
--    without its paper, and when.
ALTER TABLE "DeliveryTicket" ADD COLUMN     "closedWithoutSignedCopyAt" TIMESTAMP(3),
ADD COLUMN     "closedWithoutSignedCopyBy" TEXT;

-- 4. When Scan In went live here: the moment this migration runs. Tickets
--    delivered before it never show on Still Out, so the list does not start
--    out full of old deliveries.
ALTER TABLE "AppSettings" ADD COLUMN     "scanInStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

--    The app reads every timestamp as UTC. The default above fills the
--    settings row in the database's own time zone. PostgreSQL takes the
--    PC's time zone when it is installed, so in an Eastern-time office that
--    puts the moment four or five hours early, and the morning's deliveries
--    would show on Still Out. Say UTC outright.
UPDATE "AppSettings" SET "scanInStartedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC');

-- 5. Filing a scan marks tickets delivered, so the Office role gets the
--    delivery permission. The built-in default changes in the code; this
--    covers a role setup that was saved under Settings (which stores every
--    role's list). A role list that already has it is left alone.
UPDATE "AppSettings"
SET "rolePermissions" = jsonb_set(
  "rolePermissions",
  '{OFFICE}',
  ("rolePermissions" -> 'OFFICE') || '["DELIVERY_MANAGE"]'::jsonb
)
WHERE jsonb_typeof("rolePermissions" -> 'OFFICE') = 'array'
  AND NOT ("rolePermissions" -> 'OFFICE') @> '["DELIVERY_MANAGE"]'::jsonb;
