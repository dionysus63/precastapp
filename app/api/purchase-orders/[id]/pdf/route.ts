import { NextResponse } from "next/server";
import { AppPermission } from "@/app/generated/prisma/client";
import { hasPermission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import {
  contentDisposition,
  fileRouteErrorResponse,
} from "@/lib/http-responses";
import {
  generatePurchaseOrderPdfBytes,
  purchaseOrderForPdfSelect,
} from "@/lib/purchase-order-pdf-data";
import { withDatabaseRetry } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** The purchase order as a PDF, drawn fresh from the saved data. */
export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user || !(await hasPermission(user, AppPermission.INVENTORY_VIEW))) {
    return new NextResponse("Unauthorized.", { status: 403 });
  }

  try {
    const { id } = await context.params;
    const purchaseOrder = await withDatabaseRetry((client) =>
      client.purchaseOrder.findUnique({
        where: { id },
        select: purchaseOrderForPdfSelect,
      }),
    );
    if (!purchaseOrder) {
      return new NextResponse("Purchase order not found.", { status: 404 });
    }

    const bytes = await generatePurchaseOrderPdfBytes(purchaseOrder);
    const fileName = `Purchase Order ${purchaseOrder.poNumber} - ${purchaseOrder.vendor.name}.pdf`;

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition("inline", fileName),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return fileRouteErrorResponse(error, "Generating the purchase order PDF");
  }
}
