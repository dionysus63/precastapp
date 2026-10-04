import { createHash } from "crypto";
import type { Prisma, PrismaClient } from "@/app/generated/prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * A fingerprint of what the product edit form saves: the catalog fields and
 * the casting parts list. The form's "changed by someone else" check
 * compares this rather than Product.updatedAt, which every delivery, receipt
 * or production entry bumps (stock lives on the row) — so busy products
 * rejected saves nobody had actually conflicted with.
 */
export async function loadProductEditVersion(
  client: DbClient,
  productId: string,
): Promise<string | null> {
  const product = await client.product.findUnique({
    where: { id: productId },
    include: {
      castingAssemblyComponents: {
        orderBy: { pieceRole: "asc" },
        select: { componentId: true, pieceRole: true, quantity: true },
      },
    },
  });
  if (!product) {
    return null;
  }
  const { currentStockQuantity, updatedAt, createdAt, ...editable } = product;
  void currentStockQuantity;
  void updatedAt;
  void createdAt;
  return createHash("sha1").update(JSON.stringify(editable)).digest("hex");
}
