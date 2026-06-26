import { NextResponse } from "next/server";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { withDatabaseRetry } from "@/lib/prisma";
import { buildSubmittalPackagePdfBytesForDeliveryTicket } from "@/lib/submittal-package";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requirePermission(AppPermission.DELIVERY_VIEW);
    const { id } = await context.params;

    const result = await withDatabaseRetry((client) =>
      buildSubmittalPackagePdfBytesForDeliveryTicket(client, id),
    );

    return new NextResponse(Buffer.from(result.pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="submittals-${result.ticketNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate preview.";
    if (message === "Delivery ticket not found.") {
      return new NextResponse(message, { status: 404 });
    }
    return new NextResponse("Unauthorized or failed to generate preview.", {
      status: 403,
    });
  }
}
