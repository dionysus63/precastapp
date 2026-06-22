"use server";

import path from "path";
import { revalidatePath } from "next/cache";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { mapDbDeliveryTicketToDetailView } from "@/lib/delivery-ticket-mapper";
import { buildDeliveryTicketPdfHtml } from "@/lib/delivery-ticket-pdf-html";
import {
  getJobSubfolders,
  getQuotePdfFallbackDir,
} from "@/lib/app-settings";
import {
  buildQuotePdfBaseName,
  resolveQuotePdfOutputPath,
} from "@/lib/quote-pdf-path";
import { writeQuotePdfFromHtml } from "@/lib/quote-pdf";
import { registerJobFile } from "@/lib/job-files-service";
import { withDatabaseRetry } from "@/lib/prisma";

export type GenerateDeliveryTicketPdfResult =
  | { success: true; filePath: string }
  | { success: false; error: string };

export async function generateDeliveryTicketPdf(
  ticketId: string,
): Promise<GenerateDeliveryTicketPdfResult> {
  await requirePermission(AppPermission.DELIVERY_MANAGE);
  if (!ticketId.trim()) {
    return { success: false, error: "Ticket id is required." };
  }

  try {
    const ticket = await withDatabaseRetry((prisma) =>
      prisma.deliveryTicket.findUnique({
        where: { id: ticketId },
        include: {
          lineItems: { orderBy: { lineNumber: "asc" } },
        },
      }),
    );

    if (!ticket) {
      return { success: false, error: "Delivery ticket not found." };
    }

    let jobFolderPath: string | null = null;
    if (ticket.jobId) {
      const job = await withDatabaseRetry((prisma) =>
        prisma.job.findUnique({
          where: { id: ticket.jobId! },
          select: { folderPath: true },
        }),
      );
      jobFolderPath = job?.folderPath ?? null;
    }

    const detail = mapDbDeliveryTicketToDetailView(ticket);
    const html = await buildDeliveryTicketPdfHtml(detail);
    const baseName = buildQuotePdfBaseName(
      ticket.ticketNumber,
      ticket.customerName,
      ticket.projectName,
    );
    const subfolders = await getJobSubfolders();
    const deliverySubfolder = subfolders[4] ?? "05 Delivery Tickets";
    const fallbackDir = await getQuotePdfFallbackDir();
    const outputDirectory = jobFolderPath?.trim()
      ? path.join(jobFolderPath.trim(), deliverySubfolder)
      : path.join(fallbackDir, "..", "DeliveryTickets");
    const outputPath = await resolveQuotePdfOutputPath(outputDirectory, baseName);

    await writeQuotePdfFromHtml(html, outputPath);

    await withDatabaseRetry((client) =>
      client.deliveryTicket.update({
        where: { id: ticketId },
        data: { paperTicketPrinted: true },
      }),
    );

    revalidatePath("/delivery-tickets");
    revalidatePath(`/delivery-tickets/${ticketId}`);
    revalidatePath(`/delivery-tickets/${ticketId}/preview`);

    if (ticket.jobId && jobFolderPath) {
      await withDatabaseRetry((client) =>
        registerJobFile(
          client,
          ticket.jobId!,
          outputPath,
          deliverySubfolder,
        ),
      );
    }

    return { success: true, filePath: outputPath };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate delivery ticket PDF.";
    return { success: false, error: message };
  }
}
