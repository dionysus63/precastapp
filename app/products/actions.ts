"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  Prisma,
  AppPermission,
  ProductKind,
  ProductStatus,
  ProductType,
} from "@/app/generated/prisma/client";
import { getStockSubmittalsRoot } from "@/lib/app-settings";
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
  parseAndValidateProductProfile,
  parseProductKind,
  productKindToLegacyFlags,
  resolveInventorySettings,
  suggestedKindForCategory,
  type ProfileFieldReader,
} from "@/lib/product-kinds";
import {
  isRecognizedBulkRingStyle,
  parseBulkRingStyle,
} from "@/lib/drain-ring-utils";
import {
  buildCastingBomFromProductCodes,
  parseCastingPieceRole,
  parseCastingRole,
  validateCastingAssemblyImportCodes,
  validateCastingBom,
  type CastingAssemblyBomImportRow,
  type CastingBomRowInput,
} from "@/lib/casting-utils";
import { launchWindowsFile, launchWindowsFolder } from "@/lib/windows-explorer";
import {
  mergeCatalogWithInUseValues,
} from "@/lib/product-catalog-settings";
import { getProductCatalog } from "@/lib/product-catalog-settings.server";
import {
  getEnum,
  getNonNegativeInt,
  getRequiredString,
} from "@/lib/server/form-data";

const PRODUCT_STATUSES = Object.values(ProductStatus);
const PRODUCT_TYPES = Object.values(ProductType);

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
  return getNonNegativeInt(formData, field, label, defaultValue);
}

function parseProductStatus(formData: FormData): ProductStatus {
  return getEnum(formData, "status", PRODUCT_STATUSES, {
    label: "product status",
    defaultValue: "ACTIVE",
  });
}

function parseProductType(formData: FormData): ProductType {
  return getEnum(formData, "productType", PRODUCT_TYPES, {
    label: "product type",
    defaultValue: "STOCK",
  });
}

function parseCastingBomPayload(formData: FormData): CastingBomRowInput[] {
  const raw = String(formData.get("castingBomPayload") ?? "").trim();
  if (!raw) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid casting BOM data.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Invalid casting BOM data.");
  }

  return parsed.map((entry) => {
    const row = entry as Record<string, unknown>;
    const pieceRole = parseCastingPieceRole(String(row.pieceRole ?? ""));
    if (!pieceRole) {
      throw new Error("Each BOM row needs a valid piece role.");
    }
    return {
      pieceRole,
      componentId: String(row.componentId ?? "").trim(),
      quantity: Number(row.quantity ?? 1),
    };
  });
}

async function saveCastingBom(
  client: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  assemblyId: string,
  rows: CastingBomRowInput[],
) {
  validateCastingBom(rows);

  await client.productCastingComponent.deleteMany({ where: { assemblyId } });

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const component = await client.product.findUnique({
      where: { id: row.componentId },
      select: { id: true, castingRole: true },
    });
    if (!component) {
      throw new Error("BOM component product was not found.");
    }
    if (component.castingRole !== "COMPONENT") {
      throw new Error("BOM rows must reference component products.");
    }

    await client.productCastingComponent.create({
      data: {
        assemblyId,
        componentId: row.componentId,
        pieceRole: row.pieceRole,
        quantity: row.quantity,
        sortOrder: index,
      },
    });
  }
}

function toDecimal(value: string | null): Prisma.Decimal | null {
  if (!value) {
    return null;
  }
  return new Prisma.Decimal(value);
}

function createFormProfileReader(formData: FormData): ProfileFieldReader {
  return {
    getString(field: string) {
      return String(formData.get(field) ?? "").trim();
    },
    getDecimal(field: string, label: string) {
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
      return raw;
    },
  };
}

