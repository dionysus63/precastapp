"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, AppPermission } from "@/app/generated/prisma/client";
import { assertPathUnderStockSubmittalsRoot } from "@/lib/product-path-security";
import { requirePermission } from "@/lib/auth/session";
import {
  deleteProductDocument,
  getProductDocumentForOpen,
  getProductSubmittalDir,
  scanProductDocuments,
  uploadProductDocument,
} from "@/lib/product-submittals-service";
import { prisma, withDatabaseRetry } from "@/lib/prisma";
import {
  assertSanitaryDrainRingAllowed,
  isRecognizedBulkRingStyle,
  parseBulkRingStyle,
  parseDrainRingStyle,
} from "@/lib/drain-ring-utils";
import { launchWindowsFile, launchWindowsFolder } from "@/lib/windows-explorer";
import {
  mergeCatalogWithInUseValues,
} from "@/lib/product-catalog-settings";
import { getProductCatalog } from "@/lib/product-catalog-settings.server";

const PRODUCT_STATUSES = ["ACTIVE", "INACTIVE", "DISCONTINUED"] as const;
const PRODUCT_TYPES = [
  "STOCK",
  "CONFIGURABLE",
  "CUSTOM_STRUCTURE",
  "SERVICE",
  "MATERIAL",
] as const;

type ProductStatus = (typeof PRODUCT_STATUSES)[number];
type ProductType = (typeof PRODUCT_TYPES)[number];

function parseRequiredString(formData: FormData, field: string, label: string) {
  const value = String(formData.get(field) ?? "").trim();
  if (!value) {
    throw new Error(`${label} is required.`);
  }
  return value;
}

function parseOptionalNonNegativeDecimal(
  formData: FormData,
  field: string,
  label: string,
): Prisma.Decimal | null {
  const raw = String(formData.get(field) ?? "").trim();
  if (!raw) {
    return null;
  }

  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw new Error(`${label} must be a number.`);
  }
  if (value < 0) {
    throw new Error(`${label} cannot be negative.`);
  }

  return new Prisma.Decimal(raw);
}

