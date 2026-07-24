import { withDatabaseRetry } from "@/lib/prisma";
import { parseLoadSequence } from "@/lib/delivery-dispatch-utils";

const SCHEDULE_TICKET_SELECT = {
  id: true,
  ticketNumber: true,
  status: true,
  loadSequence: true,
  deliveryDate: true,
  deliveryTime: true,
  trailer: true,
  driver: true,
  totalItems: true,
  totalWeight: true,
  createdAt: true,
  updatedAt: true,
  lineItems: {
    orderBy: { lineNumber: "asc" as const },
    select: { itemCode: true, description: true, quantity: true },
  },
} as const;

/**
 * A job's delivery tickets in load order, shared by the scheduling page and
 * the printable delivery-schedule document so both always agree.
 */
export async function loadJobDeliverySchedule(jobId: string) {
  const [job, tickets] = await Promise.all([
    withDatabaseRetry((client) =>
      client.job.findUnique({
        where: { id: jobId },
        select: {
          id: true,
          jobNumber: true,
          projectName: true,
          customerName: true,
          projectAddress: true,
          city: true,
          state: true,
          zip: true,
          folderPath: true,
        },
      }),
    ),
    withDatabaseRetry((client) =>
      client.deliveryTicket.findMany({
        where: {
          jobId,
          status: {
            in: ["DRAFT", "SCHEDULED", "LOADING", "IN_TRANSIT", "DELIVERED"],
          },
        },
        select: SCHEDULE_TICKET_SELECT,
      }),
    ),
  ]);

  if (!job) {
    return null;
  }

  const sorted = [...tickets].sort((a, b) => {
    const seqA = parseLoadSequence(a.loadSequence) ?? Number.POSITIVE_INFINITY;
    const seqB = parseLoadSequence(b.loadSequence) ?? Number.POSITIVE_INFINITY;
    if (seqA !== seqB) return seqA - seqB;
    if (a.createdAt.getTime() !== b.createdAt.getTime()) {
      return a.createdAt.getTime() - b.createdAt.getTime();
    }
    return (a.ticketNumber ?? "").localeCompare(b.ticketNumber ?? "");
  });

  return { job, tickets: sorted };
}

export type JobDeliverySchedule = NonNullable<
  Awaited<ReturnType<typeof loadJobDeliverySchedule>>
>;
export type DeliveryScheduleTicket = JobDeliverySchedule["tickets"][number];
