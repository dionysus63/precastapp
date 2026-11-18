import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { AppPermission } from "@/app/generated/prisma/client";
import { hasPermission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import {
  contentDisposition,
  fileRouteErrorResponse,
} from "@/lib/http-responses";
import { withDatabaseRetry } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * The vendor's quote filed with a purchase order. `?download=1` saves it as
 * a file instead of showing it (the Drag PDF handle needs that).
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
        select: { vendorQuotePath: true, vendorQuoteName: true },
      }),
    );

    if (!purchaseOrder?.vendorQuotePath) {
      return new NextResponse("Vendor quote not found.", { status: 404 });
    }

    const bytes = await readFile(purchaseOrder.vendorQuotePath);
    const fileName = purchaseOrder.vendorQuoteName ?? "vendor-quote.pdf";

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
    return fileRouteErrorResponse(error, "Loading the vendor quote");
  }
}
