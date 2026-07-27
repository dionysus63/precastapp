"use server";

import { access, mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { AppPermission, Prisma } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { syncAllJobFilesFromDisk } from "@/lib/job-files-service";
import {
  getAppSettings,
  invalidateAppSettingsCache,
  parseLinesList,
} from "@/lib/app-settings";
import { removeCompanyLogo } from "@/lib/company-logo";
import { saveCompanyLogo } from "@/lib/company-logo-raster";
import {
  parseRingBuilderConfigFromFormData,
  validateRingBuilderConfig,
} from "@/lib/ring-builder-settings";
import { writeAuditLog } from "@/lib/auth/audit";
import { isValidEmail } from "@/lib/validation/email";
import { parseRolePermissionsFromFormData } from "@/lib/role-permissions-settings";
import {
  isSettingsResetConfigured,
  verifySettingsResetPassword,
} from "@/lib/settings-reset-password";
import { prisma, withDatabaseRetry } from "@/lib/prisma";
import {
  assertPriceListCompleteForDefault,
  copyPriceListItems,
  resolvePriceListIsDefault,
} from "@/lib/price-list-service";
import {
  assertStructurePricingCompleteForDefault,
  copyStructurePriceEntries,
} from "@/lib/structure-pricing";

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
    invalidateAppSettingsCache();
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
  const copyFromPriceListId =
    String(formData.get("copyFromPriceListId") ?? "").trim() || null;

  if (!name) {
    return { error: "Name is required." };
  }

  const effectiveDate = effectiveDateRaw
    ? new Date(`${effectiveDateRaw}T00:00:00`)
    : null;

  try {
    await withDatabaseRetry((client) =>
      client.$transaction(async (tx) => {
        if (isDefault) {
          await tx.priceList.updateMany({
            data: { isDefault: false },
            where: { isDefault: true },
          });
        }

        const created = await tx.priceList.create({
          data: { name, effectiveDate, isDefault, notes },
        });

        if (copyFromPriceListId) {
          await copyPriceListItems(created.id, copyFromPriceListId, tx);
          await copyStructurePriceEntries(created.id, copyFromPriceListId, tx);
        }

        if (isDefault) {
          await assertPriceListCompleteForDefault(created.id, tx);
          await assertStructurePricingCompleteForDefault(created.id, tx);
        }
      }),
    );

    revalidatePath("/settings/price-lists");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not create price list.",
    };
  }
}

export async function updatePriceListSettings(
  formData: FormData,
): Promise<SettingsActionResult> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const effectiveDateRaw = String(formData.get("effectiveDate") ?? "").trim();
  const requestedIsDefault = formData.get("isDefault") === "on";
  const fobDefault = String(formData.get("fobDefault") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!id) {
    return { error: "Price list id is required." };
  }
  if (!name) {
    return { error: "Name is required." };
  }

  const effectiveDate = effectiveDateRaw
    ? new Date(`${effectiveDateRaw}T00:00:00`)
    : null;

  try {
    await withDatabaseRetry((client) =>
      client.$transaction(async (tx) => {
        const current = await tx.priceList.findUnique({
          where: { id },
          select: { isDefault: true },
        });
        if (!current) {
          throw new Error("Price list not found.");
        }

        // Disabled checkboxes are omitted from FormData. Preserve an existing
        // default while saving unrelated fields such as F.O.B. or notes.
        const isDefault = resolvePriceListIsDefault(
          current.isDefault,
          requestedIsDefault,
        );

        if (isDefault && !current.isDefault) {
          await assertPriceListCompleteForDefault(id, tx);
          await assertStructurePricingCompleteForDefault(id, tx);
          await tx.priceList.updateMany({
            data: { isDefault: false },
            where: { isDefault: true },
          });
        }

        await tx.priceList.update({
          where: { id },
          data: { name, effectiveDate, isDefault, fobDefault, notes },
        });
      }),
    );

    revalidatePath("/settings/price-lists");
    revalidatePath(`/settings/price-lists/${id}`);
    revalidatePath("/quotes/new");
    return { success: "Price list settings saved." };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not save price list.";
    return {
      error: message.includes("Unique constraint")
        ? "A price list with that name already exists."
        : message,
    };
  }
}

