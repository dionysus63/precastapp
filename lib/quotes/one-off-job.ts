import "server-only";

import { withDatabaseRetry } from "@/lib/prisma";
import type { OneOffJobDetails } from "@/lib/quotes/one-off-draft";

/**
 * A job as the One-Off page's job step shows it, with the structure numbers
 * already taken on it. Shared by the job picker and by resuming a draft, so
 * both see the same (fresh) numbers.
 */
export async function loadOneOffJobDetails(
  jobId: string,
): Promise<OneOffJobDetails | null> {
  const job = await withDatabaseRetry((client) =>
    client.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        jobNumber: true,
        customerName: true,
        projectName: true,
        projectAddress: true,
        city: true,
        state: true,
        zip: true,
        contactName: true,
        contactPhone: true,
        contactEmail: true,
        jobStructures: {
          select: { structureNumber: true, calc: { select: { id: true } } },
        },
      },
    }),
  );
  if (!job) {
    return null;
  }

  const { jobStructures, ...details } = job;
  return {
    ...details,
    structureNumbers: jobStructures
      .map((structure) => structure.structureNumber ?? "")
      .filter(Boolean),
    sheetCount: jobStructures.filter((structure) => structure.calc != null)
      .length,
  };
}
