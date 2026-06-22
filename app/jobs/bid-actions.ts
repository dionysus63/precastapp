"use server";

import { revalidatePath } from "next/cache";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { cloneQuoteForBidder } from "@/lib/quote-clone";
import { isAwardableQuoteStatus, isRemovableBidderQuoteStatus } from "@/lib/job-bid-utils";
import { withDatabaseRetry } from "@/lib/prisma";

export async function addJobBidder(jobId: string, customerId: string) {
  await requirePermission(AppPermission.JOBS_MANAGE);

  if (!jobId.trim() || !customerId.trim()) {
    return { error: "Job and customer are required." };
  }

  try {
    await withDatabaseRetry(async (client) => {
      const job = await client.job.findUnique({
        where: { id: jobId },
        select: { id: true },
      });
      if (!job) {
        throw new Error("Job was not found.");
      }

      const customer = await client.customer.findUnique({
        where: { id: customerId },
        select: { id: true },
      });
      if (!customer) {
        throw new Error("Customer was not found.");
      }

      const existing = await client.jobBidder.findUnique({
        where: { jobId_customerId: { jobId, customerId } },
        select: { id: true },
      });
      if (existing) {
        throw new Error("This contractor is already on the bid list.");
      }

      const maxSort = await client.jobBidder.aggregate({
        where: { jobId },
        _max: { sortOrder: true },
      });

      await client.jobBidder.create({
        data: {
          jobId,
          customerId,
          sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        },
      });
    });

    revalidatePath(`/jobs/${jobId}`);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not add bidder.",
    };
  }
}

export async function removeJobBidder(jobBidderId: string) {
  await requirePermission(AppPermission.JOBS_MANAGE);

  try {
    const jobId = await withDatabaseRetry(async (client) => {
      const bidder = await client.jobBidder.findUnique({
        where: { id: jobBidderId },
        include: {
          quotes: { select: { id: true, status: true } },
        },
      });

      if (!bidder) {
        throw new Error("Bidder was not found.");
      }

      if (bidder.quotes.some((quote) => quote.status === "WON")) {
        throw new Error("Cannot remove the winning contractor from the bid list.");
      }

      const blockingQuote = bidder.quotes.find(
        (quote) => !isRemovableBidderQuoteStatus(quote.status),
      );
      if (blockingQuote) {
        throw new Error(
          "Remove or reassign active quotes for this contractor before removing them from the bid list.",
        );
      }

      if (bidder.quotes.length > 0) {
        await client.quote.deleteMany({
          where: { jobBidderId: jobBidderId },
        });
      }

      await client.jobBidder.delete({ where: { id: jobBidderId } });
      return bidder.jobId;
    });

    revalidatePath(`/jobs/${jobId}`);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not remove bidder.",
    };
  }
}

export async function generateQuotesFromMaster(
  jobId: string,
  templateQuoteId: string,
  options?: {
    bidderIds?: string[];
    contactByBidderId?: Record<string, string>;
  },
) {
  await requirePermission(AppPermission.QUOTES_MANAGE);

  try {
    const createdQuoteIds = await withDatabaseRetry(async (client) => {
      const job = await client.job.findUnique({
        where: { id: jobId },
        select: { id: true },
      });
      if (!job) {
        throw new Error("Job was not found.");
      }

      const template = await client.quote.findFirst({
        where: { id: templateQuoteId, jobId },
        include: { lineItems: { take: 1 } },
      });
      if (!template) {
        throw new Error("Template quote was not found on this job.");
      }
      if (template.lineItems.length === 0) {
        throw new Error("Template quote has no line items to copy.");
      }

      const bidders = await client.jobBidder.findMany({
        where: {
          jobId,
          ...(options?.bidderIds?.length
            ? { id: { in: options.bidderIds } }
            : {}),
        },
        include: {
          customer: { select: { name: true } },
          quotes: { select: { id: true } },
        },
        orderBy: { sortOrder: "asc" },
      });

      const targets = bidders.filter((bidder) => bidder.quotes.length === 0);
      if (targets.length === 0) {
        throw new Error("All bidders on this job already have quotes.");
      }

      const ids: string[] = [];
      await client.$transaction(async (tx) => {
        for (const bidder of targets) {
          const contactId = options?.contactByBidderId?.[bidder.id];
          if (contactId) {
            const contact = await tx.contact.findFirst({
              where: { id: contactId, customerId: bidder.customerId },
              select: { id: true },
            });
            if (!contact) {
              throw new Error(
                `Selected contact for ${bidder.customer.name} is invalid.`,
              );
            }
          }

          ids.push(
            await cloneQuoteForBidder(
              tx,
              templateQuoteId,
              bidder.id,
              contactId ?? null,
            ),
          );
        }
      });

      return ids;
    });

    revalidatePath(`/jobs/${jobId}`);
    revalidatePath("/quotes");
    for (const quoteId of createdQuoteIds) {
      revalidatePath(`/quotes/${quoteId}`);
    }

    return { success: true, createdQuoteIds };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not generate quotes.",
    };
  }
}