export async function upsertPriceListItem(formData: FormData) {
  await requirePermission(AppPermission.SETTINGS_MANAGE);
  const priceListId = String(formData.get("priceListId") ?? "").trim();
  const productId = String(formData.get("productId") ?? "").trim();
  // Money enters as the user's literal string, never through a JS float.
  const unitPriceRaw = String(formData.get("unitPrice") ?? "").trim();

  if (!priceListId || !productId) {
    return { error: "Price list and product are required." };
  }

  const unitPriceNumber = Number(unitPriceRaw);
  if (!unitPriceRaw || !Number.isFinite(unitPriceNumber) || unitPriceNumber < 0) {
    return { error: "Unit price must be zero or greater." };
  }
  const unitPrice = new Prisma.Decimal(unitPriceRaw);

  try {
    await withDatabaseRetry((client) =>
      client.priceListItem.upsert({
        where: {
          priceListId_productId: { priceListId, productId },
        },
        create: {
          priceListId,
          productId,
          unitPrice,
        },
        update: {
          unitPrice,
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
  const quoteEmailSubjectTemplate =
    String(formData.get("quoteEmailSubjectTemplate") ?? "").trim() || null;
  const quoteEmailBodyTemplate =
    String(formData.get("quoteEmailBodyTemplate") ?? "").trim() || null;
  const quoteEmailFontFamily =
    String(formData.get("quoteEmailFontFamily") ?? "").trim() || null;
  const quoteEmailFontSizeRaw = String(
    formData.get("quoteEmailFontSizePx") ?? "",
  ).trim();
  const quoteEmailFontSizePx = quoteEmailFontSizeRaw
    ? Number(quoteEmailFontSizeRaw)
    : null;
  const quoteEmailTextColor =
    String(formData.get("quoteEmailTextColor") ?? "").trim() || null;
  const quoteEmailSignatureName =
    String(formData.get("quoteEmailSignatureName") ?? "").trim() || null;
  const quoteEmailSignatureCompany =
    String(formData.get("quoteEmailSignatureCompany") ?? "").trim() || null;
  const quoteEmailSignatureAddress =
    String(formData.get("quoteEmailSignatureAddress") ?? "").trim() || null;
  const quoteEmailSignaturePhoneLine =
    String(formData.get("quoteEmailSignaturePhoneLine") ?? "").trim() || null;
  const quoteEmailSignatureEmail =
    String(formData.get("quoteEmailSignatureEmail") ?? "").trim() || null;
  const quoteEmailSignatureColor =
    String(formData.get("quoteEmailSignatureColor") ?? "").trim() || null;
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

  if (
    quoteEmailFontSizePx !== null &&
    (!Number.isInteger(quoteEmailFontSizePx) ||
      quoteEmailFontSizePx < 10 ||
      quoteEmailFontSizePx > 24)
  ) {
    return { error: "Quote email font size must be between 10 and 24." };
  }

  const hexColor = /^#[0-9a-fA-F]{6}$/;
  if (quoteEmailTextColor && !hexColor.test(quoteEmailTextColor)) {
    return { error: "Quote email text color must be a hex color like #171717." };
  }
  if (quoteEmailSignatureColor && !hexColor.test(quoteEmailSignatureColor)) {
    return {
      error: "Signature color must be a hex color like #1F4E79.",
    };
  }
  if (quoteEmailSignatureEmail && !isValidEmail(quoteEmailSignatureEmail)) {
    return { error: "Signature email must be a valid email address." };
  }

  return updateAppSettings({
    companyName,
    companyAddress,
    companyPhone,
    companyEmail,
    appTitle,
    appSubtitle,
    quoteFooterText,
    quoteEmailSubjectTemplate,
    quoteEmailBodyTemplate,
    quoteEmailFontFamily,
    quoteEmailFontSizePx,
    quoteEmailTextColor,
    quoteEmailSignatureName,
    quoteEmailSignatureCompany,
    quoteEmailSignatureAddress,
    quoteEmailSignaturePhoneLine,
    quoteEmailSignatureEmail,
    quoteEmailSignatureColor,
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
  const ticketNumberPrefix = String(formData.get("ticketNumberPrefix") ?? "")
    .trim()
    .toUpperCase();
  const invoiceNumberPrefix = String(formData.get("invoiceNumberPrefix") ?? "")
    .trim()
    .toUpperCase();
  const ticketNumberStart = Number(formData.get("ticketNumberStart"));

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

  const prefixPattern = /^[A-Z]{1,5}$/;
  if (!prefixPattern.test(ticketNumberPrefix)) {
    return { error: "Ticket number prefix must be 1-5 letters." };
  }
  if (!prefixPattern.test(invoiceNumberPrefix)) {
    return { error: "Invoice number prefix must be 1-5 letters." };
  }
  if (ticketNumberPrefix === invoiceNumberPrefix) {
    return {
      error: "Ticket and invoice prefixes must differ so numbers stay distinguishable.",
    };
  }
  if (
    !Number.isInteger(ticketNumberStart) ||
    ticketNumberStart < 1 ||
    ticketNumberStart > 99_999_999
  ) {
    return { error: "Ticket starting number must be a whole number of 1 or more." };
  }

  return updateAppSettings({
    defaultTaxRate: new Prisma.Decimal(defaultTaxRate),
    quoteValidityDays,
    invoiceDueDays,
    defaultLeadTime,
    paymentTerms,
    ticketNumberPrefix,
    invoiceNumberPrefix,
    ticketNumberStart,
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
  const jobsRootClientPath = String(
    formData.get("jobsRootClientPath") ?? "",
  ).trim();
  const quotePdfFallbackDirClientPath = String(
    formData.get("quotePdfFallbackDirClientPath") ?? "",
  ).trim();
  const stockSubmittalsRootClientPath = String(
    formData.get("stockSubmittalsRootClientPath") ?? "",
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
    jobsRootClientPath: jobsRootClientPath || null,
    quotePdfFallbackDirClientPath: quotePdfFallbackDirClientPath || null,
    stockSubmittalsRootClientPath: stockSubmittalsRootClientPath || null,
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
  const loadCapacityLabel = String(
    formData.get("loadCapacityLabel") ?? "",
  ).trim();
  const estimators = parseLinesList(String(formData.get("estimators") ?? ""));
  const drivers = parseLinesList(String(formData.get("drivers") ?? ""));
  const trailers = parseLinesList(String(formData.get("trailers") ?? ""));

  if (!loadCapacityLabel) {
    return { error: "Load capacity is required." };
  }

  if (
    estimators.length === 0 ||
    drivers.length === 0 ||
    trailers.length === 0
  ) {
    return { error: "Each operations list needs at least one entry." };
  }

  return updateAppSettings({
    truckCapacityLabel: loadCapacityLabel,
    estimators,
    drivers,
    trailers,
  });
}

/**
 * Direct-printing defaults (Settings -> Printing): server-host printer and
 * color mode for delivery tickets and submittal packages.
 */
export async function updatePrintingSettingsFormAction(
  formData: FormData,
): Promise<SettingsActionResult> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);
  const parseColorMode = (value: FormDataEntryValue | null) =>
    String(value ?? "") === "monochrome" ? "monochrome" : "color";

  return updateAppSettings({
    ticketPrinterName:
      String(formData.get("ticketPrinterName") ?? "").trim() || null,
    ticketPrintColorMode: parseColorMode(formData.get("ticketPrintColorMode")),
    submittalPrinterName:
      String(formData.get("submittalPrinterName") ?? "").trim() || null,
    submittalPrintColorMode: parseColorMode(
      formData.get("submittalPrintColorMode"),
    ),
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
  trackedProductCount: number;
  customerCount: number;
  jobCount: number;
  structureCount: number;
  quoteCount: number;
  deliveryTicketCount: number;
  invoiceCount: number;
  resetConfigured: boolean;
};

export async function getDataResetStats(): Promise<DataResetStats> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);

  const [
    productCount,
    trackedProductCount,
    customerCount,
    jobCount,
    structureCount,
    quoteCount,
    deliveryTicketCount,
    invoiceCount,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { trackInventory: true } }),
    prisma.customer.count(),
    prisma.job.count(),
    prisma.jobStructure.count(),
    prisma.quote.count(),
    prisma.deliveryTicket.count(),
    prisma.invoice.count(),
  ]);

  return {
    productCount,
    trackedProductCount,
    customerCount,
    jobCount,
    structureCount,
    quoteCount,
    deliveryTicketCount,
    invoiceCount,
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
    // Product -> ledger/production/receiving FKs are Restrict (deleting a
    // product must never silently erase history), so this full reset removes
    // the operational records explicitly before the products.
    const inventoryTransactionsDeleted =
      await tx.inventoryTransaction.deleteMany();
    await tx.dailyProductionLine.deleteMany();
    const productionEntriesDeleted =
      await tx.dailyProductionEntry.deleteMany();
    await tx.purchaseReceiptLine.deleteMany();
    const receiptEntriesDeleted = await tx.purchaseReceiptEntry.deleteMany();
    const castingLinksDeleted = await tx.productCastingComponent.deleteMany();
    const productsDeleted = await tx.product.deleteMany();
    return {
      inventoryTransactionsDeleted: inventoryTransactionsDeleted.count,
      productionEntriesDeleted: productionEntriesDeleted.count,
      receiptEntriesDeleted: receiptEntriesDeleted.count,
      castingLinksDeleted: castingLinksDeleted.count,
      productsDeleted: productsDeleted.count,
    };
  });

  await writeAuditLog({
    userId: user.id,
    action: "settings.clear_all_products",
    entityType: "Product",
    summary: `${user.displayName} cleared all products (${result.productsDeleted} deleted, ${result.castingLinksDeleted} casting BOM links, ${result.inventoryTransactionsDeleted} inventory transactions, ${result.productionEntriesDeleted} production entries, ${result.receiptEntriesDeleted} purchase receipts removed)`,
    metadata: {
      deletedCount: result.productsDeleted,
      castingLinksDeleted: result.castingLinksDeleted,
      inventoryTransactionsDeleted: result.inventoryTransactionsDeleted,
      productionEntriesDeleted: result.productionEntriesDeleted,
      receiptEntriesDeleted: result.receiptEntriesDeleted,
    },
  });

  revalidateAfterProductReset();
  return {
    success: `Deleted ${result.productsDeleted} product${result.productsDeleted === 1 ? "" : "s"}.`,
  };
}

export async function setAllTrackedStockFormAction(
  formData: FormData,
): Promise<SettingsActionResult> {
  const user = await requirePermission(AppPermission.SETTINGS_MANAGE);
  const resetPassword = parseResetPassword(formData);

  if (!verifySettingsResetPassword(resetPassword)) {
    return resetPasswordError();
  }

  const stockLevelRaw = String(formData.get("stockLevel") ?? "").trim();
  const stockLevel = Number(stockLevelRaw);
  if (
    !stockLevelRaw ||
    !Number.isInteger(stockLevel) ||
    stockLevel < 0 ||
    stockLevel > 1_000_000
  ) {
    return { error: "Stock level must be a whole number between 0 and 1,000,000." };
  }

  const result = await prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: {
        trackInventory: true,
        currentStockQuantity: { not: stockLevel },
      },
      select: { id: true, currentStockQuantity: true },
    });
    if (products.length === 0) {
      return { adjusted: 0 };
    }

    // Write matching ADJUSTMENT ledger rows so currentStockQuantity keeps
    // reconciling to the sum of InventoryTransaction rows.
    const transactionDate = new Date();
    await tx.inventoryTransaction.createMany({
      data: products.map((product) => ({
        productId: product.id,
        quantityChange: stockLevel - product.currentStockQuantity,
        transactionType: "ADJUSTMENT" as const,
        transactionDate,
        notes: `Test stock level: set to ${stockLevel} from Settings → Data Reset`,
        createdBy: user.displayName,
      })),
    });
    await tx.product.updateMany({
      where: { id: { in: products.map((product) => product.id) } },
      data: { currentStockQuantity: stockLevel },
    });
    return { adjusted: products.length };
  });

  if (result.adjusted === 0) {
    return {
      success: `All tracked products are already at ${stockLevel}.`,
    };
  }

  await writeAuditLog({
    userId: user.id,
    action: "settings.set_all_tracked_stock",
    entityType: "Product",
    summary: `${user.displayName} set stock to ${stockLevel} for ${result.adjusted} tracked product${result.adjusted === 1 ? "" : "s"} (test stock tool)`,
    metadata: { stockLevel, adjustedCount: result.adjusted },
  });

  revalidatePath("/products");
  revalidatePath("/inventory");
  revalidatePath("/settings/data-reset");
  return {
    success: `Set stock to ${stockLevel} for ${result.adjusted} tracked product${result.adjusted === 1 ? "" : "s"}.`,
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

export async function clearAllStructuresFormAction(
  formData: FormData,
): Promise<SettingsActionResult> {
  const user = await requirePermission(AppPermission.SETTINGS_MANAGE);
  const resetPassword = parseResetPassword(formData);

  if (!verifySettingsResetPassword(resetPassword)) {
    return resetPasswordError();
  }

  const structureCount = await prisma.jobStructure.count();
  if (structureCount === 0) {
    return { success: "No structures to delete." };
  }

  // Sections, openings, castings, dimensions, calc, documents, and pieces
  // cascade with each structure; quote and delivery ticket lines keep their
  // rows and just lose the structure link (SetNull).
  const result = await prisma.jobStructure.deleteMany();

  await writeAuditLog({
    userId: user.id,
    action: "settings.clear_all_structures",
    entityType: "JobStructure",
    summary: `${user.displayName} cleared all structures and drill sheets (${result.count} deleted)`,
    metadata: { deletedCount: result.count },
  });

  revalidatePath("/structures");
  revalidatePath("/drill-sheets");
  revalidatePath("/production");
  revalidatePath("/settings/data-reset");
  return {
    success: `Deleted ${result.count} structure${result.count === 1 ? "" : "s"}.`,
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

  const jobCount = await prisma.job.count();
  if (jobCount === 0) {
    return { success: "No jobs to delete." };
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.quote.updateMany({
      where: { jobNumber: { not: null } },
      data: { jobNumber: null },
    });
    await tx.deliveryTicket.updateMany({
      where: { jobNumber: { not: null } },
      data: { jobNumber: null },
    });
    await tx.invoice.updateMany({
      where: { jobNumber: { not: null } },
      data: { jobNumber: null },
    });
    const biddersDeleted = await tx.jobBidder.deleteMany();
    const filesDeleted = await tx.jobFile.deleteMany();
    const favoritesDeleted = await tx.jobFavorite.deleteMany();
    // Structures with no quote would become permanently inaccessible (both FKs null) after job deletion.
    // Structures that have a quoteId survive linked to their quote with jobId nulled by the FK cascade.
    await tx.jobStructure.deleteMany({ where: { quoteId: null } });
    const jobsDeleted = await tx.job.deleteMany();
    const sequencesDeleted = await tx.jobSequence.deleteMany();
    return {
      jobsDeleted: jobsDeleted.count,
      sequencesDeleted: sequencesDeleted.count,
      biddersDeleted: biddersDeleted.count,
      filesDeleted: filesDeleted.count,
      favoritesDeleted: favoritesDeleted.count,
    };
  });

  if (result.jobsDeleted === 0) {
    return { success: "No jobs to delete." };
  }

  await writeAuditLog({
    userId: user.id,
    action: "settings.clear_all_jobs",
    entityType: "Job",
    summary: `${user.displayName} cleared all jobs (${result.jobsDeleted} deleted, ${result.biddersDeleted} bid entries, ${result.filesDeleted} file records, and ${result.favoritesDeleted} favorites removed, ${result.sequencesDeleted} sequence year${result.sequencesDeleted === 1 ? "" : "s"} reset)`,
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

export async function clearAllQuotesFormAction(
  formData: FormData,
): Promise<SettingsActionResult> {
  const user = await requirePermission(AppPermission.SETTINGS_MANAGE);
  const resetPassword = parseResetPassword(formData);

  if (!verifySettingsResetPassword(resetPassword)) {
    return resetPasswordError();
  }

  const quoteCount = await prisma.quote.count();
  if (quoteCount === 0) {
    return { success: "No quotes to delete." };
  }

  const result = await prisma.$transaction(async (tx) => {
    // Structures reachable only through a quote (no job) would be orphaned by
    // the quote FK going null, so remove them explicitly; job-linked ones
    // survive with quoteId nulled. Same for quote-only plan sheets.
    const structuresDeleted = await tx.jobStructure.deleteMany({
      where: { quoteId: { not: null }, jobId: null },
    });
    const planSheetsDeleted = await tx.planSheet.deleteMany({
      where: { quoteId: { not: null }, jobId: null },
    });
    // Quote line items cascade; delivery tickets and invoices keep their rows
    // and just lose the quote link (SetNull).
    const quotesDeleted = await tx.quote.deleteMany();
    return {
      quotesDeleted: quotesDeleted.count,
      structuresDeleted: structuresDeleted.count,
      planSheetsDeleted: planSheetsDeleted.count,
    };
  });

  await writeAuditLog({
    userId: user.id,
    action: "settings.clear_all_quotes",
    entityType: "Quote",
    summary: `${user.displayName} cleared all quotes (${result.quotesDeleted} deleted, ${result.structuresDeleted} quote-only structure${result.structuresDeleted === 1 ? "" : "s"} and ${result.planSheetsDeleted} plan sheet${result.planSheetsDeleted === 1 ? "" : "s"} removed)`,
    metadata: {
      deletedCount: result.quotesDeleted,
      structuresDeleted: result.structuresDeleted,
      planSheetsDeleted: result.planSheetsDeleted,
    },
  });

  revalidatePath("/quotes");
  revalidatePath("/structures");
  revalidatePath("/drill-sheets");
  revalidatePath("/delivery-tickets");
  revalidatePath("/settings/data-reset");
  return {
    success: `Deleted ${result.quotesDeleted} quote${result.quotesDeleted === 1 ? "" : "s"}.`,
  };
}

export async function clearAllDeliveryTicketsFormAction(
  formData: FormData,
): Promise<SettingsActionResult> {
  const user = await requirePermission(AppPermission.SETTINGS_MANAGE);
  const resetPassword = parseResetPassword(formData);

  if (!verifySettingsResetPassword(resetPassword)) {
    return resetPasswordError();
  }

  const [ticketCount, invoiceCount] = await Promise.all([
    prisma.deliveryTicket.count(),
    prisma.invoice.count(),
  ]);
  if (ticketCount === 0 && invoiceCount === 0) {
    return { success: "No delivery tickets or invoices to delete." };
  }

  const result = await prisma.$transaction(async (tx) => {
    // Invoice -> DeliveryTicket is Restrict, so invoices go first (their line
    // items cascade). Ticket line items cascade with each ticket.
    const invoicesDeleted = await tx.invoice.deleteMany();
    const ticketsDeleted = await tx.deliveryTicket.deleteMany();
    const ticketSequencesDeleted = await tx.deliveryTicketSequence.deleteMany();
    const invoiceSequencesDeleted = await tx.invoiceSequence.deleteMany();
    return {
      invoicesDeleted: invoicesDeleted.count,
      ticketsDeleted: ticketsDeleted.count,
      sequencesDeleted:
        ticketSequencesDeleted.count + invoiceSequencesDeleted.count,
    };
  });

  await writeAuditLog({
    userId: user.id,
    action: "settings.clear_all_delivery_tickets",
    entityType: "DeliveryTicket",
    summary: `${user.displayName} cleared all delivery tickets and invoices (${result.ticketsDeleted} ticket${result.ticketsDeleted === 1 ? "" : "s"}, ${result.invoicesDeleted} invoice${result.invoicesDeleted === 1 ? "" : "s"} deleted)`,
    metadata: {
      ticketsDeleted: result.ticketsDeleted,
      invoicesDeleted: result.invoicesDeleted,
      sequencesDeleted: result.sequencesDeleted,
    },
  });

  revalidatePath("/delivery-tickets");
  revalidatePath("/walk-ins");
  revalidatePath("/invoices");
  revalidatePath("/settings/data-reset");
  return {
    success: `Deleted ${result.ticketsDeleted} delivery ticket${result.ticketsDeleted === 1 ? "" : "s"} and ${result.invoicesDeleted} invoice${result.invoicesDeleted === 1 ? "" : "s"}.${result.sequencesDeleted > 0 ? " Ticket and invoice numbering will start over." : ""}`,
  };
}
