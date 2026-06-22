import { AppPermission } from "@/app/generated/prisma/client";
import { hasPermission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { buildCustomersExportBuffer } from "@/lib/customer-export";
import { buildExportFilename, excelResponse } from "@/lib/excel-export";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!hasPermission(user, AppPermission.CUSTOMERS_VIEW)) {
    return new Response("Forbidden", { status: 403 });
  }

  const buffer = await buildCustomersExportBuffer();
  return excelResponse(buffer, buildExportFilename("customers"));
}
