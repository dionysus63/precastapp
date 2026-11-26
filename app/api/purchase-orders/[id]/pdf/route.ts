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
import { purchaseOrderPdfFileName } from "@/lib/purchase-order-utils";
import { withDatabaseRetry } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * The purchase order as a PDF, drawn fresh from the saved data. `?download=1`
 * saves it as a file instead of showing it (the Drag PDF handle needs that).
 */
export async function GET(request: Request, context: RouteContext) {
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
    const fileName = purchaseOrderPdfFileName(
      purchaseOrder.poNumber,
      purchaseOrder.vendor.name,
    );

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition(
          new URL(request.url).searchParams.get("download") === "1"
            ? "attachment"
            : "inline",
          fileName,
        ),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return fileRouteErrorResponse(error, "Generating the purchase order PDF");
  }
}