function resolveProductKindFromForm(formData: FormData): ProductKind {
  const explicit = parseProductKind(String(formData.get("productKind") ?? ""));
  if (explicit) {
    return explicit;
  }

  const category = String(formData.get("category") ?? "").trim();
  const suggested = suggestedKindForCategory(category);
  if (suggested) {
    return suggested;
  }

  const isDrainRing = String(formData.get("isDrainRing") ?? "no") === "yes";
  const castingRoleRaw = String(formData.get("castingRole") ?? "").trim();
  const castingRole = parseCastingRole(castingRoleRaw);
  const isCastingLegacy = String(formData.get("isCasting") ?? "no") === "yes";

  if (isDrainRing) {
    return "DRAIN_RING";
  }
  if (castingRole === "ASSEMBLY" || isCastingLegacy) {
    return "CASTING_ASSEMBLY";
  }
  if (castingRole === "COMPONENT") {
    return "CASTING_COMPONENT";
  }
  return "STANDARD";
}

function parseProductFormData(formData: FormData) {
  const productCode = getRequiredString(formData, "productCode", "Product code");
  const name = getRequiredString(formData, "productName", "Product name");
  const productType = parseProductType(formData);

  const unit = String(formData.get("unit") ?? "EA").trim() || "EA";
  const status = parseProductStatus(formData);

  const category = String(formData.get("category") ?? "").trim() || "Vaults";
  const description =
    String(formData.get("subcategory") ?? formData.get("description") ?? "").trim() ||
    null;
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

  const productKind = resolveProductKindFromForm(formData);
  const profile = parseAndValidateProductProfile(
    productKind,
    createFormProfileReader(formData),
  );
  const legacy = productKindToLegacyFlags(productKind);
  const inventory = resolveInventorySettings(
    productKind,
    trackInventory,
    currentStockQuantity,
  );

  if (productKind === "CASTING_ASSEMBLY" && category === "Castings" && !profile.castingRole) {
    throw new Error("Castings products require an assembly or component role.");
  }

  if (
    (productKind === "CASTING_COMPONENT" || productKind === "CASTING_ASSEMBLY") &&
    !profile.castingSupplierId
  ) {
    throw new Error(
      "Casting products require a supplier. Add suppliers under Settings → Casting Suppliers if none are listed.",
    );
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
    trackInventory: inventory.trackInventory,
    currentStockQuantity: inventory.currentStockQuantity,
    reorderLevel,
    status,
    notes,
    productKind,
    isDrainRing: legacy.isDrainRing,
    heightFeet: toDecimal(profile.heightFeet),
    ringDiameterFeet: toDecimal(profile.ringDiameterFeet),
    drainRingStyle: profile.drainRingStyle,
    isCasting: legacy.isCasting,
    castingClearOpeningInches: toDecimal(profile.castingClearOpeningInches),
    castingRole: profile.castingRole,
    castingPieceRole: profile.castingPieceRole,
    castingSupplierId: profile.castingSupplierId,
    pipeDiameterInches: toDecimal(profile.pipeDiameterInches),
    pipeLengthFeet: toDecimal(profile.pipeLengthFeet),
    pipeClass: profile.pipeClass,
    pipeJointType: profile.pipeJointType,
    castingBom:
      productKind === "CASTING_ASSEMBLY"
        ? parseCastingBomPayload(formData)
        : [],
  };
}

export async function createProduct(formData: FormData) {
  await requirePermission(AppPermission.PRODUCTS_MANAGE);
  const { castingBom, ...data } = parseProductFormData(formData);

  await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({ data });
    if (data.productKind === "CASTING_ASSEMBLY") {
      await saveCastingBom(tx, product.id, castingBom);
    }

    // Seed the ledger for a non-zero opening balance so
    // `currentStockQuantity` always reconciles to the sum of
    // InventoryTransaction rows. The balance was already set by `create`, so
    // we only insert the matching ledger entry here (no second balance bump).
    if (data.trackInventory && data.currentStockQuantity !== 0) {
      await tx.inventoryTransaction.create({
        data: {
          productId: product.id,
          quantityChange: new Prisma.Decimal(data.currentStockQuantity),
          transactionType: "ADJUSTMENT",
          transactionDate: new Date(),
          notes: "Opening balance",
        },
      });
    }
  });

  revalidatePath("/products");
  redirect("/products");
}

