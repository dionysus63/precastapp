import { describe, expect, it } from "vitest";
import { buildQuoteLineAliasMap } from "@/lib/delivery-fulfillment";
import type { PrismaClient } from "@/app/generated/prisma/client";

/**
 * Fake client: quote "R2" has current lines B1 (lineage B1←A1←Z1) and B2 (no
 * predecessors). findMany is routed on the where clause the real code uses.
 */
function fakeClient() {
  const previousById: Record<string, string | null> = {
    B1: "A1",
    B2: null,
    A1: "Z1",
    Z1: null,
  };

  return {
    quoteLineItem: {
      findMany: async (args: {
        where: { quoteId?: string; id?: { in: string[] } };
        select: Record<string, boolean>;
      }) => {
        if (args.where.quoteId) {
          return [{ id: "B1" }, { id: "B2" }];
        }
        const ids = args.where.id?.in ?? [];
        return ids
          .filter((id) => id in previousById)
          .map((id) => ({ id, previousLineItemId: previousById[id] }));
      },
    },
  } as unknown as PrismaClient;
}

describe("buildQuoteLineAliasMap", () => {
  it("maps every ancestor line id (multi-hop) to the current line id", async () => {
    const alias = await buildQuoteLineAliasMap(fakeClient(), "R2");

    expect(alias.get("B1")).toBe("B1");
    expect(alias.get("A1")).toBe("B1");
    expect(alias.get("Z1")).toBe("B1");
    expect(alias.get("B2")).toBe("B2");
    expect(alias.has("unrelated")).toBe(false);
  });
});
