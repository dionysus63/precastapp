"use server";

import { access, mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { AppPermission, Prisma } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { syncAllJobFilesFromDisk } from "@/lib/job-files-service";
import {
  formatLinesList,
  getAppSettings,
  parseLinesList,
} from "@/lib/app-settings";
import { removeCompanyLogo } from "@/lib/company-logo";
import { saveCompanyLogo } from "@/lib/company-logo-raster";
import {
  conflictsNotCoveredByRenames,
  findCatalogInUseConflicts,
  formatProductCatalogInUseError,
  parseCatalogRenamesFromFormData,
  parseProductCatalogFromFormData,
  renamesAffectingProducts,
  validateCatalogRenames,
  validateProductCatalog,
} from "@/lib/product-catalog-settings";
import {
  applyProductCatalogRenames,
  getProductCatalog,
  getProductCatalogUsage,
} from "@/lib/product-catalog-settings.server";
import {
  parseRingBuilderConfigFromFormData,
  validateRingBuilderConfig,
} from "@/lib/ring-builder-settings";
import { writeAuditLog } from "@/lib/auth/audit";
import { parseRolePermissionsFromFormData } from "@/lib/role-permissions-settings";
import {
  isSettingsResetConfigured,
  verifySettingsResetPassword,
} from "@/lib/settings-reset-password";
import { prisma, withDatabaseRetry } from "@/lib/prisma";

export type SettingsActionResult = {
  error?: string;
  success?: string;
};

function revalidateSettingsPaths() {
  revalidatePath("/settings");
  revalidatePath("/settings/company");
  revalidatePath("/settings/billing");
  revalidatePath("/settings/files");
  revalidatePath("/settings/operations");
  revalidatePath("/settings/products");
  revalidatePath("/settings/rings");
  revalidatePath("/settings/casting-suppliers");
  revalidatePath("/settings/system");
  revalidatePath("/settings/data-reset");
  revalidatePath("/settings/roles");
  revalidatePath("/settings/users");
  revalidatePath("/products");
  revalidatePath("/quotes/new");
  revalidatePath("/products/new");
  revalidatePath("/", "layout");
}

async function updateAppSettings(
  data: Prisma.AppSettingsUpdateInput,
): Promise<SettingsActionResult> {
  try {
    await withDatabaseRetry((client) =>
      client.appSettings.update({
        where: { id: "default" },
        data,
      }),
    );
    revalidateSettingsPaths();
    return { success: "Settings saved." };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not save settings.",
    };
  }
}

export async function createPriceListFormAction(formData: FormData): Promise<void> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);
  await createPriceList(formData);
}

export async function upsertPriceListItemFormAction(formData: FormData): Promise<void> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);
  await upsertPriceListItem(formData);
}

export async function deletePriceListItemFormAction(formData: FormData): Promise<void> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);
  await deletePriceListItem(formData);
}

export async function createPriceList(formData: FormData) {
  await requirePermission(AppPermission.SETTINGS_MANAGE);
  const name = String(formData.get("name") ?? "").trim();
  const effectiveDateRaw = String(formData.get("effectiveDate") ?? "").trim();
  const isDefault = formData.get("isDefault") === "on";
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) {
    return { error: "Name is required." };
  }

  const effectiveDate = effectiveDateRaw
    ? new Date(`${effectiveDateRaw}T00:00:00`)
    : null;

  try {
    await withDatabaseRetry(async (client) => {
      if (isDefault) {
        await client.priceList.updateMany({
          data: { isDefault: false },
          where: { isDefault: true },
        });
      }

      await client.priceList.create({
        data: { name, effectiveDate, isDefault, notes },
      });
    });

    revalidatePath("/settings/price-lists");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not create price list.",
    };
  }
}

