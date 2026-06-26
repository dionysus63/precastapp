"use server";

import { writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { DELIVERY_TICKET_PDF_INCLUDE } from "@/lib/delivery-ticket-pdf-data";
import { generateDeliveryTicketPdfBytes } from "@/lib/delivery-ticket-pdf-fill";
import {
  getJobsRoot,
  getJobSubfolders,
  getQuotePdfFallbackDir,
} from "@/lib/app-settings";
import { assertPathUnderJobsRoot } from "@/lib/job-path-security";
import {
  buildQuotePdfBaseName,
  resolveQuotePdfOutputPath,
} from "@/lib/quote-pdf-path";
import { registerJobFile } from "@/lib/job-files-service";
import { withDatabaseRetry } from "@/lib/prisma";

export type GenerateDeliveryTicketPdfResult =
  | { success: true; filePath: string }
  | { success: false; error: string };

export type DeliveryTicketPdfPreviewResult =
  | { success: true; base64: string }
  | { success: false; error: string };

async function loadTicketForPdf(ticketId: string) {
  return withDatabaseRetry((prisma) =>
    prisma.deliveryTicket.findUnique({
      where: { id: ticketId },
      include: DELIVERY_TICKET_PDF_INCLUDE,
    }),
  );
}

export async function getDeliveryTicketPdfPreviewBase64(
  ticketId: string,
): Promise<DeliveryTicketPdfPreviewResult> {
  await requirePermission(AppPermission.DELIVERY_MANAGE);
  if (!ticketId.trim()) {
    return { success: false, error: "Ticket id is required." };
  }

  try {
    const ticket = await loadTicketForPdf(ticketId);
    if (!ticket) {
      return { success: false, error: "Delivery ticket not found." };
    }

    const pdfBytes = await generateDeliveryTicketPdfBytes(ticket);
    return {
      success: true,
      base64: Buffer.from(pdfBytes).toString("base64"),
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate delivery ticket preview.";
    return { success: false, error: message };
  }
}

export async function generateDeliveryTicketPdf(
  ticketId: string,
): Promise<GenerateDeliveryTicketPdfResult> {
  await requirePermission(AppPermission.DELIVERY_MANAGE);
  if (!ticketId.trim()) {
    return { success: false, error: "Ticket id is required." };
  }

  try {
    const ticket = await loadTicketForPdf(ticketId);

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

    const pdfBytes = await generateDeliveryTicketPdfBytes(ticket);
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

    // The job folder comes from the DB; keep the write inside the jobs root.
    if (jobFolderPath?.trim()) {
      assertPathUnderJobsRoot(await getJobsRoot(), outputPath);
    }

    await writeFile(outputPath, pdfBytes);

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
