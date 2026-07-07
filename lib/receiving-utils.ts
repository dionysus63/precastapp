import type { ReceivingCategory } from "@/app/generated/prisma/client";

export type { ReceivingCategory };

export const RECEIVING_CATEGORIES = [
  "RCP",
  "ADS_PIPE",
  "DOMESTIC_CASTINGS",
  "IMPORTED_CASTINGS",
] as const satisfies readonly ReceivingCategory[];

export type ReceivingCategoryKey = (typeof RECEIVING_CATEGORIES)[number];

export const receivingCategoryLabels: Record<ReceivingCategoryKey, string> = {
  RCP: "RCP (Vianini)",
  ADS_PIPE: "ADS Pipe",
  DOMESTIC_CASTINGS: "Domestic Castings",
  IMPORTED_CASTINGS: "Imported Castings",
};

export const receivingCategoryShortLabels: Record<ReceivingCategoryKey, string> = {
  RCP: "RCP",
  ADS_PIPE: "ADS",
  DOMESTIC_CASTINGS: "Domestic",
  IMPORTED_CASTINGS: "Imported",
};

export const receivingCategoryDescriptions: Record<ReceivingCategoryKey, string> = {
  RCP: "Reinforced concrete pipe from Vianini",
  ADS_PIPE: "Plastic ADS pipe deliveries",
  DOMESTIC_CASTINGS: "Cast iron from domestic suppliers",
  IMPORTED_CASTINGS: "Cast iron from imported suppliers",
};

export const receivingCategoryDefaultSupplier: Partial<
  Record<ReceivingCategoryKey, string>
> = {
  RCP: "Vianini",
  ADS_PIPE: "ADS",
};

export function formatReceivingCategoryLabel(
  category: ReceivingCategory | null | undefined,
): string {
  if (!category) {
    return "Uncategorized";
  }
  return receivingCategoryLabels[category] ?? category;
}

export function formatReceivingCategoryShortLabel(
  category: ReceivingCategory | null | undefined,
): string {
  if (!category) {
    return "Other";
  }
  return receivingCategoryShortLabels[category] ?? category;
}

export function parseReceivingCategory(value: string): ReceivingCategory | null {
  const normalized = value.trim().toUpperCase();
  if (
    normalized === "RCP" ||
    normalized === "ADS_PIPE" ||
    normalized === "DOMESTIC_CASTINGS" ||
    normalized === "IMPORTED_CASTINGS"
  ) {
    return normalized;
  }
  return null;
}

export function isCastingReceivingCategory(
  category: ReceivingCategory,
): category is "DOMESTIC_CASTINGS" | "IMPORTED_CASTINGS" {
  return category === "DOMESTIC_CASTINGS" || category === "IMPORTED_CASTINGS";
}

export function isPipeReceivingCategory(
  category: ReceivingCategory,
): category is "RCP" | "ADS_PIPE" {
  return category === "RCP" || category === "ADS_PIPE";
}

export function castingOriginForCategory(
  category: ReceivingCategory,
): "DOMESTIC" | "IMPORTED" | null {
  if (category === "DOMESTIC_CASTINGS") {
    return "DOMESTIC";
  }
  if (category === "IMPORTED_CASTINGS") {
    return "IMPORTED";
  }
  return null;
}

export type DeliveryStaleness = "none" | "fresh" | "recent" | "stale" | "overdue";

export function getDeliveryStaleness(
  receiptDate: Date | null | undefined,
): DeliveryStaleness {
  if (!receiptDate) {
    return "none";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const receipt = new Date(receiptDate);
  receipt.setHours(0, 0, 0, 0);
  const daysAgo = Math.floor(
    (today.getTime() - receipt.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysAgo <= 0) {
    return "fresh";
  }
  if (daysAgo <= 7) {
    return "recent";
  }
  if (daysAgo <= 14) {
    return "stale";
  }
  return "overdue";
}

export function formatRelativeDeliveryDate(
  receiptDate: Date | null | undefined,
): string {
  if (!receiptDate) {
    return "No deliveries yet";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const receipt = new Date(receiptDate);
  receipt.setHours(0, 0, 0, 0);
  const daysAgo = Math.floor(
    (today.getTime() - receipt.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysAgo <= 0) {
    return "Today";
  }
  if (daysAgo === 1) {
    return "Yesterday";
  }
  if (daysAgo < 7) {
    return `${daysAgo} days ago`;
  }
  if (daysAgo < 14) {
    return "1 week ago";
  }
  if (daysAgo < 30) {
    const weeks = Math.floor(daysAgo / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }
  if (daysAgo < 365) {
    const months = Math.floor(daysAgo / 30);
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }
  return receiptDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function stalenessBadgeVariant(
  staleness: DeliveryStaleness,
): "success" | "warning" | "danger" | "neutral" {
  switch (staleness) {
    case "fresh":
    case "recent":
      return "success";
    case "stale":
      return "warning";
    case "overdue":
      return "danger";
    default:
      return "neutral";
  }
}

export function stalenessCardAccent(
  staleness: DeliveryStaleness,
): "emerald" | "amber" | "rose" | "sky" {
  switch (staleness) {
    case "fresh":
    case "recent":
      return "emerald";
    case "stale":
      return "amber";
    case "overdue":
      return "rose";
    default:
      return "sky";
  }
}

export function formatReceiptDate(receiptDate: Date): string {
  return receiptDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function sumReceiptLineQuantities(
  lines: Array<{ quantityReceived: { toNumber?: () => number } | number | string }>,
): number {
  return lines.reduce((sum, line) => {
    const qty =
      typeof line.quantityReceived === "object" &&
      line.quantityReceived !== null &&
      "toNumber" in line.quantityReceived &&
      typeof line.quantityReceived.toNumber === "function"
        ? line.quantityReceived.toNumber()
        : Number(line.quantityReceived);
    return sum + (Number.isFinite(qty) ? qty : 0);
  }, 0);
}
