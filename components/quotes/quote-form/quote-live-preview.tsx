"use client";

import { useMemo } from "react";
import { renderQuoteDraftPreview } from "@/app/quotes/preview-actions";
import { LivePdfPreview } from "@/components/common/live-pdf-preview";
import { buildQuoteLineItemsInput } from "@/components/quotes/quote-form/quote-form-utils";
import type { EditableQuoteLineItem } from "@/components/quotes/quote-utils";
import type { QuoteDraftPreviewInput } from "@/lib/quote-draft-preview";

/** The header fields that print on the quote, as the form holds them. */
export type QuoteLivePreviewFields = {
  customerName: string;
  projectName: string;
  jobNumber: string;
  projectAddress: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  estimator: string;
  quoteDate: string;
  expirationDate: string;
  customerNotes: string;
  termsAndConditions: string;
  fob: string;
};

type QuoteLivePreviewProps = {
  /** The quote being edited; undefined while creating a new one. */
  quoteId?: string;
  quoteNumber?: string | null;
  fields: QuoteLivePreviewFields;
  lineItems: EditableQuoteLineItem[];
  taxRatePercent: number;
  onHide: () => void;
};

function loadQuotePreview(requestKey: string) {
  return renderQuoteDraftPreview(JSON.parse(requestKey));
}

/**
 * Only what prints on the quote goes into the request, so changes that never
 * reach the paper (internal notes, weights, status, lead time) don't refill
 * the PDF. Lines go through the same mapping a save uses.
 */
function toPreviewLines(
  lineItems: EditableQuoteLineItem[],
): QuoteDraftPreviewInput["lines"] {
  return buildQuoteLineItemsInput(lineItems).map((line) => ({
    lineType: line.lineType,
    itemCode: line.itemCode,
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    taxable: line.taxable,
    isDrainRing: line.isDrainRing ?? false,
    ringDiameterFeet: line.ringDiameterFeet ?? null,
    poolHeightFeet: line.poolHeightFeet ?? null,
    drainRingStyle: line.drainRingStyle ?? "DRAIN",
  }));
}

/**
 * The quote PDF as it will print, beside the form: the same template fill a
 * saved quote gets, run on what is on screen and refilled as it changes.
 */
export function QuoteLivePreview({
  quoteId,
  quoteNumber = null,
  fields,
  lineItems,
  taxRatePercent,
  onHide,
}: QuoteLivePreviewProps) {
  // The line table keeps its array while header fields are typed in.
  const lines = useMemo(() => toPreviewLines(lineItems), [lineItems]);

  const input: QuoteDraftPreviewInput = {
    quoteId: quoteId ?? null,
    customerName: fields.customerName.trim(),
    projectName: fields.projectName.trim(),
    jobNumber: fields.jobNumber.trim() || null,
    projectAddress: fields.projectAddress.trim() || null,
    contactName: fields.contactName.trim() || null,
    contactEmail: fields.contactEmail.trim() || null,
    contactPhone: fields.contactPhone.trim() || null,
    estimator: fields.estimator || null,
    quoteDate: fields.quoteDate || null,
    expirationDate: fields.expirationDate || null,
    taxRate: taxRatePercent,
    customerNotes: fields.customerNotes.trim() || null,
    termsAndConditions: fields.termsAndConditions.trim() || null,
    fob: fields.fob.trim() || null,
    lines,
  };

  return (
    <LivePdfPreview
      title="Quote PDF"
      subject={quoteNumber ?? "New quote"}
      requestKey={JSON.stringify(input)}
      load={loadQuotePreview}
      emptyNote="The quote shows here."
      loadingNote="Filling the quote…"
      actions={
        <button
          type="button"
          onClick={onHide}
          title="Hide the quote preview and give the form the whole width"
          className="rounded btn-plain px-2 py-0.5 text-2xs font-semibold"
        >
          Hide preview
        </button>
      }
    />
  );
}
