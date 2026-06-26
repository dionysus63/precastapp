import { cache } from "react";
import type { AppSettings, PrismaClient } from "@/app/generated/prisma/client";
import { Prisma } from "@/app/generated/prisma/client";
import {
  JOB_SUBFOLDERS,
  JOBS_ROOT,
  STOCK_SUBMITTALS_ROOT,
} from "@/lib/job-folder-constants";
import { QUOTE_PDF_FALLBACK_DIR } from "@/lib/quote-pdf-path";
import {
  DEFAULT_PRODUCT_CATALOG,
  parseProductCatalog,
  type ProductCatalogCategory,
} from "@/lib/product-catalog-settings";
import {
  DEFAULT_RING_BUILDER_CONFIG,
  parseRingBuilderConfig,
  type RingBuilderConfig,
} from "@/lib/ring-builder-settings";
import {
  DEFAULT_DELIVERY_TICKET_COPY1_TITLE,
  DEFAULT_DELIVERY_TICKET_COPY2_TITLE,
  DEFAULT_DELIVERY_TICKET_COPY3_TITLE,
  DEFAULT_DELIVERY_TICKET_FOOTER_TEXT,
  DEFAULT_DRIVERS,
  DEFAULT_ESTIMATORS,
  DEFAULT_PAYMENT_TERMS,
  DEFAULT_QUOTE_FOOTER_TEXT,
  DEFAULT_TRAILERS,
  DEFAULT_TRUCKS,
} from "@/lib/app-settings-defaults";
import { withDatabaseRetry } from "@/lib/prisma";

export {
  DEFAULT_DELIVERY_TICKET_COPY1_TITLE,
  DEFAULT_DELIVERY_TICKET_COPY2_TITLE,
  DEFAULT_DELIVERY_TICKET_COPY3_TITLE,
  DEFAULT_DELIVERY_TICKET_FOOTER_TEXT,
  DEFAULT_DRIVERS,
  DEFAULT_ESTIMATORS,
  DEFAULT_PAYMENT_TERMS,
  DEFAULT_QUOTE_FOOTER_TEXT,
  DEFAULT_TRAILERS,
  DEFAULT_TRUCKS,
} from "@/lib/app-settings-defaults";

export type CompanyProfile = {
  name: string;
  address: string;
  phone: string;
  email: string;
};

export type AppSettingsView = {
  id: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  appTitle: string;
  appSubtitle: string;
  quoteFooterText: string | null;
  deliveryTicketCopy1Title: string;
  deliveryTicketCopy2Title: string;
  deliveryTicketCopy3Title: string;
  deliveryTicketFooterText: string;
  jobsRoot: string;
  quotePdfFallbackDir: string;
  stockSubmittalsRoot: string;
  jobSubfolders: string[];
  defaultTaxRate: number;
  quoteValidityDays: number;
  invoiceDueDays: number;
  defaultLeadTime: string | null;
  paymentTerms: string[];
  estimators: string[];
  trucks: string[];
  drivers: string[];
  trailers: string[];
  truckCapacityLabel: string;
  productCatalog: ProductCatalogCategory[];
  ringBuilderConfig: RingBuilderConfig;
  companyLogoPath: string | null;
};

export const DEFAULT_APP_SETTINGS_DATA = {
  id: "default" as const,
  companyName: "Long Island Precast",
  companyAddress: "20 Stiriz Road, Brookhaven, NY 11719",
  companyPhone: "(631) 286-0240",
  companyEmail: "nick@li-precast.com",
  appTitle: "Precast Ops",
  appSubtitle: "Quoting & Inventory",
  quoteFooterText: DEFAULT_QUOTE_FOOTER_TEXT,
  deliveryTicketCopy1Title: DEFAULT_DELIVERY_TICKET_COPY1_TITLE,
  deliveryTicketCopy2Title: DEFAULT_DELIVERY_TICKET_COPY2_TITLE,
  deliveryTicketCopy3Title: DEFAULT_DELIVERY_TICKET_COPY3_TITLE,
  deliveryTicketFooterText: DEFAULT_DELIVERY_TICKET_FOOTER_TEXT,
  jobsRoot: JOBS_ROOT,
  quotePdfFallbackDir: QUOTE_PDF_FALLBACK_DIR,
  stockSubmittalsRoot: STOCK_SUBMITTALS_ROOT,
  jobSubfolders: [...JOB_SUBFOLDERS],
  defaultTaxRate: new Prisma.Decimal(8.625),
  quoteValidityDays: 30,
  invoiceDueDays: 30,
  defaultLeadTime: null as string | null,
  paymentTerms: DEFAULT_PAYMENT_TERMS,
  estimators: DEFAULT_ESTIMATORS,
  trucks: DEFAULT_TRUCKS,
  drivers: DEFAULT_DRIVERS,
  trailers: DEFAULT_TRAILERS,
  truckCapacityLabel: "80,000 lb",
  productCatalog: DEFAULT_PRODUCT_CATALOG,
  ringBuilderConfig: DEFAULT_RING_BUILDER_CONFIG,
};

