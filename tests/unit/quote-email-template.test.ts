import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUOTE_EMAIL_BODY_TEMPLATE,
  DEFAULT_QUOTE_EMAIL_SUBJECT_TEMPLATE,
  renderQuoteEmailTemplate,
  type QuoteEmailTemplateVars,
} from "@/lib/email/quote-email";

const vars: QuoteEmailTemplateVars = {
  contact: "Tom Caruso",
  customer: "Bayview Site Works Inc.",
  project: "Main St Pump Station",
  quoteNumber: "Q-26-014 (R1)",
  companyName: "Long Island Precast",
  companyPhone: "(631) 286-0240",
  companyEmail: "nick@li-precast.com",
};

describe("renderQuoteEmailTemplate", () => {
  it("substitutes every placeholder", () => {
    const out = renderQuoteEmailTemplate(
      "{contact}|{customer}|{project}|{quoteNumber}|{companyName}|{companyPhone}|{companyEmail}",
      vars,
    );
    expect(out).toBe(
      "Tom Caruso|Bayview Site Works Inc.|Main St Pump Station|Q-26-014 (R1)|Long Island Precast|(631) 286-0240|nick@li-precast.com",
    );
  });

  it("renders the default subject with and without a project", () => {
    expect(
      renderQuoteEmailTemplate(DEFAULT_QUOTE_EMAIL_SUBJECT_TEMPLATE, vars),
    ).toBe("Long Island Precast Quote Q-26-014 (R1) — Main St Pump Station");

    expect(
      renderQuoteEmailTemplate(DEFAULT_QUOTE_EMAIL_SUBJECT_TEMPLATE, {
        ...vars,
        project: "",
      }),
    ).toBe("Long Island Precast Quote Q-26-014 (R1)");
  });

  it("tidies the greeting when there is no contact", () => {
    const out = renderQuoteEmailTemplate("Hello {contact},\n\nThanks.", {
      ...vars,
      contact: "",
    });
    expect(out.startsWith("Hello,")).toBe(true);
  });

  it("drops label-only lines when their value is empty", () => {
    const out = renderQuoteEmailTemplate(DEFAULT_QUOTE_EMAIL_BODY_TEMPLATE, {
      ...vars,
      project: "",
    });
    expect(out).not.toContain("Project:");
    expect(out).not.toContain("\n\n\n");
  });

  it("keeps the project line when a project exists", () => {
    const out = renderQuoteEmailTemplate(DEFAULT_QUOTE_EMAIL_BODY_TEMPLATE, vars);
    expect(out).toContain("Project: Main St Pump Station");
    expect(out).toContain("Hello Tom Caruso,");
    expect(out).toContain("call us at (631) 286-0240");
  });

  it("leaves unknown tokens visible instead of swallowing them", () => {
    const out = renderQuoteEmailTemplate("Dear {contactt},", vars);
    expect(out).toBe("Dear {contactt},");
  });

  it("collapses runs of blank lines from emptied placeholders", () => {
    const out = renderQuoteEmailTemplate("A\n\n{project}\n\n\nB", {
      ...vars,
      project: "",
    });
    expect(out).toBe("A\n\nB");
  });
});