export async function upsertPriceListItem(formData: FormData) {
  await requirePermission(AppPermission.SETTINGS_MANAGE);
  const priceListId = String(formData.get("priceListId") ?? "").trim();
  const productId = String(formData.get("productId") ?? "").trim();
  const unitPrice = Number(formData.get("unitPrice"));

  if (!priceListId || !productId) {
    return { error: "Price list and product are required." };
  }

  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    return { error: "Unit price must be zero or greater." };
  }

  try {
    await withDatabaseRetry((client) =>
      client.priceListItem.upsert({
        where: {
          priceListId_productId: { priceListId, productId },
        },
        create: {
          priceListId,
          productId,
          unitPrice: new Prisma.Decimal(unitPrice),
        },
        update: {
          unitPrice: new Prisma.Decimal(unitPrice),
        },
      }),
    );

    revalidatePath(`/settings/price-lists/${priceListId}`);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not save price list item.",
    };
  }
}

export async function deletePriceListItem(formData: FormData) {
  await requirePermission(AppPermission.SETTINGS_MANAGE);
  const id = String(formData.get("id") ?? "").trim();
  const priceListId = String(formData.get("priceListId") ?? "").trim();

  if (!id) {
    return { error: "Item id is required." };
  }

  try {
    await withDatabaseRetry((client) =>
      client.priceListItem.delete({ where: { id } }),
    );
    revalidatePath(`/settings/price-lists/${priceListId}`);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not delete price list item.",
    };
  }
}

export async function updateCompanySettingsFormAction(
  formData: FormData,
): Promise<SettingsActionResult> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);
  const companyName = String(formData.get("companyName") ?? "").trim();
  const companyAddress = String(formData.get("companyAddress") ?? "").trim();
  const companyPhone = String(formData.get("companyPhone") ?? "").trim();
  const companyEmail = String(formData.get("companyEmail") ?? "").trim();
  const appTitle = String(formData.get("appTitle") ?? "").trim();
  const appSubtitle = String(formData.get("appSubtitle") ?? "").trim();
  const quoteFooterText =
    String(formData.get("quoteFooterText") ?? "").trim() || null;
  const deliveryTicketCopy1Title =
    String(formData.get("deliveryTicketCopy1Title") ?? "").trim() || null;
  const deliveryTicketCopy2Title =
    String(formData.get("deliveryTicketCopy2Title") ?? "").trim() || null;
  const deliveryTicketCopy3Title =
    String(formData.get("deliveryTicketCopy3Title") ?? "").trim() || null;
  const deliveryTicketFooterText =
    String(formData.get("deliveryTicketFooterText") ?? "").trim() || null;

  if (!companyName || !companyAddress || !companyPhone || !companyEmail) {
    return { error: "Company name, address, phone, and email are required." };
  }

  if (!appTitle || !appSubtitle) {
    return { error: "App title and subtitle are required." };
  }

  return updateAppSettings({
    companyName,
    companyAddress,
    companyPhone,
    companyEmail,
    appTitle,
    appSubtitle,
    quoteFooterText,
    deliveryTicketCopy1Title,
    deliveryTicketCopy2Title,
    deliveryTicketCopy3Title,
    deliveryTicketFooterText,
  });
}

export async function updateBillingSettingsFormAction(
  formData: FormData,
): Promise<SettingsActionResult> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);
  const defaultTaxRate = Number(formData.get("defaultTaxRate"));
  const quoteValidityDays = Number(formData.get("quoteValidityDays"));
  const invoiceDueDays = Number(formData.get("invoiceDueDays"));
  const defaultLeadTime =
    String(formData.get("defaultLeadTime") ?? "").trim() || null;
  const paymentTerms = parseLinesList(
    String(formData.get("paymentTerms") ?? ""),
  );

  if (!Number.isFinite(defaultTaxRate) || defaultTaxRate < 0) {
    return { error: "Default tax rate must be zero or greater." };
  }

  if (!Number.isInteger(quoteValidityDays) || quoteValidityDays < 1) {
    return { error: "Quote validity must be at least 1 day." };
  }

  if (!Number.isInteger(invoiceDueDays) || invoiceDueDays < 0) {
    return { error: "Invoice due days must be zero or greater." };
  }

  if (paymentTerms.length === 0) {
    return { error: "Add at least one payment term option." };
  }

  return updateAppSettings({
    defaultTaxRate: new Prisma.Decimal(defaultTaxRate),
    quoteValidityDays,
    invoiceDueDays,
    defaultLeadTime,
    paymentTerms,
  });
}