export async function updateProduct(formData: FormData) {
  await requirePermission(AppPermission.PRODUCTS_MANAGE);
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    throw new Error("Product id is required.");
  }

  const { castingBom, currentStockQuantity, ...data } =
    parseProductFormData(formData);
  // currentStockQuantity is intentionally NOT updated here. Stock only changes
  // through the inventory ledger (adjustInventory / receive / production /
  // delivery); a direct product edit would silently diverge the balance from
  // the InventoryTransaction history.
  void currentStockQuantity;

  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id }, data });
    if (data.productKind === "CASTING_ASSEMBLY") {
      await saveCastingBom(tx, id, castingBom);
    } else {
      await tx.productCastingComponent.deleteMany({ where: { assemblyId: id } });
    }
  });

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  redirect(`/products/${id}`);
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
  supplier?: string;
  trackInventory: string;
  kindFields?: Record<string, string>;
};

function mapBulkImportRow(
  kind: ProductKind,
  row: BulkImportRow,
  lineNumber: number,
) {
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
  const kindFields = row.kindFields ?? {};

  const inventoryValue = row.trackInventory.trim().toLowerCase();
  if (inventoryValue && inventoryValue !== "yes" && inventoryValue !== "no") {
    throw new Error(
      `Line ${lineNumber}: Track inventory must be "Yes" or "No".`,
    );
  }
  const trackInventory = inventoryValue !== "no";
  const inventory = resolveInventorySettings(kind, trackInventory, 0);
  const legacy = productKindToLegacyFlags(kind);

  const profileReader: ProfileFieldReader = {
    getString(field: string) {
      return String(kindFields[field] ?? "").trim();
    },
    getDecimal(field: string, label: string) {
      const raw = String(kindFields[field] ?? "").trim();
      if (!raw) {
        return null;
      }
      const parsed = parseBulkNumeric(raw, label, lineNumber);
      return parsed ? parsed.toString() : null;
    },
  };

  if (kind === "DRAIN_RING") {
    profileReader.getDecimal = (field, label) => {
      const raw = String(kindFields[field] ?? "").trim();
      const parsed = parseBulkNumeric(raw, label, lineNumber);
      if (!parsed) {
        throw new Error(`Line ${lineNumber}: ${label} is required.`);
      }
      return parsed.toString();
    };
    if (kindFields.ringStyle?.trim() && !isRecognizedBulkRingStyle(kindFields.ringStyle)) {
      throw new Error(
        `Line ${lineNumber}: Style must be "DRAIN", "SAN", or legacy "Yes"/"No".`,
      );
    }
    kindFields.drainRingStyle = parseBulkRingStyle(String(kindFields.ringStyle ?? ""));
  }

  if (kind === "CASTING_COMPONENT") {
    profileReader.getString = (field: string) => {
      if (field === "castingPieceRole") {
        return String(kindFields.castingPieceRole ?? "").trim();
      }
      return String(kindFields[field] ?? "").trim();
    };
  }

  if (kind === "CASTING_ASSEMBLY") {
    profileReader.getDecimal = (field, label) => {
      const raw = String(kindFields[field] ?? "").trim();
      const parsed = parseBulkNumeric(raw, label, lineNumber);
      if (!parsed) {
        throw new Error(`Line ${lineNumber}: ${label} is required.`);
      }
      return parsed.toString();
    };
  }

  const profile = parseAndValidateProductProfile(
    kind,
    profileReader,
    `Line ${lineNumber}`,
  );

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
    yards:
      kind === "CASTING_COMPONENT" || kind === "CASTING_ASSEMBLY"
        ? null
        : parseBulkNumeric(row.yards, "Yards", lineNumber),
    trackInventory: inventory.trackInventory,
    currentStockQuantity: inventory.currentStockQuantity,
    reorderLevel: 0,
    status: "ACTIVE" as ProductStatus,
    notes: null,
    productKind: kind,
    isDrainRing: legacy.isDrainRing,
    heightFeet: toDecimal(profile.heightFeet),
    ringDiameterFeet: toDecimal(profile.ringDiameterFeet),
    drainRingStyle: profile.drainRingStyle,
    isCasting: legacy.isCasting,
    castingClearOpeningInches: toDecimal(profile.castingClearOpeningInches),
    castingRole: profile.castingRole,
    castingPieceRole: profile.castingPieceRole,
    castingSupplierId: profile.castingSupplierId,
    pipeDiameterInches: toDecimal(profile.pipeDiameterInches),
    pipeLengthFeet: toDecimal(profile.pipeLengthFeet),
    pipeClass: profile.pipeClass,
    pipeJointType: profile.pipeJointType,
  };
}

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

