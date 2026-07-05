import { AppPermission } from "@/app/generated/prisma/client";
import { hasPermission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { buildExportFilename, excelResponse } from "@/lib/excel-export";
import { buildProductsExportBuffer } from "@/lib/product-export";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!(await hasPermission(user, AppPermission.PRODUCTS_VIEW))) {
    return new Response("Forbidden", { status: 403 });
  }

  const priceListId = new URL(request.url).searchParams.get("priceListId");
  const buffer = await buildProductsExportBuffer(priceListId);
  return excelResponse(buffer, buildExportFilename("products"));
}
