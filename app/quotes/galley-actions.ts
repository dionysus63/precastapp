"use server";

import { revalidatePath } from "next/cache";
import { AppPermission, Prisma } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/auth/audit";
import { withDatabaseRetry } from "@/lib/prisma";
import {
  findGalleyFamilyMember,
  loadGalleyFamilies,
} from "@/lib/galley-service";
import {
  GALLEY_TYPE_ORDER,
  galleyTypeLabels,
  validateGalleyBreakdownCounts,
  type GalleyBreakdownCounts,
} from "@/lib/galley-utils";
import { computeQuoteTotalsFromLines } from "@/lib/quote-copy";

/**
 * Quote statuses where a galley family total may be broken into (or
 * re-balanced across) End/Middle/CB lines. WON is the primary case — the
 * breakdown never changes quantity totals or money, so it stays legal after
 * the quote locks for normal editing.
 */
const BREAKDOWN_STATUSES = new Set(["DRAFT", "IN_REVIEW", "SENT", "WON"]);

export type ApplyGalleyBreakdownResult = { error: string } | { ok: true };

/**
 * Replaces a quote's galley lines for one family with typed product lines
 * matching `counts`. Handles both the initial breakdown (family-total line
 * present) and later re-balancing (typed lines only), keeping the total
 * count — and therefore the quote total — unchanged.
 */