function parseNonNegativeInt(
  formData: FormData,
  field: string,
  label: string,
  defaultValue: number,
) {
  const raw = String(formData.get(field) ?? "").trim();
  if (!raw) {
    return defaultValue;
  }

  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be a whole number.`);
  }
  if (value < 0) {
    throw new Error(`${label} cannot be negative.`);
  }

  return value;
}

function parseProductStatus(formData: FormData): ProductStatus {
  const status = String(formData.get("status") ?? "ACTIVE").trim();

  if (!PRODUCT_STATUSES.includes(status as ProductStatus)) {
    throw new Error("Invalid product status.");
  }

  return status as ProductStatus;
}

function parseProductType(formData: FormData): ProductType {
  const productType = String(formData.get("productType") ?? "STOCK").trim();

  if (!PRODUCT_TYPES.includes(productType as ProductType)) {
    throw new Error("Product type is required.");
  }

  return productType as ProductType;
}

function parseProductFormData(formData: FormData) {
  const productCode = parseRequiredString(formData, "productCode", "Product code");
  const name = parseRequiredString(formData, "productName", "Product name");
  const productType = parseProductType(formData);

  const unit = String(formData.get("unit") ?? "EA").trim() || "EA";
  const status = parseProductStatus(formData);

  const category = String(formData.get("category") ?? "").trim() || "Vaults";
  const description = String(formData.get("description") ?? "").trim() || null;
  const trackInventory = String(formData.get("trackInventory") ?? "yes") === "yes";
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const defaultPrice = parseOptionalNonNegativeDecimal(
    formData,
    "defaultPrice",
    "Default price",
  );
  const cost = parseOptionalNonNegativeDecimal(formData, "cost", "Cost");
  const weight = parseOptionalNonNegativeDecimal(formData, "weight", "Weight");
  const yards = parseOptionalNonNegativeDecimal(formData, "yards", "Yards");

  const currentStockQuantity = parseNonNegativeInt(
    formData,
    "currentStockQuantity",
    "Current stock quantity",
    0,
  );
  const reorderLevel = parseNonNegativeInt(
    formData,
    "reorderLevel",
    "Reorder level",
    0,
  );

  const isDrainRing = String(formData.get("isDrainRing") ?? "no") === "yes";
  const heightFeet = isDrainRing
    ? parseOptionalNonNegativeDecimal(formData, "heightFeet", "Ring height")
    : null;
  const ringDiameterFeet = isDrainRing
    ? parseOptionalNonNegativeDecimal(
        formData,
        "ringDiameterFeet",
        "Pool diameter",
      )
    : null;

  if (isDrainRing && (!heightFeet || !ringDiameterFeet)) {
    throw new Error(
      "Rings require both a ring height and a pool diameter.",
    );
  }

  const drainRingStyle = isDrainRing
    ? parseDrainRingStyle(String(formData.get("drainRingStyle") ?? "DRAIN"))
    : "DRAIN";

  if (isDrainRing) {
    assertSanitaryDrainRingAllowed(
      ringDiameterFeet ? Number(ringDiameterFeet) : null,
      drainRingStyle,
      "Product",
    );
  }

  const isCasting = String(formData.get("isCasting") ?? "no") === "yes";

  if (isCasting && isDrainRing) {
    throw new Error("A product cannot be both a ring and a casting.");
  }

  const castingHeightFeet = isCasting
    ? parseOptionalNonNegativeDecimal(
        formData,
        "castingHeightFeet",
        "Casting height",
      )
    : null;
  const castingClearOpeningInches = isCasting
    ? parseOptionalNonNegativeDecimal(
        formData,
        "castingClearOpeningInches",
        "Clear opening",
      )
    : null;

  if (isCasting && !castingHeightFeet) {
    throw new Error("Castings require a casting height.");
  }

  return {
    productCode,
    name,
    productType,
    category,
    description,
    unit,
    defaultPrice,
    cost,
    weight,
    yards,
    trackInventory,
    currentStockQuantity,
    reorderLevel,
    status,
    notes,
    isDrainRing,
    heightFeet: isCasting ? castingHeightFeet : heightFeet,
    ringDiameterFeet,
    drainRingStyle,
    isCasting,
    castingClearOpeningInches,
  };
}

export async function createProduct(formData: FormData) {
  await requirePermission(AppPermission.PRODUCTS_MANAGE);
  const data = parseProductFormData(formData);

  await prisma.product.create({ data });

  revalidatePath("/products");
  redirect("/products");
}

type BulkImportRow = {
  productCode: string;
  productName: string;
  category: string;
  subcategory: string;
  unit: string;
  defaultPrice: string;
  weight: string;
  yards: string;
  trackInventory: string;
  isDrainRing?: string;
  ringDiameterFeet?: string;
  heightFeet?: string;
  ringStyle?: string;
};

function parseBulkNumeric(
  raw: string,
  label: string,
  lineNumber: number,
): Prisma.Decimal | null {
  const cleaned = raw.replace(/[$,]/g, "").replace(/[^\d.]/g, "").trim();
  if (!cleaned) {
    return null;
  }

  const value = Number(cleaned);
  if (Number.isNaN(value)) {
    throw new Error(`Line ${lineNumber}: ${label} must be a number.`);
  }
  if (value < 0) {
    throw new Error(`Line ${lineNumber}: ${label} cannot be negative.`);
  }

  return new Prisma.Decimal(cleaned);
}

function mapBulkImportRow(row: BulkImportRow, lineNumber: number) {
  const productCode = row.productCode.trim();
  const name = row.productName.trim();

  if (!productCode) {
    throw new Error(`Line ${lineNumber}: Product code is required.`);
  }
  if (!name) {
    throw new Error(`Line ${lineNumber}: Product name is required.`);
  }

  const unit = row.unit.trim() || "EA";
  const category = row.category.trim() || "Vaults";

  const inventoryValue = row.trackInventory.trim().toLowerCase();
  if (inventoryValue && inventoryValue !== "yes" && inventoryValue !== "no") {
    throw new Error(
      `Line ${lineNumber}: Track inventory must be "Yes" or "No".`,
    );
  }
  const trackInventory = inventoryValue !== "no";

  const drainRingValue = String(row.isDrainRing ?? "").trim().toLowerCase();
  const isDrainRing = drainRingValue === "yes";
  if (
    row.isDrainRing?.trim() &&
    drainRingValue !== "yes" &&
    drainRingValue !== "no"
  ) {
    throw new Error(
      `Line ${lineNumber}: Ring must be "Yes" or "No".`,
    );
  }

  const heightFeet = isDrainRing
    ? parseBulkNumeric(
        String(row.heightFeet ?? ""),
        "Ring height",
        lineNumber,
      )
    : null;
  const ringDiameterFeet = isDrainRing
    ? parseBulkNumeric(
        String(row.ringDiameterFeet ?? ""),
        "Pool diameter",
        lineNumber,
      )
    : null;

  if (isDrainRing && (!heightFeet || !ringDiameterFeet)) {
    throw new Error(
      `Line ${lineNumber}: Rings require both a pool diameter and ring height.`,
    );
  }

  const drainRingStyle = isDrainRing
    ? parseBulkRingStyle(String(row.ringStyle ?? ""))
    : "DRAIN";

  if (row.ringStyle?.trim() && !isRecognizedBulkRingStyle(row.ringStyle)) {
    throw new Error(
      `Line ${lineNumber}: Style must be "DRAIN", "SAN", or legacy "Yes"/"No".`,
    );
  }

  if (isDrainRing) {
    assertSanitaryDrainRingAllowed(
      ringDiameterFeet ? Number(ringDiameterFeet) : null,
      drainRingStyle,
      `Line ${lineNumber}`,
    );
  }

  return {
    productCode,
    name,
    productType: "STOCK" as ProductType,
    category,
    description: row.subcategory.trim() || null,
    unit: unit === "Each" ? "EA" : unit,
    defaultPrice: parseBulkNumeric(row.defaultPrice, "Default price", lineNumber),
    cost: null,
    weight: parseBulkNumeric(row.weight, "Weight", lineNumber),
    yards: parseBulkNumeric(row.yards, "Yards", lineNumber),
    trackInventory,
    currentStockQuantity: 0,
    reorderLevel: 0,
    status: "ACTIVE" as ProductStatus,
    notes: null,
    isDrainRing,
    heightFeet,
    ringDiameterFeet,
    drainRingStyle,
  };
}

export type ImportProductsResult = { imported: number };

export async function importProducts(
  formData: FormData,
): Promise<ImportProductsResult> {
  await requirePermission(AppPermission.PRODUCTS_MANAGE);
  const raw = String(formData.get("products") ?? "").trim();
  if (!raw) {
    throw new Error("No products to import.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid import data.");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("No products to import.");
  }

  const rowsByProductCode = new Map<string, number[]>();
  const products = parsed.map((row, index) => {
    const mapped = mapBulkImportRow(row as BulkImportRow, index + 1);
    const lineNumbers = rowsByProductCode.get(mapped.productCode) ?? [];
    lineNumbers.push(index + 1);
    rowsByProductCode.set(mapped.productCode, lineNumbers);
    return mapped;
  });

  const duplicates = [...rowsByProductCode.entries()].filter(
    ([, lineNumbers]) => lineNumbers.length > 1,
  );
  if (duplicates.length > 0) {
    const details = duplicates
      .map(
        ([productCode, lineNumbers]) =>
          `${productCode} (lines ${lineNumbers.join(", ")})`,
      )
      .join("; ");
    throw new Error(`Duplicate product code(s) in pasted data: ${details}.`);
  }

  try {
    const currentCatalog = await getProductCatalog();
    const catalogPairs = products.map((product) => ({
      category: product.category,
      subcategory: product.description ?? "",
    }));
    const updatedCatalog = mergeCatalogWithInUseValues(
      currentCatalog,
      catalogPairs,
    );

    await prisma.$transaction(async (tx) => {
      for (const product of products) {
        await tx.product.create({ data: product });
      }
      await tx.appSettings.update({
        where: { id: "default" },
        data: {
          productCatalog: updatedCatalog as Prisma.InputJsonValue,
        },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error(
        "Import failed: one or more product codes already exist in the database.",
      );
    }
    throw error;
  }

  revalidatePath("/products");
  revalidatePath("/products/new");
  revalidatePath("/settings/products");
  return { imported: products.length };
}

export type ProductExplorerOpenResult = {
  success: true;
  path: string;
};

function revalidateProductPaths(productId: string) {
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${productId}`);
}

