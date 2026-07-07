import { describe, expect, it } from "vitest";
import { canEditQuote } from "@/lib/quotes/edit-rules";
import { canSendQuote } from "@/lib/quotes/send-rules";
import { isAwardableQuoteStatus } from "@/lib/job-bid-utils";
import type { QuoteStatus } from "@/lib/quotes/types";

const ALL_STATUSES: QuoteStatus[] = [
  "DRAFT",
  "IN_REVIEW",
  "SENT",
  "REVISED",
  "WON",
  "LOST",
  "LOST_BC",
  "EXPIRED",
  "CANCELLED",
];

describe("canSendQuote", () => {
  it("allows only draft, in-review, and sent (resend)", () => {
    const sendable = ALL_STATUSES.filter((status) =>
      canSendQuote(status, null),
    );
    expect(sendable).toEqual(["DRAFT", "IN_REVIEW", "SENT"]);
  });

  it("never allows sending a superseded quote", () => {
    for (const status of ALL_STATUSES) {
      expect(canSendQuote(status, { id: "newer" })).toBe(false);
    }
  });
});

describe("canEditQuote", () => {
  it("allows only draft and in-review", () => {
    const editable = ALL_STATUSES.filter((status) =>
      canEditQuote(status, null),
    );
    expect(editable).toEqual(["DRAFT", "IN_REVIEW"]);
  });

  it("never allows editing a superseded quote", () => {
    expect(canEditQuote("DRAFT", { id: "newer" })).toBe(false);
  });
});

describe("isAwardableQuoteStatus", () => {
  it("allows only open statuses to win an award", () => {
    const awardable = ALL_STATUSES.filter((status) =>
      isAwardableQuoteStatus(status),
    );
    expect(awardable).toEqual(["DRAFT", "IN_REVIEW", "SENT", "REVISED"]);
  });

  it("rejects unknown statuses", () => {
    expect(isAwardableQuoteStatus("BOGUS")).toBe(false);
  });
});