export async function applyGalleyBreakdown(
  quoteId: string,
  familyCode: string,
  counts: GalleyBreakdownCounts,
): Promise<ApplyGalleyBreakdownResult> {
  const user = await requirePermission(AppPermission.QUOTES_MANAGE);

  if (!quoteId.trim() || !familyCode.trim()) {
    return { error: "Quote and galley family are required." };
  }

  try {
    let quoteNumber = "";
    await withDatabaseRetry(async (client) => {
      await client.$transaction(async (tx) => {
        const { lockQuoteForUpdate } = await import("@/lib/quote-revision");
        await lockQuoteForUpdate(tx, quoteId);

        const quote = await tx.quote.findUnique({
          where: { id: quoteId },
          select: {
            id: true,
            quoteNumber: true,
            status: true,
            originalQuoteId: true,
            revisionNumber: true,
            taxRate: true,
            discountAmount: true,
          },
        });
        if (!quote) {
          throw new Error("Quote was not found.");
        }
        quoteNumber = quote.quoteNumber;

        if (!BREAKDOWN_STATUSES.has(quote.status)) {
          throw new Error(
            `Galley breakdowns are not available on ${quote.status.toLowerCase()} quotes.`,
          );
        }

        // A superseded quote's lines belong to history — the newest revision
        // owns the operational line set.
        const rootId = quote.originalQuoteId ?? quoteId;
        const newer = await tx.quote.findFirst({
          where: {
            OR: [{ id: rootId }, { originalQuoteId: rootId }],
            revisionNumber: { gt: quote.revisionNumber },
          },
          orderBy: { revisionNumber: "asc" },
          select: { quoteNumber: true },
        });
        if (newer) {
          throw new Error(
            `This quote was revised — apply the breakdown on ${newer.quoteNumber} instead.`,
          );
        }

        const lines = await tx.quoteLineItem.findMany({
          where: { quoteId },
          orderBy: [{ sortOrder: "asc" }, { lineNumber: "asc" }],
          include: {
            product: {
              select: { id: true, galleyFamilyCode: true, galleyType: true },
            },
          },
        });

        const familyTotalLines = lines.filter(
          (line) => line.galleyFamilyCode === familyCode && !line.productId,
        );
        const typedLines = lines.filter(
          (line) =>
            line.productId && line.product?.galleyFamilyCode === familyCode,
        );
        const affectedLines = [...familyTotalLines, ...typedLines];
        if (affectedLines.length === 0) {
          throw new Error(
            `No ${familyCode} galley lines were found on this quote.`,
          );
        }
        if (familyTotalLines.length > 1) {
          throw new Error(
            `This quote has ${familyTotalLines.length} separate ${familyCode} total lines — combine them into one before breaking down.`,
          );
        }

        const expectedTotal = affectedLines.reduce(
          (sum, line) => sum + Number(line.quantity),
          0,
        );

        const families = await loadGalleyFamilies(tx, [familyCode]);
        const family = families.get(familyCode);
        if (!family) {
          throw new Error(
            `Galley family "${familyCode}" has no active products — check the product catalog.`,
          );
        }

        const availableTypes = family.members.map(
          (member) => member.galleyType,
        );
        const validationError = validateGalleyBreakdownCounts(
          counts,
          expectedTotal,
          availableTypes,
        );
        if (validationError) {
          throw new Error(validationError);
        }

        // Anything already scheduled or billed pins the current mix.
        const affectedIds = affectedLines.map((line) => line.id);
        // Sequential awaits: transaction clients are pinned to one pg
        // connection — no concurrent queries.
        const ticketRefs = await tx.deliveryTicketLineItem.count({
          where: { quoteLineItemId: { in: affectedIds } },
        });
        const invoiceRefs = await tx.invoiceLineItem.count({
          where: { quoteLineItemId: { in: affectedIds } },
        });
        if (ticketRefs > 0 || invoiceRefs > 0) {
          throw new Error(
            "These galley lines already have delivery tickets or invoices against them — the mix can no longer be changed here.",
          );
        }

        // Unit price/terms carry over from the family-total line when present,
        // otherwise from the first typed line (all members share pricing).
        const template = familyTotalLines[0] ?? typedLines[0]!;
        const anchorIndex = lines.findIndex(
          (line) => line.id === (familyTotalLines[0]?.id ?? typedLines[0]!.id),
        );

        await tx.quoteLineItem.deleteMany({
          where: { id: { in: affectedIds } },
        });

        const replacements: Prisma.QuoteLineItemUncheckedCreateInput[] = [];
        for (const type of GALLEY_TYPE_ORDER) {
          const count = counts[type];
          if (count <= 0) {
            continue;
          }
          const member = findGalleyFamilyMember(family, type);
          if (!member) {
            // validateGalleyBreakdownCounts already rejected this.
            throw new Error(
              `No active ${galleyTypeLabels[type]} product for ${familyCode}.`,
            );
          }
          replacements.push({
            quoteId,
            lineNumber: 0,
            lineType: "STOCK_PRODUCT",
            productId: member.productId,
            itemCode: member.productCode,
            description: member.description ?? member.name,
            quantity: new Prisma.Decimal(count),
            unit: template.unit || member.unit,
            unitPrice: template.unitPrice,
            weight:
              member.weightLb != null
                ? new Prisma.Decimal(member.weightLb)
                : template.weight,
            yards:
              member.yards != null ? new Prisma.Decimal(member.yards) : null,
            taxable: template.taxable,
            total: new Prisma.Decimal(count).mul(template.unitPrice),
            statusNote: template.statusNote,
            notes: template.notes,
            sortOrder: 0,
          });
        }

        const createdIds: string[] = [];
        for (const replacement of replacements) {
          const created = await tx.quoteLineItem.create({
            data: replacement,
            select: { id: true },
          });
          createdIds.push(created.id);
        }

        // Renumber: survivors keep their relative order, replacements slot in
        // where the family sat.
        const surviving = lines.filter((line) => !affectedIds.includes(line.id));
        const orderedIds = [
          ...surviving.slice(0, anchorIndex).map((line) => line.id),
          ...createdIds,
          ...surviving.slice(anchorIndex).map((line) => line.id),
        ];
        for (const [index, id] of orderedIds.entries()) {
          await tx.quoteLineItem.update({
            where: { id },
            data: { sortOrder: index + 1, lineNumber: index + 1 },
          });
        }

        // Totals are invariant in theory (same count × same price); recompute
        // with the shared Decimal path so stored figures always match lines.
        const finalLines = await tx.quoteLineItem.findMany({
          where: { quoteId },
          orderBy: { sortOrder: "asc" },
        });
        const { computed, lineTotals, totalWeight, totalYards, deliveryAmount } =
          computeQuoteTotalsFromLines(
            finalLines,
            quote.taxRate,
            quote.discountAmount,
          );
        for (const [index, line] of finalLines.entries()) {
          await tx.quoteLineItem.update({
            where: { id: line.id },
            data: { total: lineTotals[index] },
          });
        }
        await tx.quote.update({
          where: { id: quoteId },
          data: {
            subtotal: computed.subtotal,
            deliveryAmount,
            taxableAmount: computed.taxableAmount,
            salesTax: computed.salesTax,
            total: computed.total,
            totalWeight,
            totalYards,
          },
        });
      });
    });

    const countsSummary = GALLEY_TYPE_ORDER.filter((type) => counts[type] > 0)
      .map((type) => `${counts[type]} ${galleyTypeLabels[type]}`)
      .join(", ");
    await writeAuditLog({
      userId: user.id,
      action: "quote.galley_breakdown",
      entityType: "Quote",
      entityId: quoteId,
      summary: `${user.displayName} broke down ${familyCode} on quote ${quoteNumber} into ${countsSummary}`,
      metadata: { familyCode, counts },
    });

    revalidatePath(`/quotes/${quoteId}`);
    revalidatePath(`/quotes/${quoteId}/preview`);
    revalidatePath("/quotes");

    return { ok: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not apply the galley breakdown. Please try again.",
    };
  }
}