export async function uploadProductDocumentAction(formData: FormData) {
  await requirePermission(AppPermission.PRODUCTS_MANAGE);
  const productId = String(formData.get("productId") ?? "").trim();
  const documentType = String(formData.get("documentType") ?? "GENERIC_SUBMITTAL").trim();
  const file = formData.get("file");

  if (!productId) {
    throw new Error("Product is required.");
  }

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose a file to upload.");
  }

  await withDatabaseRetry((client) =>
    uploadProductDocument(client, productId, documentType, file),
  );

  revalidateProductPaths(productId);
}

export async function scanProductDocumentsAction(productId: string) {
  await requirePermission(AppPermission.PRODUCTS_MANAGE);
  const result = await withDatabaseRetry((client) =>
    scanProductDocuments(client, productId),
  );

  revalidateProductPaths(productId);
  return result;
}

export async function openProductDocument(
  documentId: string,
): Promise<ProductExplorerOpenResult & { documentName: string }> {
  await requirePermission(AppPermission.FILES_VIEW);
  const document = await withDatabaseRetry((client) =>
    getProductDocumentForOpen(client, documentId),
  );

  if (process.platform !== "win32") {
    throw new Error("Opening files is supported on Windows only.");
  }

  await launchWindowsFile(document.filePath);

  return {
    success: true,
    path: document.filePath,
    documentName: document.documentName,
  };
}

export async function openProductSubmittalsFolder(
  productId: string,
): Promise<ProductExplorerOpenResult> {
  await requirePermission(AppPermission.FILES_VIEW);
  const product = await withDatabaseRetry((client) =>
    client.product.findUnique({
      where: { id: productId },
      select: { productCode: true },
    }),
  );

  if (!product) {
    throw new Error("Product was not found.");
  }

  const folderPath = await getProductSubmittalDir(product.productCode);
  const root = await getStockSubmittalsRoot();
  assertPathUnderStockSubmittalsRoot(root, folderPath);

  if (process.platform !== "win32") {
    throw new Error("Opening folders is supported on Windows only.");
  }

  await launchWindowsFolder(folderPath, { allowedRoot: root });

  return { success: true, path: folderPath };
}

export async function deleteProductDocumentAction(documentId: string) {
  await requirePermission(AppPermission.PRODUCTS_MANAGE);
  const document = await withDatabaseRetry((client) =>
    client.productDocument.findUnique({
      where: { id: documentId },
      select: { productId: true },
    }),
  );

  if (!document) {
    throw new Error("Document was not found.");
  }

  await withDatabaseRetry((client) => deleteProductDocument(client, documentId));
  revalidateProductPaths(document.productId);
}
