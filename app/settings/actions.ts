"use server";

import { access, mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma/client";
import { syncAllJobFilesFromDisk } from "@/lib/job-files-service";
import {
  formatLinesList,
  getAppSettings,
  parseLinesList,
} from "@/lib/app-settings";
import {
  removeCompanyLogo,
  saveCompanyLogo,
} from "@/lib/company-logo";
import { withDatabaseRetry } from "@/lib/prisma";

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
  revalidatePath("/settings/system");
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
  await createPriceList(formData);
}

export async function upsertPriceListItemFormAction(formData: FormData): Promise<void> {
  await upsertPriceListItem(formData);
}

export async function deletePriceListItemFormAction(formData: FormData): Promise<void> {
  await deletePriceListItem(formData);
}

export async function createPriceList(formData: FormData) {
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
  const companyName = String(formData.get("companyName") ?? "").trim();
  const companyAddress = String(formData.get("companyAddress") ?? "").trim();
  const companyPhone = String(formData.get("companyPhone") ?? "").trim();
  const companyEmail = String(formData.get("companyEmail") ?? "").trim();
  const appTitle = String(formData.get("appTitle") ?? "").trim();
  const appSubtitle = String(formData.get("appSubtitle") ?? "").trim();
  const quoteFooterText =
    String(formData.get("quoteFooterText") ?? "").trim() || null;

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
  });
}

export async function updateBillingSettingsFormAction(
  formData: FormData,
): Promise<SettingsActionResult> {
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

export async function testJobsRootWriteAccessAction(): Promise<SettingsActionResult> {
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
  const settings = await getAppSettings();
  try {
    await access(settings.jobsRoot);
    return true;
  } catch {
    return false;
  }
}

export async function ensureYearSequencesAction(): Promise<SettingsActionResult> {
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
  try {
    await withDatabaseRetry((client) => syncAllJobFilesFromDisk(client));
    revalidatePath("/files");
    revalidatePath("/settings");
    revalidatePath("/settings/system");
    return { success: "Job files synced from disk." };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not sync job files.",
    };
  }
}

export async function getDocumentNumberingPreview() {
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
      "Quote numbers derive from job numbers (Q-{jobNumber}-R0) or Q-{YY}-NEW-R0 for non-job quotes.",
  };
}

export async function getSettingsHubStatus() {
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

export { formatLinesList };
