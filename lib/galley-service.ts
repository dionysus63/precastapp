import type { PrismaClient, Prisma } from "@/app/generated/prisma/client";
import {
  GALLEY_TYPE_ORDER,
  stripGalleyTypeSuffix,
  type GalleyBreakdownView,
  type GalleyTypeValue,
} from "@/lib/galley-utils";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type GalleyFamilyMember = {
  productId: string;
  productCode: string;
  name: string;
  description: string | null;
  galleyType: GalleyTypeValue;
  unit: string;
  taxable: boolean;
  weightLb: number | null;
  yards: number | null;
};

export type GalleyFamily = {
  familyCode: string;
  /** Customer-facing label, e.g. `Storm Leaching Galley - 4'-0"`. */
  label: string;
  members: GalleyFamilyMember[];
};

/**
 * Active galley products grouped into height families, keyed by family code.
 * Members are ordered End → Middle → CB. Pass familyCodes to scope the query;
 * omit for all families.
 */
export async function loadGalleyFamilies(
  client: DbClient,
  familyCodes?: string[],
): Promise<Map<string, GalleyFamily>> {
  if (familyCodes && familyCodes.length === 0) {
    return new Map();
  }

  const products = await client.product.findMany({
    where: {
      status: "ACTIVE",
      galleyType: { not: null },
      galleyFamilyCode: familyCodes
        ? { in: familyCodes }
        : { not: null },
    },
    orderBy: { productCode: "asc" },
    select: {
      id: true,
      productCode: true,
      name: true,
      description: true,
      unit: true,
      taxable: true,
      weight: true,
      yards: true,
      galleyFamilyCode: true,
      galleyType: true,
    },
  });

  const families = new Map<string, GalleyFamily>();
  for (const product of products) {
    if (!product.galleyFamilyCode || !product.galleyType) {
      continue;
    }
    const family = families.get(product.galleyFamilyCode) ?? {
      familyCode: product.galleyFamilyCode,
      label: stripGalleyTypeSuffix(product.name),
      members: [],
    };
    family.members.push({
      productId: product.id,
      productCode: product.productCode,
      name: product.name,
      description: product.description?.trim() || null,
      galleyType: product.galleyType,
      unit: product.unit,
      taxable: product.taxable,
      weightLb: product.weight != null ? Number(product.weight) : null,
      yards: product.yards != null ? Number(product.yards) : null,
    });
    families.set(product.galleyFamilyCode, family);
  }

  for (const family of families.values()) {
    family.members.sort(
      (a, b) =>
        GALLEY_TYPE_ORDER.indexOf(a.galleyType) -
        GALLEY_TYPE_ORDER.indexOf(b.galleyType),
    );
  }

  return families;
}

export function findGalleyFamilyMember(
  family: GalleyFamily,
  galleyType: GalleyTypeValue,
): GalleyFamilyMember | null {
  return (
    family.members.find((member) => member.galleyType === galleyType) ?? null
  );
}

type GalleyQuoteLine = {
  id: string;
  productId: string | null;
  galleyFamilyCode: string | null;
  quantity: { toString(): string };
  product?: {
    galleyFamilyCode?: string | null;
    galleyType?: string | null;
  } | null;
};

/**
 * Breakdown state per galley family on a won quote, for the detail page's
 * banner/adjust controls. Returns [] for quotes that aren't WON — before
 * award the family total is just a normal editable line.
 */
export async function buildGalleyBreakdownViews(
  client: DbClient,
  quote: { status: string; lineItems: GalleyQuoteLine[] },
): Promise<GalleyBreakdownView[]> {
  if (quote.status !== "WON") {
    return [];
  }

  const pendingCodes = new Set<string>();
  const typedLinesByCode = new Map<string, GalleyQuoteLine[]>();
  const totalsByCode = new Map<string, number>();

  for (const line of quote.lineItems) {
    if (line.galleyFamilyCode && !line.productId) {
      pendingCodes.add(line.galleyFamilyCode);
      totalsByCode.set(
        line.galleyFamilyCode,
        (totalsByCode.get(line.galleyFamilyCode) ?? 0) +
          Number(line.quantity),
      );
      continue;
    }
    const familyCode = line.product?.galleyFamilyCode;
    if (line.productId && familyCode && line.product?.galleyType) {
      const linesForCode = typedLinesByCode.get(familyCode) ?? [];
      linesForCode.push(line);
      typedLinesByCode.set(familyCode, linesForCode);
      totalsByCode.set(
        familyCode,
        (totalsByCode.get(familyCode) ?? 0) + Number(line.quantity),
      );
    }
  }

  const codes = [...new Set([...pendingCodes, ...typedLinesByCode.keys()])];
  if (codes.length === 0) {
    return [];
  }

  const families = await loadGalleyFamilies(client, codes);

  // The mix freezes once any of the family's typed lines is on a ticket or
  // invoice.
  const typedLineIds = [...typedLinesByCode.values()]
    .flat()
    .map((line) => line.id);
  const referencedLineIds = new Set<string>();
  if (typedLineIds.length > 0) {
    const ticketRefs = await client.deliveryTicketLineItem.findMany({
      where: { quoteLineItemId: { in: typedLineIds } },
      select: { quoteLineItemId: true },
    });
    const invoiceRefs = await client.invoiceLineItem.findMany({
      where: { quoteLineItemId: { in: typedLineIds } },
      select: { quoteLineItemId: true },
    });
    for (const ref of [...ticketRefs, ...invoiceRefs]) {
      if (ref.quoteLineItemId) {
        referencedLineIds.add(ref.quoteLineItemId);
      }
    }
  }

  const views: GalleyBreakdownView[] = [];
  for (const code of codes) {
    const family = families.get(code);
    const typedLines = typedLinesByCode.get(code) ?? [];

    const counts: GalleyBreakdownView["counts"] = {};
    for (const line of typedLines) {
      const type = line.product?.galleyType as GalleyTypeValue | undefined;
      if (type) {
        counts[type] = (counts[type] ?? 0) + Number(line.quantity);
      }
    }

    const memberCodes: GalleyBreakdownView["memberCodes"] = {};
    for (const member of family?.members ?? []) {
      memberCodes[member.galleyType] = member.productCode;
    }

    views.push({
      familyCode: code,
      label: family?.label ?? code,
      total: totalsByCode.get(code) ?? 0,
      pending: pendingCodes.has(code),
      counts,
      availableTypes: family?.members.map((member) => member.galleyType) ?? [],
      memberCodes,
      locked: typedLines.some((line) => referencedLineIds.has(line.id)),
    });
  }

  // Pending families first so the banner leads.
  views.sort((a, b) =>
    a.pending === b.pending
      ? a.familyCode.localeCompare(b.familyCode)
      : a.pending
        ? -1
        : 1,
  );
  return views;
}