export async function updateFileSettingsFormAction(
  formData: FormData,
): Promise<SettingsActionResult> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);
  const jobsRoot = String(formData.get("jobsRoot") ?? "").trim();
  const quotePdfFallbackDir = String(
    formData.get("quotePdfFallbackDir") ?? "",
  ).trim();
  const stockSubmittalsRoot = String(
    formData.get("stockSubmittalsRoot") ?? "",
  ).trim();

  if (!jobsRoot || !quotePdfFallbackDir || !stockSubmittalsRoot) {
    return {
      error:
        "Jobs root, PDF fallback directory, and stock submittals root are required.",
    };
  }

  return updateAppSettings({
    jobsRoot,
    quotePdfFallbackDir,
    stockSubmittalsRoot,
  });
}

export async function testStockSubmittalsRootWriteAccessAction(): Promise<SettingsActionResult> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);
  const settings = await getAppSettings();
  const testDir = path.join(
    settings.stockSubmittalsRoot,
    ".precast-settings-test",
  );
  const testFile = path.join(testDir, ".precast-write-test");

  try {
    await mkdir(testDir, { recursive: true });
    await writeFile(testFile, "precast settings write test", "utf8");
    await unlink(testFile);
    return {
      success: `Write access confirmed for ${settings.stockSubmittalsRoot}`,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? `Cannot write to ${settings.stockSubmittalsRoot}: ${error.message}`
          : `Cannot write to ${settings.stockSubmittalsRoot}.`,
    };
  }
}

export async function updateOperationsSettingsFormAction(
  formData: FormData,
): Promise<SettingsActionResult> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);
  const truckCapacityLabel = String(
    formData.get("truckCapacityLabel") ?? "",
  ).trim();
  const estimators = parseLinesList(String(formData.get("estimators") ?? ""));
  const trucks = parseLinesList(String(formData.get("trucks") ?? ""));
  const drivers = parseLinesList(String(formData.get("drivers") ?? ""));
  const trailers = parseLinesList(String(formData.get("trailers") ?? ""));

  if (!truckCapacityLabel) {
    return { error: "Truck capacity label is required." };
  }

  if (
    estimators.length === 0 ||
    trucks.length === 0 ||
    drivers.length === 0 ||
    trailers.length === 0
  ) {
    return { error: "Each operations list needs at least one entry." };
  }

  return updateAppSettings({
    truckCapacityLabel,
    estimators,
    trucks,
    drivers,
    trailers,
  });
}

export async function updateRolePermissionsFormAction(
  formData: FormData,
): Promise<SettingsActionResult> {
  const actor = await requirePermission(AppPermission.USERS_MANAGE);
  const rolePermissions = parseRolePermissionsFromFormData(formData);

  const result = await updateAppSettings({
    rolePermissions,
  });

  if (result.error) {
    return result;
  }

  await writeAuditLog({
    userId: actor.id,
    action: "settings.update_role_permissions",
    entityType: "AppSettings",
    entityId: "default",
    summary: "Updated role default permissions",
  });

  return result;
}

