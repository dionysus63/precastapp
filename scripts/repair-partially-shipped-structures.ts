/**
 * One-off repair: structures marked SHIPPED by a partial delivery.
 *
 * Until the fix shipped with this script, delivering any ticket that carried
 * a whole-structure line flipped that structure to SHIPPED, even when the
 * quote line still had units left (10 wall panels quoted, 4 delivered). Those
 * structures then blocked the remaining units with "Structure status:
 * SHIPPED". This puts them back to MADE so the rest can be scheduled.
 *
 * Only structures with at least one delivered ticket line and remaining
 * quoted quantity are touched; a structure marked shipped by hand (delivered
 * outside the app, nothing delivered through it) is left alone.
 *
 *   npx tsx scripts/repair-partially-shipped-structures.ts          # preview
 *   npx tsx scripts/repair-partially-shipped-structures.ts --apply  # fix
 */
import "dotenv/config";
import { Prisma } from "@/app/generated/prisma/client";
import { getShippedQuantityForQuoteLine } from "@/lib/delivery-fulfillment";
import { prisma } from "@/lib/prisma";

const apply = process.argv.includes("--apply");

async function main() {
  const structures = await prisma.jobStructure.findMany({
    where: { status: "SHIPPED" },
    select: {
      id: true,
      structureNumber: true,
      job: { select: { jobNumber: true } },
      quoteLineItems: {
        where: { quote: { status: "WON" } },
        select: { id: true, quantity: true },
      },
      deliveryTicketLineItems: {
        where: {
          jobStructurePieceId: null,
          deliveryTicket: { status: "DELIVERED" },
        },
        select: { id: true },
        take: 1,
      },
    },
  });

  const toRepair: string[] = [];
  for (const structure of structures) {
    if (structure.deliveryTicketLineItems.length === 0) {
      continue;
    }
    for (const line of structure.quoteLineItems) {
      const shipped = await getShippedQuantityForQuoteLine(prisma, line.id);
      const remaining = new Prisma.Decimal(line.quantity).minus(shipped);
      if (remaining.gt(0)) {
        console.log(
          `${structure.job?.jobNumber ?? "(no job)"} ${structure.structureNumber ?? structure.id}: ` +
            `${shipped} of ${line.quantity} delivered, ${remaining} remaining`,
        );
        toRepair.push(structure.id);
        break;
      }
    }
  }

  if (toRepair.length === 0) {
    console.log("No partially shipped structures found.");
    return;
  }
  if (!apply) {
    console.log(
      `${toRepair.length} structure(s) would go back to MADE. Re-run with --apply.`,
    );
    return;
  }
  const result = await prisma.jobStructure.updateMany({
    where: { id: { in: toRepair }, status: "SHIPPED" },
    data: { status: "MADE", shippedDate: null },
  });
  console.log(`${result.count} structure(s) set back to MADE.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
