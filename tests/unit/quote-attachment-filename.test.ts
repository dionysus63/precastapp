import { describe, expect, it } from "vitest";
import { buildQuoteAttachmentFilename } from "@/lib/quote-pdf-persist";
import type { PrismaClient } from "@/app/generated/prisma/client";

function clientWithNickname(nickname: string | null) {
  return {
    customer: {
      findUnique: async () => ({ nickname }),
    },
  } as unknown as Pick<PrismaClient, "customer">;
}

const quote = {
  customerId: "cust-1",
  customerName: "WHM Plumbing & Heating Corp.",
  projectName: "Brookhaven Logistics Center",
};

describe("buildQuoteAttachmentFilename", () => {
  it("uses the customer nickname with the job name", async () => {
    expect(
      await buildQuoteAttachmentFilename(quote, "Q-26-003", clientWithNickname("WHM")),
    ).toBe("WHM - Brookhaven Logistics Center.pdf");
  });

  it("falls back to the full customer name without a nickname", async () => {
    expect(
      await buildQuoteAttachmentFilename(quote, "Q-26-003", clientWithNickname(null)),
    ).toBe("WHM Plumbing & Heating Corp - Brookhaven Logistics Center.pdf");
  });

  it("ignores a whitespace-only nickname", async () => {
    expect(
      await buildQuoteAttachmentFilename(quote, "Q-26-003", clientWithNickname("  ")),
    ).toBe("WHM Plumbing & Heating Corp - Brookhaven Logistics Center.pdf");
  });

  it("uses the customer name directly when the quote has no customer link", async () => {
    const detached = { ...quote, customerId: null };
    const client = {
      customer: {
        findUnique: async () => {
          throw new Error("should not be called");
        },
      },
    } as unknown as Pick<PrismaClient, "customer">;
    expect(await buildQuoteAttachmentFilename(detached, "Q-26-003", client)).toBe(
      "WHM Plumbing & Heating Corp - Brookhaven Logistics Center.pdf",
    );
  });

  it("sanitizes filename-hostile characters and falls back when empty", async () => {
    const hostile = {
      customerId: "cust-1",
      customerName: 'A<>:"/\\|?*B',
      projectName: "Job?*Name",
    };
    expect(
      await buildQuoteAttachmentFilename(hostile, "Q-26-003", clientWithNickname(null)),
    ).toBe("AB - JobName.pdf");

    const empty = { customerId: null, customerName: "***", projectName: "???" };
    expect(
      await buildQuoteAttachmentFilename(empty, "Q-26-003", clientWithNickname(null)),
    ).toBe("Q-26-003.pdf");
  });
});