function collectAssemblyBomImportRows(
  parsed: BulkImportRow[],
): CastingAssemblyBomImportRow[] {
  return parsed.map((row, index) => ({
    lineNumber: index + 1,
    frameProductCode: String(row.kindFields?.frameProductCode ?? "").trim(),
    coverGrateProductCode: String(
      row.kindFields?.coverGrateProductCode ?? "",
    ).trim(),
    hoodProductCode: String(row.kindFields?.hoodProductCode ?? "").trim(),
    throatProductCode: String(row.kindFields?.throatProductCode ?? "").trim(),
  }));
}

function collectReferencedComponentCodes(
  rows: CastingAssemblyBomImportRow[],
): string[] {
  const codes = new Set<string>();
  for (const row of rows) {
    for (const code of [
      row.frameProductCode,
      row.coverGrateProductCode,
      row.hoodProductCode,
      row.throatProductCode,
    ]) {
      if (code) {
        codes.add(code);
      }
    }
  }
  return [...codes];
}

async function loadCastingComponentsByCode(codes: string[]) {
  if (codes.length === 0) {
    return new Map<
      string,
      {
        id: string;
        productCode: string;
        castingRole: "ASSEMBLY" | "COMPONENT" | null;
        castingPieceRole: "FRAME" | "COVER_GRATE" | "HOOD" | "THROAT" | null;
      }
    >();
  }

  const components = await prisma.product.findMany({
    where: { productCode: { in: codes } },
    select: {
      id: true,
      productCode: true,
      castingRole: true,
      castingPieceRole: true,
    },
  });

  return new Map(components.map((component) => [component.productCode, component]));
}

