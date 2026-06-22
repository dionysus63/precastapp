import { AppPermission } from "@/app/generated/prisma/client";
import { hasPermission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { buildExportFilename, excelResponse } from "@/lib/excel-export";
import { buildProductsExportBuffer } from "@/lib/product-export";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!hasPermission(user, AppPermission.PRODUCTS_VIEW)) {
    return new Response("Forbidden", { status: 403 });
  }

  const buffer = await buildProductsExportBuffer();
  return excelResponse(buffer, buildExportFilename("products"));
}