export async function updateProductCatalogSettingsFormAction(
  formData: FormData,
): Promise<SettingsActionResult> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);

  const raw = String(formData.get("productCatalog") ?? "").trim();
  if (!raw) {
    return { error: "Product catalog data is required." };
  }

  let catalog;
  try {
    catalog = parseProductCatalogFromFormData(raw);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Invalid product catalog data.",
    };
  }

  const validationError = validateProductCatalog(catalog);
  if (validationError) {
    return { error: validationError };
  }

  const rawRenames = String(formData.get("catalogRenames") ?? "").trim();
  const confirmed = String(formData.get("confirmCatalogRenames") ?? "") === "1";

  let renames;
  try {
    renames = parseCatalogRenamesFromFormData(rawRenames);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Invalid catalog rename data.",
    };
  }

  const [oldCatalog, usage] = await Promise.all([
    getProductCatalog(),
    getProductCatalogUsage(),
  ]);

  if (renames.length > 0) {
    const renameValidationError = validateCatalogRenames(
      renames,
      oldCatalog,
      catalog,
    );
    if (renameValidationError) {
      return { error: renameValidationError };
    }
  }

  const conflicts = findCatalogInUseConflicts(catalog, usage);
  const uncoveredConflicts =
    renames.length > 0
      ? conflictsNotCoveredByRenames(conflicts, renames)
      : conflicts;

  if (uncoveredConflicts.length > 0) {
    return { error: formatProductCatalogInUseError(uncoveredConflicts) };
  }

  if (
    renames.length > 0 &&
    renamesAffectingProducts(renames, usage) &&
    !confirmed
  ) {
    return {
      error: "Confirm catalog renames before updating products.",
    };
  }

  if (renames.length > 0) {
    try {
      await withDatabaseRetry((client) =>
        client.$transaction(async (tx) => {
          await applyProductCatalogRenames(tx, renames);
          await tx.appSettings.update({
            where: { id: "default" },
            data: {
              productCatalog: catalog as Prisma.InputJsonValue,
            },
          });
        }),
      );
      revalidateSettingsPaths();
      return { success: "Settings saved." };
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : "Could not save settings.",
      };
    }
  }

  return updateAppSettings({
    productCatalog: catalog,
  });
}

export async function updateRingBuilderSettingsFormAction(
  formData: FormData,
): Promise<SettingsActionResult> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);

  const raw = String(formData.get("ringBuilderConfig") ?? "").trim();
  if (!raw) {
    return { error: "Ring builder configuration data is required." };
  }

  let config;
  try {
    config = parseRingBuilderConfigFromFormData(raw);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Invalid ring builder configuration data.",
    };
  }

  const validationError = validateRingBuilderConfig(config);
  if (validationError) {
    return { error: validationError };
  }

  return updateAppSettings({
    ringBuilderConfig: config,
  });
}

export async function testJobsRootWriteAccessAction(): Promise<SettingsActionResult> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);
  const settings = await getAppSettings();
  const testDir = path.join(settings.jobsRoot, ".precast-settings-test");
  const testFile = path.join(testDir, ".precast-write-test");

  try {
    await mkdir(testDir, { recursive: true });
    await writeFile(testFile, "precast settings write test", "utf8");
    await unlink(testFile);
    return { success: `Write access confirmed for ${settings.jobsRoot}` };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? `Cannot write to ${settings.jobsRoot}: ${error.message}`
          : `Cannot write to ${settings.jobsRoot}.`,
    };
  }
}

export async function checkJobsRootReadAccess(): Promise<boolean> {
  await requirePermission(AppPermission.SETTINGS_VIEW);
  const settings = await getAppSettings();
  try {
    await access(settings.jobsRoot);
    return true;
  } catch {
    return false;
  }
}

export async function ensureYearSequencesAction(): Promise<SettingsActionResult> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);
  const year = new Date().getFullYear();

  try {
    await withDatabaseRetry(async (client) => {
      await client.jobSequence.upsert({
        where: { year },
        create: { year, lastNumber: 0 },
        update: {},
      });
      await client.deliveryTicketSequence.upsert({
        where: { year },
        create: { year, lastNumber: 0 },
        update: {},
      });
      await client.invoiceSequence.upsert({
        where: { year },
        create: { year, lastNumber: 0 },
        update: {},
      });
    });

    revalidatePath("/settings/system");
    return { success: `Sequence rows ensured for ${year}.` };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not ensure sequence rows.",
    };
  }
}