function assertAllAssemblyComponentCodesExist(
  bomRows: CastingAssemblyBomImportRow[],
  componentsByCode: Map<
    string,
    {
      id: string;
      productCode: string;
      castingRole: "ASSEMBLY" | "COMPONENT" | null;
        castingPieceRole: "FRAME" | "COVER_GRATE" | "HOOD" | "THROAT" | null;
    }
  >,
) {
  const missing: string[] = [];

  for (const row of bomRows) {
    for (const [label, code] of [
      ["Frame code", row.frameProductCode],
      ["Cover/Grate code", row.coverGrateProductCode],
      ["Hood code", row.hoodProductCode],
      ["Throat code", row.throatProductCode],
    ] as const) {
      if (!code) {
        continue;
      }
      if (!componentsByCode.has(code)) {
        missing.push(`${label} "${code}" on line ${row.lineNumber}`);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Import failed: the following component product codes were not found: ${missing.join("; ")}.`,
    );
  }
}

type CastingBulkImportSupplierRow = {
  lineNumber: number;
  supplier: string;
};

async function loadCastingSuppliersByName(names: string[]) {
  if (names.length === 0) {
    return new Map<string, { id: string; name: string }>();
  }

  const suppliers = await prisma.castingSupplier.findMany({
    where: { name: { in: names }, status: "ACTIVE" },
    select: { id: true, name: true },
  });

  return new Map(suppliers.map((supplier) => [supplier.name, supplier]));
}

function assertAllCastingSuppliersExist(
  rows: BulkImportRow[],
  suppliersByName: Map<string, { id: string; name: string }>,
) {
  const missing: string[] = [];

  rows.forEach((row, index) => {
    const supplierName = String(row.supplier ?? "").trim();
    if (!supplierName) {
      return;
    }
    if (!suppliersByName.has(supplierName)) {
      missing.push(`Supplier "${supplierName}" on line ${index + 1}`);
    }
  });

  if (missing.length > 0) {
    throw new Error(
      `Import failed: the following suppliers were not found: ${missing.join("; ")}.`,
    );
  }
}

export type ValidateCastingAssemblyImportCodesResult = Record<number, string[]>;

export async function validateCastingBulkImportSuppliersAction(
  rows: CastingBulkImportSupplierRow[],
): Promise<ValidateCastingAssemblyImportCodesResult> {
  await requirePermission(AppPermission.PRODUCTS_MANAGE);

  if (rows.length === 0) {
    return {};
  }

  const supplierNames = [
    ...new Set(rows.map((row) => row.supplier.trim()).filter(Boolean)),
  ];
  const suppliersByName = await loadCastingSuppliersByName(supplierNames);

  const result: ValidateCastingAssemblyImportCodesResult = {};
  for (const row of rows) {
    const supplierName = row.supplier.trim();
    if (!supplierName) {
      continue;
    }
    if (!suppliersByName.has(supplierName)) {
      result[row.lineNumber] = [`Supplier "${supplierName}" was not found.`];
    }
  }
  return result;
}

export async function validateCastingAssemblyImportCodesAction(
  rows: CastingAssemblyBomImportRow[],
): Promise<ValidateCastingAssemblyImportCodesResult> {
  await requirePermission(AppPermission.PRODUCTS_MANAGE);

  if (rows.length === 0) {
    return {};
  }

  const codes = collectReferencedComponentCodes(rows);
  const componentsByCode = await loadCastingComponentsByCode(codes);
  const issuesByLine = validateCastingAssemblyImportCodes(
    rows,
    [...componentsByCode.values()],
  );

  const result: ValidateCastingAssemblyImportCodesResult = {};
  for (const [lineNumber, issues] of issuesByLine.entries()) {
    result[lineNumber] = issues;
  }
  return result;
}

export type ImportProductsResult = { imported: number };

export async function importProducts(
  formData: FormData,
): Promise<ImportProductsResult> {
  await requirePermission(AppPermission.PRODUCTS_MANAGE);
  const productKind =
    parseProductKind(String(formData.get("productKind") ?? "")) ?? "STANDARD";
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
    const mapped = mapBulkImportRow(productKind, row as BulkImportRow, index + 1);
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

  const rawRows = parsed as BulkImportRow[];
  let assemblyBoms: CastingBomRowInput[][] = [];

  if (
    productKind === "CASTING_COMPONENT" ||
    productKind === "CASTING_ASSEMBLY"
  ) {
    const supplierNames = [
      ...new Set(
        rawRows.map((row) => String(row.supplier ?? "").trim()).filter(Boolean),
      ),
    ];
    const suppliersByName = await loadCastingSuppliersByName(supplierNames);
    assertAllCastingSuppliersExist(rawRows, suppliersByName);

    products.forEach((product, index) => {
      const supplierName = String(rawRows[index]?.supplier ?? "").trim();
      product.castingSupplierId =
        suppliersByName.get(supplierName)?.id ?? null;
    });
  }

  if (productKind === "CASTING_ASSEMBLY") {
    const bomImportRows = collectAssemblyBomImportRows(rawRows);
    const componentCodes = collectReferencedComponentCodes(bomImportRows);
    const componentsByCode = await loadCastingComponentsByCode(componentCodes);
    assertAllAssemblyComponentCodesExist(bomImportRows, componentsByCode);

    assemblyBoms = bomImportRows.map((row) =>
      buildCastingBomFromProductCodes(
        row,
        componentsByCode,
        `Line ${row.lineNumber}`,
      ),
    );
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
      for (let index = 0; index < products.length; index += 1) {
        const product = products[index];
        const created = await tx.product.create({ data: product });
        if (productKind === "CASTING_ASSEMBLY") {
          await saveCastingBom(tx, created.id, assemblyBoms[index] ?? []);
        }
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

  // Product documents live under the stock submittals root, not the jobs root.
  await launchWindowsFile(document.filePath, {
    allowedRoot: await getStockSubmittalsRoot(),
  });

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
