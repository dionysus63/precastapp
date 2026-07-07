import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { AppPermission } from "@/app/generated/prisma/client";
import { hasPermission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { withDatabaseRetry } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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
        "Content-Disposition": `inline; filename="${fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Could not load vendor quote.", { status: 500 });
  }
}
