import { AppPermission } from "@/app/generated/prisma/client";
import { hasPermission } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";
import { withDatabaseRetry } from "@/lib/prisma";
import { readSignedTicket, signedTicketJobCopyName } from "@/lib/ticket-scan/storage";

/**
 * A filed signed ticket for the routes that serve it. Anyone who can see
 * delivery tickets or invoices may look at the signed copy.
 */
export async function requireSignedTicketViewer(): Promise<void> {
  const user = await requireAuth();
  const [delivery, invoices] = await Promise.all([
    hasPermission(user, AppPermission.DELIVERY_VIEW),
    hasPermission(user, AppPermission.INVOICES_VIEW),
  ]);
  if (!delivery && !invoices) {
    throw new Error("You don't have permission to do that.");
  }
}

export type SignedTicketForRoute = {
  bytes: Buffer;
  /** "T10189 - Signed.pdf" */
  fileName: string;
  pageCount: number;
};

/** Null when there is no such signed file (or its ticket is gone). */
export async function loadSignedTicketFile(
  id: string,
): Promise<SignedTicketForRoute | null> {
  const file = await withDatabaseRetry((prisma) =>
    prisma.signedTicketFile.findUnique({
      where: { id },
      select: {
        filePath: true,
        pageCount: true,
        isCurrent: true,
        deliveryTicket: { select: { ticketNumber: true } },
      },
    }),
  );
  if (!file) {
    return null;
  }
  const bytes = await readSignedTicket(file.filePath);
  const number = file.deliveryTicket.ticketNumber ?? "Ticket";
  const name = signedTicketJobCopyName(number);
  return {
    bytes,
    fileName: file.isCurrent
      ? name
      : name.replace(/\.pdf$/, " (earlier version).pdf"),
    pageCount: file.pageCount,
  };
}
