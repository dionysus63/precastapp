"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  Prisma,
  AppPermission,
  GalleyType,
  ProductKind,
  ProductStatus,
  ProductType,
} from "@/app/generated/prisma/client";
import { getStockSubmittalsRoot } from "@/lib/app-settings";
import { requirePermission } from "@/lib/auth/session";
import {
  deleteProductDocument,
  getProductDocumentForOpen,
  scanAllProductSubmittals,
  scanProductDocuments,
  uploadProductDocument,
} from "@/lib/product-submittals-service";
import { prisma, withDatabaseRetry } from "@/lib/prisma";
import {
  isNextRedirectError,
  translatePrismaError,
} from "@/lib/server/action-errors";
import {
  parseAndValidateProductProfile,
  parseBulkImportPreset,
  parseProductKind,
  presetCastingSoldAsUnit,
  presetRequiresSupplier,
  presetToProductKind,
  presetToProductType,
  productKindToLegacyFlags,
  resolveInventorySettings,
  type BulkImportPreset,
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
  getPriceListsMissingProducts,
  upsertProductPriceListItem,
} from "@/lib/price-list-service";
import { validateTaxonomySelection, resolveTaxonomyByNamesForImport, ensureTaxonomyForBulkImport } from "@/lib/product-taxonomy.server";
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
    defaultValue: "STOCK_PRECAST",
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

  const assembly = await client.product.findUnique({
    where: { id: assemblyId },
    select: {
      castingSupplierId: true,
      castingSupplier: { select: { origin: true, name: true } },
    },
  });

  await client.productCastingComponent.deleteMany({ where: { assemblyId } });

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const component = await client.product.findUnique({
      where: { id: row.componentId },
      select: {
        id: true,
        productCode: true,
        castingRole: true,
        castingSupplier: { select: { origin: true, name: true } },
      },
    });
    if (!component) {
      throw new Error("BOM component product was not found.");
    }
    if (component.castingRole !== "COMPONENT") {
      throw new Error("BOM rows must reference component products.");
    }

    if (
      assembly?.castingSupplier?.origin &&
      component.castingSupplier?.origin &&
      assembly.castingSupplier.origin !== component.castingSupplier.origin
    ) {
      throw new Error(
        `BOM component "${component.productCode}" is from a ${component.castingSupplier.origin.toLowerCase()} supplier, but the assembly supplier is ${assembly.castingSupplier.origin.toLowerCase()}. Domestic and imported parts cannot be mixed.`,
      );
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

/**
 * Galley family tagging (Storm Leaching Galley E/M/CB trios). Both fields
 * travel together: a family code without a type (or vice versa) is a data
 * hazard for the quote-form family picker, so reject half-filled pairs.
 * Non-standard kinds (rings, castings, pipe) never carry galley fields.
 */
function parseGalleyFieldsFromForm(
  formData: FormData,
  productKind: ProductKind,
): { galleyFamilyCode: string | null; galleyType: GalleyType | null } {
  if (productKind !== "STANDARD") {
    return { galleyFamilyCode: null, galleyType: null };
  }

  const familyCode =
    String(formData.get("galleyFamilyCode") ?? "").trim() || null;
  const typeRaw = String(formData.get("galleyType") ?? "").trim();
  const galleyType =
    typeRaw === "END" || typeRaw === "MIDDLE" || typeRaw === "CB"
      ? (typeRaw as GalleyType)
      : null;

  if (familyCode && !galleyType) {
    throw new Error(
      "Pick a galley type (One End / Middle / CB) or clear the family code.",
    );
  }
  if (!familyCode && galleyType) {
    throw new Error(
      "Enter the galley family code (e.g. LGD-40) or set the type back to “Not a galley”.",
    );
  }

  return { galleyFamilyCode: familyCode, galleyType };
}

function resolveProductKindFromForm(formData: FormData): ProductKind {
  const explicit = parseProductKind(String(formData.get("productKind") ?? ""));
  if (explicit) {
    return explicit;
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

async function parseProductFormData(formData: FormData) {
  const productCode = getRequiredString(formData, "productCode", "Product code");
  const name = getRequiredString(formData, "productName", "Product name");
  const productType = parseProductType(formData);

  const unit = String(formData.get("unit") ?? "EA").trim() || "EA";
  const status = parseProductStatus(formData);

  const categoryId = String(formData.get("categoryId") ?? "").trim();
  if (!categoryId) {
    throw new Error("Category is required.");
  }
  const subcategoryIdRaw = String(formData.get("subcategoryId") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const unitPrice = parseOptionalNonNegativeDecimal(
    formData,
    "unitPrice",
    "Unit price",
  );
  const priceListId = String(formData.get("priceListId") ?? "").trim() || null;
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
  const castingSoldAsUnit =
    productKind === "CASTING_ASSEMBLY" &&
    String(formData.get("castingSoldAsUnit") ?? "no") === "yes";
  const manufacturerCode =
    productKind === "CASTING_ASSEMBLY"
      ? String(formData.get("manufacturerCode") ?? "").trim() || null
      : null;
  const profile = parseAndValidateProductProfile(
    productKind,
    createFormProfileReader(formData),
    "Product",
    productType,
  );
  const legacy = productKindToLegacyFlags(productKind);
  const inventory = resolveInventorySettings(
    productType,
    productKind,
    currentStockQuantity,
    castingSoldAsUnit,
  );

  if (
    (productKind === "CASTING_COMPONENT" || productKind === "CASTING_ASSEMBLY") &&
    !profile.castingSupplierId
  ) {
    throw new Error(
      "Casting products require a supplier. Add suppliers under Settings → Casting Suppliers if none are listed.",
    );
  }

  const castingBom =
    productKind === "CASTING_ASSEMBLY" && !castingSoldAsUnit
      ? parseCastingBomPayload(formData)
      : [];

  if (castingSoldAsUnit && castingBom.length > 0) {
    throw new Error("One-piece castings cannot have interchangeable parts.");
  }

  const taxonomy = await validateTaxonomySelection(
    categoryId,
    subcategoryIdRaw || null,
    productType,
  );

  const galley = parseGalleyFieldsFromForm(formData, productKind);

  return {
    productCode,
    name,
    productType,
    categoryId: taxonomy.categoryId,
    subcategoryId: taxonomy.subcategoryId,
    description,
    unit,
    unitPrice,
    priceListId,
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
    galleyFamilyCode: galley.galleyFamilyCode,
    galleyType: galley.galleyType,
    isCasting: legacy.isCasting,
    castingRole: profile.castingRole,
    castingPieceRole: profile.castingPieceRole,
    castingSupplierId: profile.castingSupplierId,
    manufacturerCode,
    castingSoldAsUnit,
    pipeDiameterInches: toDecimal(profile.pipeDiameterInches),
    pipeLengthFeet: toDecimal(profile.pipeLengthFeet),
    pipeClass: profile.pipeClass,
    pipeJointType: profile.pipeJointType,
    castingBom,
  };
}

export async function createProduct(
  formData: FormData,
): Promise<{ error: string } | void> {
  await requirePermission(AppPermission.PRODUCTS_MANAGE);

  try {
    const { castingBom, unitPrice, priceListId, ...data } =
      await parseProductFormData(formData);

    await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({ data });
      if (data.productKind === "CASTING_ASSEMBLY" && !data.castingSoldAsUnit) {
        await saveCastingBom(tx, product.id, castingBom);
      }

      if (priceListId && unitPrice != null) {
        await upsertProductPriceListItem(
          priceListId,
          product.id,
          unitPrice,
          tx,
        );
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
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    return { error: translatePrismaError(error).message };
  }
}

export async function updateProduct(
  formData: FormData,
): Promise<{ error: string } | void> {
  await requirePermission(AppPermission.PRODUCTS_MANAGE);
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return { error: "Product id is required." };
  }

  try {
    const { castingBom, currentStockQuantity, unitPrice, priceListId, ...data } =
      await parseProductFormData(formData);
    // currentStockQuantity is intentionally NOT updated here. Stock only changes
    // through the inventory ledger (adjustInventory / receive / production /
    // delivery); a direct product edit would silently diverge the balance from
    // the InventoryTransaction history.
    void currentStockQuantity;

    const expectedUpdatedAtRaw = String(
      formData.get("expectedUpdatedAt") ?? "",
    ).trim();

    await prisma.$transaction(async (tx) => {
      if (expectedUpdatedAtRaw) {
        // The casting BOM is replaced wholesale below, so a stale save would
        // silently discard another admin's edits (optimistic concurrency).
        const current = await tx.product.findUnique({
          where: { id },
          select: { updatedAt: true },
        });
        const expected = new Date(expectedUpdatedAtRaw);
        if (
          !current ||
          Number.isNaN(expected.getTime()) ||
          current.updatedAt.getTime() !== expected.getTime()
        ) {
          throw new Error(
            "This product was changed by someone else while you were editing. Refresh the page to load the latest version, then re-apply your changes.",
          );
        }
      }

      await tx.product.update({ where: { id }, data });
      if (data.productKind === "CASTING_ASSEMBLY" && !data.castingSoldAsUnit) {
        await saveCastingBom(tx, id, castingBom);
      } else {
        await tx.productCastingComponent.deleteMany({ where: { assemblyId: id } });
      }

      if (priceListId && unitPrice != null) {
        await upsertProductPriceListItem(priceListId, id, unitPrice, tx);
      }
    });

    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
    redirect(`/products/${id}`);
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    return { error: translatePrismaError(error).message };
  }
}

type BulkImportRow = {
  productCode: string;
  productName: string;
  category: string;
  subcategory?: string;
  unit: string;
  unitPrice: string;
  weight: string;
  yards: string;
  trackInventory: string;
  kindFields?: Record<string, string>;
};

function mapBulkImportRow(
  preset: BulkImportPreset,
  row: BulkImportRow,
  lineNumber: number,
  taxonomy: { categoryId: string; subcategoryId: string | null },
  supplierId: string | null,
) {
  const kind = presetToProductKind(preset);
  const productCode = row.productCode.trim();
  const name = row.productName.trim();

  if (!productCode) {
    throw new Error(`Line ${lineNumber}: Product code is required.`);
  }
  if (!name) {
    throw new Error(`Line ${lineNumber}: Product name is required.`);
  }

  const unit = row.unit.trim() || "EA";
  const kindFields = row.kindFields ?? {};
  const productType = presetToProductType(preset);

  const castingSoldAsUnit =
    kind === "CASTING_ASSEMBLY" && presetCastingSoldAsUnit(preset);
  const inventory = resolveInventorySettings(
    productType,
    kind,
    0,
    castingSoldAsUnit,
  );
  const legacy = productKindToLegacyFlags(kind);

  const profileReader: ProfileFieldReader = {
    getString(field: string) {
      if (field === "castingSupplierId") {
        return supplierId ?? "";
      }
      if (field === "castingSoldAsUnit") {
        return castingSoldAsUnit ? "yes" : "no";
      }
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
      if (field === "castingSupplierId") {
        return supplierId ?? "";
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
    profileReader.getString = (field: string) => {
      if (field === "castingSoldAsUnit") {
        return castingSoldAsUnit ? "yes" : "no";
      }
      if (field === "castingSupplierId") {
        return supplierId ?? "";
      }
      return String(kindFields[field] ?? "").trim();
    };
  }

  const profile = parseAndValidateProductProfile(
    kind,
    profileReader,
    `Line ${lineNumber}`,
    productType,
  );
  const manufacturerCode =
    kind === "CASTING_ASSEMBLY" && !castingSoldAsUnit
      ? String(kindFields.manufacturerCode ?? "").trim() || null
      : null;

  return {
    productCode,
    name,
    productType,
    categoryId: taxonomy.categoryId,
    subcategoryId: taxonomy.subcategoryId,
    description: null,
    unit: unit === "Each" ? "EA" : unit,
    unitPrice: parseBulkNumeric(row.unitPrice, "Unit price", lineNumber),
    cost: null,
    weight:
      parseBulkNumeric(row.weight, "Weight", lineNumber) ??
      new Prisma.Decimal(0),
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
    castingRole: profile.castingRole,
    castingPieceRole: profile.castingPieceRole,
    castingSupplierId: supplierId,
    manufacturerCode,
    castingSoldAsUnit: profile.castingSoldAsUnit,
    pipeDiameterInches: toDecimal(profile.pipeDiameterInches),
    pipeLengthFeet: toDecimal(profile.pipeLengthFeet),
    pipeClass: productType === "ADS_PIPE" ? null : profile.pipeClass,
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
        castingPieceRole: "FRAME" | "COVER_GRATE" | "HOOD" | null;
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
        castingPieceRole: "FRAME" | "COVER_GRATE" | "HOOD" | null;
    }
  >,
) {
  const missing: string[] = [];

  for (const row of bomRows) {
    for (const [label, code] of [
      ["Frame code", row.frameProductCode],
      ["Cover/Grate code", row.coverGrateProductCode],
      ["Hood code", row.hoodProductCode],
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

export type ValidateCastingAssemblyImportCodesResult = Record<number, string[]>;

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

export type ImportProductsResult = {
  imported: number;
  updated: number;
  listsMissingProducts: Array<{ id: string; name: string; missingCount: number }>;
};

export async function importProducts(
  formData: FormData,
): Promise<ImportProductsResult> {
  await requirePermission(AppPermission.PRODUCTS_MANAGE);
  const importPreset =
    parseBulkImportPreset(String(formData.get("importPreset") ?? "")) ??
    "STOCK_PRECAST";
  const productKind = presetToProductKind(importPreset);
  const productType = presetToProductType(importPreset);
  const supplierIdRaw = String(formData.get("supplierId") ?? "").trim();
  const priceListId = String(formData.get("priceListId") ?? "").trim();

  if (!priceListId) {
    throw new Error("Price list is required.");
  }

  let supplierId: string | null = null;
  if (presetRequiresSupplier(importPreset)) {
    if (!supplierIdRaw) {
      throw new Error("Supplier is required for casting imports.");
    }
    const supplier = await prisma.castingSupplier.findFirst({
      where: { id: supplierIdRaw, status: "ACTIVE" },
      select: { id: true },
    });
    if (!supplier) {
      throw new Error("Selected supplier was not found or is inactive.");
    }
    supplierId = supplier.id;
  }

  const priceList = await prisma.priceList.findUnique({
    where: { id: priceListId },
    select: { id: true },
  });
  if (!priceList) {
    throw new Error("Selected price list was not found.");
  }

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

  const rawRows = parsed as BulkImportRow[];
  const createMissingTaxonomy =
    String(formData.get("createMissingTaxonomy") ?? "").trim() === "true";

  if (createMissingTaxonomy) {
    await ensureTaxonomyForBulkImport(
      rawRows.map((row) => ({
        category: String(row.category ?? "").trim(),
        subcategory: String(row.subcategory ?? "").trim() || null,
      })),
      productType,
      productKind,
    );
  }

  const rowsByProductCode = new Map<string, number[]>();
  const products = await Promise.all(
    parsed.map(async (row, index) => {
      const bulkRow = row as BulkImportRow;
      const taxonomy = await resolveTaxonomyByNamesForImport(
        String(bulkRow.category ?? "").trim(),
        String(bulkRow.subcategory ?? "").trim() || null,
        productType,
      );
      const mapped = mapBulkImportRow(
        importPreset,
        bulkRow,
        index + 1,
        taxonomy,
        supplierId,
      );
      const lineNumbers = rowsByProductCode.get(mapped.productCode) ?? [];
      lineNumbers.push(index + 1);
      rowsByProductCode.set(mapped.productCode, lineNumbers);
      return mapped;
    }),
  );

  for (const product of products) {
    if (product.unitPrice != null) {
      continue;
    }
    const isDerivedCastingAssembly =
      product.productKind === "CASTING_ASSEMBLY" &&
      !product.castingSoldAsUnit &&
      !product.manufacturerCode;
    if (isDerivedCastingAssembly) {
      continue;
    }
    throw new Error(
      `Line ${rowsByProductCode.get(product.productCode)?.join(", ") ?? "?"}: Unit price is required.`,
    );
  }

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

  const rawRowsAfterMap = parsed as BulkImportRow[];
  let assemblyBoms: CastingBomRowInput[][] = [];

  if (productKind === "CASTING_ASSEMBLY") {
    const bomImportRows = collectAssemblyBomImportRows(rawRowsAfterMap);
    const unitFlags = rawRowsAfterMap.map(() => presetCastingSoldAsUnit(importPreset));
    const bomRowsToValidate = bomImportRows.filter(
      (_, index) => !unitFlags[index],
    );
    const componentCodes = collectReferencedComponentCodes(bomRowsToValidate);
    const componentsByCode = await loadCastingComponentsByCode(componentCodes);
    assertAllAssemblyComponentCodesExist(bomRowsToValidate, componentsByCode);

    assemblyBoms = bomImportRows.map((row, index) => {
      if (unitFlags[index]) {
        return [];
      }
      return buildCastingBomFromProductCodes(
        row,
        componentsByCode,
        `Line ${row.lineNumber}`,
      );
    });
  }

  const existingProducts = await prisma.product.findMany({
    where: { productCode: { in: products.map((product) => product.productCode) } },
    select: { productCode: true },
  });
  const existingCodes = new Set(existingProducts.map((product) => product.productCode));

  const importedProductIds = await prisma.$transaction(async (tx) => {
    const productIds: string[] = [];

    for (let index = 0; index < products.length; index += 1) {
      const { unitPrice, ...productData } = products[index];
      const existing = await tx.product.findUnique({
        where: { productCode: productData.productCode },
        select: { id: true },
      });

      let productId: string;
      if (existing) {
        await tx.product.update({
          where: { id: existing.id },
          data: productData,
        });
        productId = existing.id;
        if (productKind === "CASTING_ASSEMBLY" && !productData.castingSoldAsUnit) {
          await saveCastingBom(tx, productId, assemblyBoms[index] ?? []);
        } else if (productKind === "CASTING_ASSEMBLY") {
          await tx.productCastingComponent.deleteMany({
            where: { assemblyId: productId },
          });
        }
      } else {
        const created = await tx.product.create({ data: productData });
        productId = created.id;
        if (productKind === "CASTING_ASSEMBLY" && !productData.castingSoldAsUnit) {
          await saveCastingBom(tx, created.id, assemblyBoms[index] ?? []);
        }
      }

      if (unitPrice != null) {
        await upsertProductPriceListItem(
          priceListId,
          productId,
          unitPrice,
          tx,
        );
      }
      productIds.push(productId);
    }

    return productIds;
  });

  const listsMissingProducts = await getPriceListsMissingProducts(
    importedProductIds,
    priceListId,
  );

  revalidatePath("/products");
  revalidatePath("/products/new");
  revalidatePath("/products/bulk");
  revalidatePath("/settings/products");
  revalidatePath("/settings/price-lists");
  revalidatePath(`/settings/price-lists/${priceListId}`);

  const updated = products.filter((product) =>
    existingCodes.has(product.productCode),
  ).length;
  const imported = products.length - updated;

  return { imported, updated, listsMissingProducts };
}

export type ProductExplorerOpenResult = {
  success: true;
  path: string;
  /** False when the browser is on another machine: the client opens `path`
   * itself (desktop shell) or shows it (plain browser). */
  launched: boolean;
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

export async function scanAllProductSubmittalsAction() {
  await requirePermission(AppPermission.PRODUCTS_MANAGE);
  const result = await withDatabaseRetry((client) =>
    scanAllProductSubmittals(client),
  );

  revalidatePath("/products");
  revalidatePath("/inventory");
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
  const launch = await launchWindowsFile(document.filePath, {
    allowedRoot: await getStockSubmittalsRoot(),
  });

  return {
    success: true,
    path: launch.clientOpenPath,
    launched: launch.launched,
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

  // Submittals are flat files named after the product code, so the shared
  // root is the folder to open.
  const root = await getStockSubmittalsRoot();

  if (process.platform !== "win32") {
    throw new Error("Opening folders is supported on Windows only.");
  }

  const launch = await launchWindowsFolder(root, { allowedRoot: root });

  return { success: true, path: launch.clientOpenPath, launched: launch.launched };
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
