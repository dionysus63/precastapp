import type {
  JobStatus,
  Prisma,
  PrismaClient,
} from "@/app/generated/prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type JobStatusTrigger = "QUOTE_WON" | "DELIVERY_DELIVERED";

/**
 * Forward-only automatic pipeline transitions. A trigger promotes the job
 * only when its current status is an earlier pipeline stage — deliberate
 * states (ON_HOLD, COMPLETE, CLOSED) and later stages are never overridden,
 * so a manual status choice always sticks.
 */
const TRIGGER_TRANSITIONS: Record<
  JobStatusTrigger,
  { from: JobStatus[]; to: JobStatus }
> = {
  QUOTE_WON: { from: ["QUOTING"], to: "AWARDED" },
  DELIVERY_DELIVERED: { from: ["QUOTING", "AWARDED"], to: "ACTIVE" },
};

/**
 * Promote a job's status for a workflow event. Concurrency-safe: the guarded
 * updateMany only wins from an allowed prior stage. Returns true when the
 * status actually changed.
 */
export async function promoteJobStatus(
  client: DbClient,
  jobId: string,
  trigger: JobStatusTrigger,
): Promise<boolean> {
  const transition = TRIGGER_TRANSITIONS[trigger];
  const result = await client.job.updateMany({
    where: { id: jobId, status: { in: transition.from } },
    data: { status: transition.to },
  });

  if (trigger === "QUOTE_WON") {
    // First arrival at AWARDED stamps the award date (matches the manual
    // inline-status behavior and the bid-panel award flow).
    await client.job.updateMany({
      where: { id: jobId, status: "AWARDED", awardedDate: null },
      data: { awardedDate: new Date() },
    });
  }

  return result.count > 0;
}
