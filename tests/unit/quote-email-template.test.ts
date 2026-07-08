import { describe, expect, it } from "vitest";
import {
  buildQuoteEmailHtml,
  buildQuoteEmailStyle,
  buildSignatureText,
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

const styleSettings = {
  quoteEmailFontFamily: "Calibri",
  quoteEmailFontSizePx: 15,
  quoteEmailTextColor: "#222222",
  quoteEmailSignatureName: "Nicholas Verruto, PE",
  quoteEmailSignatureCompany: "Long Island Precast Inc.",
  quoteEmailSignatureAddress: "20 Stiriz Rd.\nBrookhaven, NY 11719",
  quoteEmailSignaturePhoneLine: "Ph(631)286-0240 Fax(631)286-6313",
  quoteEmailSignatureEmail: "nick@li-precast.com",
  quoteEmailSignatureColor: "#1F4E79",
};

const nullStyleSettings = {
  quoteEmailFontFamily: null,
  quoteEmailFontSizePx: null,
  quoteEmailTextColor: null,
  quoteEmailSignatureName: null,
  quoteEmailSignatureCompany: null,
  quoteEmailSignatureAddress: null,
  quoteEmailSignaturePhoneLine: null,
  quoteEmailSignatureEmail: null,
  quoteEmailSignatureColor: null,
};

describe("buildQuoteEmailStyle / buildQuoteEmailHtml", () => {
  it("falls back to Arial 14 near-black with no signature", () => {
    const style = buildQuoteEmailStyle(nullStyleSettings);
    expect(style.fontStack).toContain("Arial");
    expect(style.fontSizePx).toBe(14);
    expect(style.textColor).toBe("#171717");
    expect(style.signature).toBeNull();

    const html = buildQuoteEmailHtml("Hello", style);
    expect(html).toContain("font-size: 14px");
    expect(html).not.toContain("mailto:");
  });

  it("applies configured font, size, color and renders the signature block", () => {
    const style = buildQuoteEmailStyle(styleSettings);
    const html = buildQuoteEmailHtml("Hello Tom,\nSecond line", style);

    expect(html).toContain("Calibri, Arial, sans-serif");
    expect(html).toContain("font-size: 15px");
    expect(html).toContain("color: #222222");
    expect(html).toContain("Hello Tom,<br>Second line");
    expect(html).toContain("Nicholas Verruto, PE");
    expect(html).toContain("Bookman Old Style");
    expect(html).toContain("color: #1F4E79");
    expect(html).toContain("Brookhaven, NY 11719");
    expect(html).toContain('href="mailto:nick@li-precast.com"');
  });

  it("escapes HTML in the message and signature", () => {
    const style = buildQuoteEmailStyle({
      ...styleSettings,
      quoteEmailSignatureName: "Nick <PE>",
    });
    const html = buildQuoteEmailHtml("1 < 2 & 3", style);
    expect(html).toContain("1 &lt; 2 &amp; 3");
    expect(html).toContain("Nick &lt;PE&gt;");
    expect(html).not.toContain("<PE>");
  });

  it("unknown font falls back to Arial", () => {
    const style = buildQuoteEmailStyle({
      ...nullStyleSettings,
      quoteEmailFontFamily: "Comic Sans MS",
    });
    expect(style.fontStack).toContain("Arial");
  });

  it("builds the plain-text signature for the text part", () => {
    const style = buildQuoteEmailStyle(styleSettings);
    expect(buildSignatureText(style.signature)).toBe(
      [
        "Nicholas Verruto, PE",
        "Long Island Precast Inc.",
        "20 Stiriz Rd.",
        "Brookhaven, NY 11719",
        "Ph(631)286-0240 Fax(631)286-6313",
        "Email – nick@li-precast.com",
      ].join("\n"),
    );
    expect(buildSignatureText(null)).toBe("");
  });
});