export async function syncAllJobFilesFromSettingsAction(): Promise<SettingsActionResult> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);
  try {
    const result = await withDatabaseRetry((client) =>
      syncAllJobFilesFromDisk(client),
    );
    revalidatePath("/files");
    revalidatePath("/settings");
    revalidatePath("/settings/system");
    if (result.errors.length > 0) {
      return {
        success: `Synced ${result.synced} job folder(s). ${result.errors.length} job(s) failed — ${result.errors[0]?.message ?? "see logs"}.`,
      };
    }
    return {
      success: `Job files synced from disk (${result.synced} job folder(s)${result.skipped > 0 ? `, ${result.skipped} skipped` : ""}).`,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not sync job files.",
    };
  }
}

export async function getDocumentNumberingPreview() {
  await requirePermission(AppPermission.SETTINGS_VIEW);
  const year = new Date().getFullYear();
  const yearTwoDigit = String(year % 100).padStart(2, "0");

  const [jobSeq, dtSeq, invSeq] = await withDatabaseRetry((client) =>
    Promise.all([
      client.jobSequence.findUnique({ where: { year } }),
      client.deliveryTicketSequence.findUnique({ where: { year } }),
      client.invoiceSequence.findUnique({ where: { year } }),
    ]),
  );

  const nextJob = (jobSeq?.lastNumber ?? 0) + 1;
  const nextDt = (dtSeq?.lastNumber ?? 0) + 1;
  const nextInv = (invSeq?.lastNumber ?? 0) + 1;

  return {
    year,
    job: {
      format: "YY-###",
      next: `${yearTwoDigit}-${String(nextJob).padStart(3, "0")}`,
      lastNumber: jobSeq?.lastNumber ?? 0,
    },
    deliveryTicket: {
      format: "DT-YY-###",
      next: `DT-${yearTwoDigit}-${String(nextDt).padStart(3, "0")}`,
      lastNumber: dtSeq?.lastNumber ?? 0,
    },
    invoice: {
      format: "INV-YY-###",
      next: `INV-${yearTwoDigit}-${String(nextInv).padStart(3, "0")}`,
      lastNumber: invSeq?.lastNumber ?? 0,
    },
    quoteNote:
      "Quote numbers: Q-{jobNumber} with optional scope and contractor segments (e.g. Q-26-001-SITE-BAY); revisions add -R1, -R2. Non-job quotes use Q-{YY}-NEW.",
  };
}

export async function getSettingsHubStatus() {
  await requirePermission(AppPermission.SETTINGS_VIEW);
  const year = new Date().getFullYear();
  const yearTwoDigit = String(year % 100).padStart(2, "0");

  let databaseOk = false;
  let jobsFolderOk = false;
  let nextJobNumber = "—";
  let indexedFiles = 0;

  try {
    const [settings, jobSeq, fileCount] = await withDatabaseRetry((client) =>
      Promise.all([
        client.appSettings.findUnique({ where: { id: "default" } }),
        client.jobSequence.findUnique({ where: { year } }),
        client.jobFile.count(),
      ]),
    );

    databaseOk = Boolean(settings);
    indexedFiles = fileCount;
    const nextJob = (jobSeq?.lastNumber ?? 0) + 1;
    nextJobNumber = `${yearTwoDigit}-${String(nextJob).padStart(3, "0")}`;

    if (settings?.jobsRoot) {
      try {
        await access(settings.jobsRoot);
        jobsFolderOk = true;
      } catch {
        jobsFolderOk = false;
      }
    }
  } catch {
    databaseOk = false;
  }

  return { databaseOk, jobsFolderOk, nextJobNumber, indexedFiles };
}

