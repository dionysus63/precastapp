import { NextResponse } from "next/server";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { DELIVERY_TICKET_PDF_INCLUDE } from "@/lib/delivery-ticket-pdf-data";
import {
  generateDeliveryTicketCopyPdfBytes,
  generateDeliveryTicketPdfBytes,
} from "@/lib/delivery-ticket-pdf-fill";
import { withDatabaseRetry } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseCopyParam(value: string | null): number | null {
  if (value == null || value === "") {
    return null;
  }

  const copy = Number.parseInt(value, 10);
  if (!Number.isInteger(copy) || copy < 1 || copy > 3) {
    return null;
  }

  return copy;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    await requirePermission(AppPermission.DELIVERY_VIEW);
    const { id } = await context.params;
    const copy = parseCopyParam(new URL(request.url).searchParams.get("copy"));

    const ticket = await withDatabaseRetry((prisma) =>
      prisma.deliveryTicket.findUnique({
        where: { id },
        include: DELIVERY_TICKET_PDF_INCLUDE,
      }),
    );

    if (!ticket) {
      return new NextResponse("Delivery ticket not found.", { status: 404 });
    }

    const pdfBytes =
      copy != null
        ? await generateDeliveryTicketCopyPdfBytes(ticket, copy)
        : await generateDeliveryTicketPdfBytes(ticket);

    const filenameSuffix = copy != null ? `-copy-${copy}` : "";

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="delivery-ticket-${ticket.ticketNumber}${filenameSuffix}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Unauthorized or failed to generate preview.", {
      status: 403,
    });
  }
}