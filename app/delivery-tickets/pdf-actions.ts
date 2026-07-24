"use server";

import { unlink, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { DELIVERY_TICKET_PDF_INCLUDE } from "@/lib/delivery-ticket-pdf-data";
import { generateDeliveryTicketPdfBytes } from "@/lib/delivery-ticket-pdf-fill";
import {
  getAppSettings,
  getJobsRoot,
  getJobSubfolders,
  getQuotePdfFallbackDir,
} from "@/lib/app-settings";
import { printPdfBytesOnServer } from "@/lib/ticket-printing";
import {
  assertPathUnderJobsRoot,
  assertPathUnderRoot,
} from "@/lib/job-path-security";
import {
  buildQuotePdfBaseName,
  resolveQuotePdfOutputPath,
} from "@/lib/quote-pdf-path";
import { registerJobFile } from "@/lib/job-files-service";
import { withDatabaseRetry } from "@/lib/prisma";
import { loadJobDeliverySchedule } from "@/lib/delivery-schedule-data";
import { buildDeliverySchedulePdfHtml } from "@/lib/delivery-schedule-pdf-html";
import { renderPdfBytesFromHtml } from "@/lib/quote-pdf";
import { sanitizeFilenamePart } from "@/lib/quote-pdf-path";

export type GenerateDeliveryTicketPdfResult =
  | { success: true; filePath: string }
  | { success: false; error: string };

export type PrintDeliveryTicketDirectResult =
  | { success: true; printer: string }
  | { success: false; error: string };

/**
 * Silent print of the full 3-copy ticket PDF on the server's configured
 * ticket printer (Settings -> Fleet & Crew). The UI falls back to the
 * browser print dialog when no printer is configured.
 */
export async function printDeliveryTicketDirect(
  ticketId: string,
): Promise<PrintDeliveryTicketDirectResult> {
  await requirePermission(AppPermission.DELIVERY_MANAGE);
  if (!ticketId.trim()) {
    return { success: false, error: "Ticket id is required." };
  }

  try {
    const settings = await getAppSettings();
    const printer = settings.ticketPrinterName;
    if (!printer) {
      return {
        success: false,
        error:
          "No ticket printer is configured. Set one under Settings → Fleet & Crew.",
      };
    }

    const ticket = await loadTicketForPdf(ticketId);
    if (!ticket) {
      return { success: false, error: "Delivery ticket not found." };
    }

    const pdfBytes = await generateDeliveryTicketPdfBytes(ticket);
    await printPdfBytesOnServer(pdfBytes, {
      printer,
      monochrome: settings.ticketPrintColorMode === "monochrome",
    });

    // Best-effort flag, same as the save-to-folder path: a failed update
    // should not report the print itself as failed.
    try {
      await withDatabaseRetry((client) =>
        client.deliveryTicket.update({
          where: { id: ticketId },
          data: { paperTicketPrinted: true },
        }),
      );
      revalidatePath(`/delivery-tickets/${ticketId}`);
    } catch {
      // Ignore; the paper copy is already printing.
    }

    return { success: true, printer };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to print the ticket.";
    return { success: false, error: message };
  }
}

/**
 * Silent print of the ticket's submittal package on the server's configured
 * submittal printer (Settings -> Printing).
 */
export async function printDeliveryTicketSubmittalsDirect(
  ticketId: string,
): Promise<PrintDeliveryTicketDirectResult> {
  await requirePermission(AppPermission.DELIVERY_MANAGE);
  if (!ticketId.trim()) {
    return { success: false, error: "Ticket id is required." };
  }

  try {
    const settings = await getAppSettings();
    const printer = settings.submittalPrinterName;
    if (!printer) {
      return {
        success: false,
        error:
          "No submittal printer is configured. Set one under Settings → Printing.",
      };
    }

    const { buildSubmittalPackagePdfBytesForDeliveryTicket } = await import(
      "@/lib/submittal-package"
    );
    const { pdfBytes } = await withDatabaseRetry((client) =>
      buildSubmittalPackagePdfBytesForDeliveryTicket(client, ticketId),
    );
    await printPdfBytesOnServer(pdfBytes, {
      printer,
      monochrome: settings.submittalPrintColorMode === "monochrome",
    });

    return { success: true, printer };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to print the submittal package.";
    return { success: false, error: message };
  }
}

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

export type SaveDeliverySchedulePdfResult =
  | { success: true; filePath: string }
  | { success: false; error: string };

/**
 * Archive the internal delivery-schedule document into the job's files folder
 * so the office keeps a dated copy of what was sent to the contractor.
 */
export async function saveDeliverySchedulePdf(
  jobId: string,
): Promise<SaveDeliverySchedulePdfResult> {
  await requirePermission(AppPermission.DELIVERY_MANAGE);
  if (!jobId.trim()) {
    return { success: false, error: "Job id is required." };
  }

  try {
    const schedule = await loadJobDeliverySchedule(jobId);
    if (!schedule) {
      return { success: false, error: "Job not found." };
    }
    const jobFolderPath = schedule.job.folderPath?.trim();
    if (!jobFolderPath) {
      return {
        success: false,
        error: "This job has no folder yet — create the job folder first.",
      };
    }

    const html = await buildDeliverySchedulePdfHtml(schedule, "internal");
    const pdfBytes = await renderPdfBytesFromHtml(html);

    const now = new Date();
    const datePart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const baseName = [
      "Delivery Schedule",
      sanitizeFilenamePart(schedule.job.jobNumber),
      sanitizeFilenamePart(schedule.job.projectName),
      datePart,
    ]
      .filter(Boolean)
      .join(" - ");

    const subfolders = await getJobSubfolders();
    const deliverySubfolder = subfolders[4] ?? "05 Delivery Tickets";
    const outputDirectory = path.join(jobFolderPath, deliverySubfolder);
    const outputPath = await resolveQuotePdfOutputPath(outputDirectory, baseName);
    assertPathUnderJobsRoot(await getJobsRoot(), outputPath);

    await writeFile(outputPath, pdfBytes);

    try {
      await withDatabaseRetry((client) =>
        registerJobFile(client, jobId, outputPath, deliverySubfolder),
      );
    } catch (error) {
      // DB registration failed; remove the just-written PDF so no orphan is left.
      await unlink(outputPath).catch(() => {});
      throw error;
    }

    revalidatePath(`/jobs/${jobId}`);
    return { success: true, filePath: outputPath };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to save the delivery schedule PDF.";
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
      ticket.ticketNumber ?? "DRAFT",
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
    } else {
      // Fallback output lives in a sibling of the configured fallback dir;
      // keep the write under that shared parent.
      assertPathUnderRoot(path.join(fallbackDir, ".."), outputPath);
    }

    await writeFile(outputPath, pdfBytes);

    try {
      await withDatabaseRetry((client) =>
        client.deliveryTicket.update({
          where: { id: ticketId },
          data: { paperTicketPrinted: true },
        }),
      );

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
    } catch (error) {
      // DB steps failed; remove the just-written PDF so no orphan is left.
      await unlink(outputPath).catch(() => {});
      throw error;
    }

    revalidatePath("/delivery-tickets");
    revalidatePath(`/delivery-tickets/${ticketId}`);
    revalidatePath(`/delivery-tickets/${ticketId}/preview`);

    return { success: true, filePath: outputPath };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate delivery ticket PDF.";
    return { success: false, error: message };
  }
}