export async function uploadCompanyLogoFormAction(
  formData: FormData,
): Promise<SettingsActionResult> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a logo file to upload." };
  }

  try {
    await saveCompanyLogo(file);
    revalidateSettingsPaths();
    revalidatePath("/api/brand/logo");
    return { success: "Logo uploaded." };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not upload logo.",
    };
  }
}

export async function removeCompanyLogoFormAction(): Promise<SettingsActionResult> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);
  try {
    await removeCompanyLogo();
    revalidateSettingsPaths();
    revalidatePath("/api/brand/logo");
    return { success: "Logo removed." };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not remove logo.",
    };
  }
}

export type DataResetStats = {
  productCount: number;
  customerCount: number;
  jobCount: number;
  resetConfigured: boolean;
};

export async function getDataResetStats(): Promise<DataResetStats> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);

  const [productCount, customerCount, jobCount] = await Promise.all([
    prisma.product.count(),
    prisma.customer.count(),
    prisma.job.count(),
  ]);

  return {
    productCount,
    customerCount,
    jobCount,
    resetConfigured: isSettingsResetConfigured(),
  };
}

function parseResetPassword(formData: FormData): string {
  return String(formData.get("resetPassword") ?? "").trim();
}

function resetPasswordError(): SettingsActionResult {
  if (!isSettingsResetConfigured()) {
    return {
      error:
        "Data reset is not configured. Set SETTINGS_RESET_PASSWORD in .env and restart the app.",
    };
  }

  return { error: "Incorrect reset password." };
}

function revalidateAfterProductReset() {
  revalidatePath("/products");
  revalidatePath("/products/new");
  revalidatePath("/products/bulk");
  revalidatePath("/settings/products");
  revalidatePath("/settings/price-lists");
  revalidatePath("/inventory");
  revalidatePath("/settings/data-reset");
}

function revalidateAfterCustomerReset() {
  revalidatePath("/customers");
  revalidatePath("/customers/new");
  revalidatePath("/customers/bulk");
  revalidatePath("/jobs");
  revalidatePath("/quotes");
  revalidatePath("/delivery-tickets");
  revalidatePath("/settings/data-reset");
}

function revalidateAfterJobReset() {
  revalidatePath("/jobs");
  revalidatePath("/jobs/new");
  revalidatePath("/quotes");
  revalidatePath("/delivery-tickets");
  revalidatePath("/invoices");
  revalidatePath("/drill-sheets");
  revalidatePath("/files");
  revalidatePath("/settings/data-reset");
  revalidatePath("/settings/system");
}

export async function clearAllProductsFormAction(
  formData: FormData,
): Promise<SettingsActionResult> {
  const user = await requirePermission(AppPermission.SETTINGS_MANAGE);
  const resetPassword = parseResetPassword(formData);

  if (!verifySettingsResetPassword(resetPassword)) {
    return resetPasswordError();
  }

  const productCount = await prisma.product.count();
  if (productCount === 0) {
    return { success: "No products to delete." };
  }

  const result = await prisma.$transaction(async (tx) => {
    const castingLinksDeleted = await tx.productCastingComponent.deleteMany();
    const productsDeleted = await tx.product.deleteMany();
    return {
      castingLinksDeleted: castingLinksDeleted.count,
      productsDeleted: productsDeleted.count,
    };
  });

  await writeAuditLog({
    userId: user.id,
    action: "settings.clear_all_products",
    entityType: "Product",
    summary: `${user.displayName} cleared all products (${result.productsDeleted} deleted, ${result.castingLinksDeleted} casting BOM links removed)`,
    metadata: {
      deletedCount: result.productsDeleted,
      castingLinksDeleted: result.castingLinksDeleted,
    },
  });

  revalidateAfterProductReset();
  return {
    success: `Deleted ${result.productsDeleted} product${result.productsDeleted === 1 ? "" : "s"}.`,
  };
}

