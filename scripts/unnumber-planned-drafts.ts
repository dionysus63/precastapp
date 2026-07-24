// One-off cleanup for the deferred-ticket-number rollout: strip the ticket
// numbers from a job's planner-created DRAFT tickets (they become "Planned"
// tickets that get numbered at scheduling) and roll the global counter back
// so the freed numbers are reissued.
//
// The counter only rolls back to just above the HIGHEST number still held by
// any other ticket, so reissued numbers can never collide.
//
// Usage (run on the server after deploy:update):
//   npx tsx scripts/unnumber-planned-drafts.ts 26-006          (dry run)
//   npx tsx scripts/unnumber-planned-drafts.ts 26-006 --apply  (write)
import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { resolveDatabaseUrl } from "../lib/database-url";
import { GLOBAL_DELIVERY_TICKET_SEQUENCE_YEAR } from "../lib/delivery-ticket-number";

async function main() {
  const jobNumber = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!jobNumber) {
    console.error("Usage: npx tsx scripts/unnumber-planned-drafts.ts <jobNumber> [--apply]");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: resolveDatabaseUrl(process.env.DATABASE_URL),
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const job = await prisma.job.findFirst({
      where: { jobNumber },
      select: { id: true, jobNumber: true, projectName: true },
    });
    if (!job) {
      console.error(`Job ${jobNumber} not found.`);
      process.exit(1);
    }

    // Planner-created drafts only: still DRAFT, delivery job tickets, never
    // invoiced. Anything scheduled or beyond keeps its number.
    const drafts = await prisma.deliveryTicket.findMany({
      where: {
        jobId: job.id,
        status: "DRAFT",
        ticketType: "JOB",
        fulfillmentMethod: "DELIVERY",
        ticketNumber: { not: null },
        invoice: null,
      },
      orderBy: { sequenceNumber: "asc" },
      select: { id: true, ticketNumber: true, sequenceNumber: true },
    });

    if (drafts.length === 0) {
      console.log(`No numbered DRAFT tickets on ${job.jobNumber} — nothing to do.`);
      return;
    }

    console.log(
      `Job ${job.jobNumber} — ${job.projectName}: ${drafts.length} numbered draft ticket(s):`,
    );
    console.log(
      `  ${drafts[0].ticketNumber} … ${drafts[drafts.length - 1].ticketNumber}`,
    );

    const draftIds = drafts.map((ticket) => ticket.id);
    const highestOther = await prisma.deliveryTicket.aggregate({
      where: { id: { notIn: draftIds }, sequenceNumber: { not: null } },
      _max: { sequenceNumber: true },
    });
    const settings = await prisma.appSettings.findUnique({
      where: { id: "default" },
      select: { ticketNumberStart: true },
    });
    const start = settings?.ticketNumberStart ?? 10001;
    // The allocator issues GREATEST(lastNumber + 1, start), so parking the
    // counter at the highest surviving number (or just below start) reissues
    // the freed block next.
    const rollbackTo = Math.max(highestOther._max.sequenceNumber ?? 0, start - 1);

    console.log(
      `Counter rollback target: ${rollbackTo} (next issued number: ${Math.max(rollbackTo + 1, start)}).`,
    );

    if (!apply) {
      console.log("Dry run only — rerun with --apply to write.");
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.deliveryTicket.updateMany({
        where: { id: { in: draftIds } },
        data: {
          ticketNumber: null,
          year: null,
          yearTwoDigit: null,
          sequenceNumber: null,
        },
      });
      await tx.deliveryTicketSequence.updateMany({
        where: { year: GLOBAL_DELIVERY_TICKET_SEQUENCE_YEAR },
        data: { lastNumber: rollbackTo },
      });
    });

    console.log(
      `Done: ${drafts.length} ticket(s) are now unnumbered Planned drafts; counter parked at ${rollbackTo}.`,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

void main();