function parseStringList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const items = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return items.length > 0 ? items : fallback;
}

export function mapAppSettingsRow(row: AppSettings): AppSettingsView {
  return {
    id: row.id,
    companyName: row.companyName,
    companyAddress: row.companyAddress,
    companyPhone: row.companyPhone,
    companyEmail: row.companyEmail,
    appTitle: row.appTitle,
    appSubtitle: row.appSubtitle,
    quoteFooterText: row.quoteFooterText,
    deliveryTicketCopy1Title:
      row.deliveryTicketCopy1Title?.trim() || DEFAULT_DELIVERY_TICKET_COPY1_TITLE,
    deliveryTicketCopy2Title:
      row.deliveryTicketCopy2Title?.trim() || DEFAULT_DELIVERY_TICKET_COPY2_TITLE,
    deliveryTicketCopy3Title:
      row.deliveryTicketCopy3Title?.trim() || DEFAULT_DELIVERY_TICKET_COPY3_TITLE,
    deliveryTicketFooterText:
      row.deliveryTicketFooterText?.trim() || DEFAULT_DELIVERY_TICKET_FOOTER_TEXT,
    jobsRoot: row.jobsRoot,
    quotePdfFallbackDir: row.quotePdfFallbackDir,
    stockSubmittalsRoot: row.stockSubmittalsRoot,
    jobSubfolders: parseStringList(row.jobSubfolders, [...JOB_SUBFOLDERS]),
    defaultTaxRate: Number(row.defaultTaxRate),
    quoteValidityDays: row.quoteValidityDays,
    invoiceDueDays: row.invoiceDueDays,
    defaultLeadTime: row.defaultLeadTime,
    paymentTerms: parseStringList(row.paymentTerms, DEFAULT_PAYMENT_TERMS),
    estimators: parseStringList(row.estimators, DEFAULT_ESTIMATORS),
    trucks: parseStringList(row.trucks, DEFAULT_TRUCKS),
    drivers: parseStringList(row.drivers, DEFAULT_DRIVERS),
    trailers: parseStringList(row.trailers, DEFAULT_TRAILERS),
    truckCapacityLabel: row.truckCapacityLabel,
    productCatalog: parseProductCatalog(row.productCatalog),
    ringBuilderConfig: parseRingBuilderConfig(row.ringBuilderConfig),
    companyLogoPath: row.companyLogoPath,
  };
}

async function ensureAppSettingsRow(client: PrismaClient): Promise<AppSettings> {
  const existing = await client.appSettings.findUnique({
    where: { id: "default" },
  });

  if (existing) {
    return existing;
  }

  return client.appSettings.create({
    data: DEFAULT_APP_SETTINGS_DATA,
  });
}

export const getAppSettings = cache(async (): Promise<AppSettingsView> => {
  const row = await withDatabaseRetry((client) => ensureAppSettingsRow(client));
  return mapAppSettingsRow(row);
});

export async function getCompanyProfile(): Promise<CompanyProfile> {
  const settings = await getAppSettings();
  return {
    name: settings.companyName,
    address: settings.companyAddress,
    phone: settings.companyPhone,
    email: settings.companyEmail,
  };
}

export async function getJobsRoot(): Promise<string> {
  const settings = await getAppSettings();
  return settings.jobsRoot;
}

export async function getStockSubmittalsRoot(): Promise<string> {
  const settings = await getAppSettings();
  return settings.stockSubmittalsRoot;
}

export async function getSubmittalsJobSubfolder(): Promise<string> {
  const subfolders = await getJobSubfolders();
  return subfolders[2] ?? "03 Submittals";
}

export async function getJobSubfolders(): Promise<string[]> {
  const settings = await getAppSettings();
  return settings.jobSubfolders;
}

export async function getQuotePdfFallbackDir(): Promise<string> {
  const settings = await getAppSettings();
  return settings.quotePdfFallbackDir;
}

export async function getQuotePdfJobSubfolder(): Promise<string> {
  const subfolders = await getJobSubfolders();
  return subfolders[1] ?? "02 Quotes";
}

export async function getDefaultTaxRate(): Promise<number> {
  const settings = await getAppSettings();
  return settings.defaultTaxRate;
}

export function parseLinesList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function formatLinesList(items: string[]): string {
  return items.join("\n");
}

export function defaultQuoteExpirationDate(validityDays: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + validityDays);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function defaultInvoiceDueDate(dueDays: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + dueDays);
  date.setHours(0, 0, 0, 0);
  return date;
}