export async function clearAllCustomersFormAction(
  formData: FormData,
): Promise<SettingsActionResult> {
  const user = await requirePermission(AppPermission.SETTINGS_MANAGE);
  const resetPassword = parseResetPassword(formData);

  if (!verifySettingsResetPassword(resetPassword)) {
    return resetPasswordError();
  }

  const customerCount = await prisma.customer.count();
  if (customerCount === 0) {
    return { success: "No customers to delete." };
  }

  const result = await prisma.$transaction(async (tx) => {
    const biddersDeleted = await tx.jobBidder.deleteMany();
    const customersDeleted = await tx.customer.deleteMany();
    return { biddersDeleted: biddersDeleted.count, customersDeleted: customersDeleted.count };
  });

  await writeAuditLog({
    userId: user.id,
    action: "settings.clear_all_customers",
    entityType: "Customer",
    summary: `${user.displayName} cleared all customers (${result.customersDeleted} deleted, ${result.biddersDeleted} bid list entries removed)`,
    metadata: {
      deletedCount: result.customersDeleted,
      biddersDeleted: result.biddersDeleted,
    },
  });

  revalidateAfterCustomerReset();
  return {
    success: `Deleted ${result.customersDeleted} customer${result.customersDeleted === 1 ? "" : "s"}.`,
  };
}

export async function clearAllJobsFormAction(
  formData: FormData,
): Promise<SettingsActionResult> {
  const user = await requirePermission(AppPermission.SETTINGS_MANAGE);
  const resetPassword = parseResetPassword(formData);

  if (!verifySettingsResetPassword(resetPassword)) {
    return resetPasswordError();
  }

  const result = await prisma.$transaction(async (tx) => {
    const jobCount = await tx.job.count();
    if (jobCount === 0) {
      return { jobsDeleted: 0, sequencesDeleted: 0, biddersDeleted: 0, filesDeleted: 0, favoritesDeleted: 0 };
    }
    await tx.quote.updateMany({ data: { jobNumber: null } });
    await tx.deliveryTicket.updateMany({ data: { jobNumber: null } });
    await tx.invoice.updateMany({ data: { jobNumber: null } });
    const [biddersDeleted, filesDeleted, favoritesDeleted] = await Promise.all([
      tx.jobBidder.count(),
      tx.jobFile.count(),
      tx.jobFavorite.count(),
    ]);
    // Structures with no quote would become permanently inaccessible (both FKs null) after job deletion.
    // Structures that have a quoteId survive linked to their quote with jobId nulled by the FK cascade.
    await tx.jobStructure.deleteMany({ where: { quoteId: null } });
    const jobsDeleted = await tx.job.deleteMany();
    const sequencesDeleted = await tx.jobSequence.deleteMany();
    return {
      jobsDeleted: jobsDeleted.count,
      sequencesDeleted: sequencesDeleted.count,
      biddersDeleted,
      filesDeleted,
      favoritesDeleted,
    };
  });

  if (result.jobsDeleted === 0) {
    return { success: "No jobs to delete." };
  }

  await writeAuditLog({
    userId: user.id,
    action: "settings.clear_all_jobs",
    entityType: "Job",
    summary: `${user.displayName} cleared all jobs (${result.jobsDeleted} deleted, ${result.biddersDeleted} bid entries and ${result.filesDeleted} file records removed, ${result.sequencesDeleted} sequence year${result.sequencesDeleted === 1 ? "" : "s"} reset)`,
    metadata: {
      deletedCount: result.jobsDeleted,
      sequencesDeleted: result.sequencesDeleted,
      biddersDeleted: result.biddersDeleted,
      filesDeleted: result.filesDeleted,
      favoritesDeleted: result.favoritesDeleted,
    },
  });

  revalidateAfterJobReset();
  return {
    success: `Deleted ${result.jobsDeleted} job${result.jobsDeleted === 1 ? "" : "s"}.${result.sequencesDeleted > 0 ? " Job numbering will start over for each year." : ""}`,
  };
}

export { formatLinesList };