export async function awardJob(
  jobId: string,
  jobBidderId: string,
  quoteId: string,
) {
  await requirePermission(AppPermission.JOBS_MANAGE);

  try {
    await withDatabaseRetry(async (client) => {
      await client.$transaction(async (tx) => {
        const job = await tx.job.findUnique({
          where: { id: jobId },
          select: { status: true, awardedDate: true },
        });
        if (!job) {
          throw new Error("Job was not found.");
        }
        if (job.status === "AWARDED" || job.awardedDate) {
          throw new Error("This job has already been awarded.");
        }

        const bidder = await tx.jobBidder.findUnique({
          where: { id: jobBidderId },
          include: { customer: true },
        });
        if (!bidder || bidder.jobId !== jobId) {
          throw new Error("Winning contractor was not found on this job.");
        }

        const quote = await tx.quote.findFirst({
          where: { id: quoteId, jobId, jobBidderId },
        });
        if (!quote) {
          throw new Error("Winning quote was not found for this contractor.");
        }
        if (!isAwardableQuoteStatus(quote.status)) {
          throw new Error("This quote cannot be used to award the job.");
        }

        await tx.job.update({
          where: { id: jobId },
          data: {
            customerId: bidder.customerId,
            customerName: bidder.customer.name,
            contactName:
              quote.contactName ??
              bidder.customer.primaryContactName ??
              null,
            contactEmail:
              quote.contactEmail ?? bidder.customer.email ?? null,
            contactPhone:
              quote.contactPhone ?? bidder.customer.phone ?? null,
            awardedDate: new Date(),
            status: "AWARDED",
          },
        });

        await tx.jobBidder.updateMany({
          where: { jobId },
          data: { isWinner: false },
        });
        await tx.jobBidder.update({
          where: { id: jobBidderId },
          data: { isWinner: true },
        });

        await tx.quote.update({
          where: { id: quoteId },
          data: { status: "WON" },
        });

        await tx.quote.updateMany({
          where: {
            jobId,
            id: { not: quoteId },
            jobBidderId: { not: null },
            status: { in: ["DRAFT", "IN_REVIEW", "SENT", "REVISED"] },
          },
          data: { status: "LOST_BC" },
        });

        const { linkJobStructuresFromQuoteInTransaction } = await import(
          "@/lib/job-structure-workflow"
        );
        await linkJobStructuresFromQuoteInTransaction(tx, quoteId);
      });
    });

    revalidatePath(`/jobs/${jobId}`);
    revalidatePath("/jobs");
    revalidatePath("/quotes");
    revalidatePath(`/quotes/${quoteId}`);
    revalidatePath("/production");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not award job.",
    };
  }
}

export async function listCustomersForBidList() {
  await requirePermission(AppPermission.JOBS_MANAGE);
  return withDatabaseRetry((client) =>
    client.customer.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        primaryContactName: true,
        email: true,
        phone: true,
      },
    }),
  );
}
