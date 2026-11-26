"use client";

import { useState } from "react";
import { LivePdfPreview } from "@/components/common/live-pdf-preview";
import { PdfDragChip } from "@/components/common/pdf-drag-chip";
import { Tab, TabBar } from "@/components/ui/tabs";
import type { ActionError } from "@/lib/action-result";
import { printPdfUrl } from "@/lib/print-pdf-url";

type PurchaseOrderDocumentsProps = {
  purchaseOrderId: string;
  poNumber: string;
  /** What the purchase order PDF is called when it leaves the app. */
  pdfFileName: string;
  /** The vendor's quote filed with the order, or null when there is none. */
  vendorQuoteName: string | null;
};

type DocumentView = "purchaseOrder" | "vendorQuote";

const paneButtonClassName = "rounded btn-plain px-2 py-0.5 text-2xs font-semibold";

/** Reads a PDF the app serves, for the pane to draw. Module level: stable. */
async function loadPdf(url: string): Promise<{ pdfBytes: Uint8Array } | ActionError> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { error: "Could not load the PDF." };
    }
    return { pdfBytes: new Uint8Array(await response.arrayBuffer()) };
  } catch {
    return { error: "Could not load the PDF." };
  }
}

/**
 * The pane on a saved purchase order's page: the purchase order as it prints
 * and, when a vendor quote is filed with it, that quote on a second tab. The
 * same pane as beside the editor, with Print and a handle to drag each PDF
 * into an email or a folder.
 */
export function PurchaseOrderDocuments({
  purchaseOrderId,
  poNumber,
  pdfFileName,
  vendorQuoteName,
}: PurchaseOrderDocumentsProps) {
  const [view, setView] = useState<DocumentView>("purchaseOrder");
  const pdfUrl = `/api/purchase-orders/${purchaseOrderId}/pdf`;
  const quoteUrl = `/api/purchase-orders/${purchaseOrderId}/vendor-quote`;
  const hasQuote = vendorQuoteName != null;
  const shownView = hasQuote ? view : "purchaseOrder";

  function paneActions(url: string, fileName: string, what: string) {
    return (
      <>
        <button
          type="button"
          onClick={() => printPdfUrl(url)}
          className={paneButtonClassName}
        >
          Print
        </button>
        <PdfDragChip
          href={`${url}?download=1`}
          fileName={fileName}
          title={`${what}: drag it into an email or a folder, or click to save it`}
          label="Drag PDF"
          className={paneButtonClassName}
        />
      </>
    );
  }

  return (
    <div className="space-y-2">
      {hasQuote ? (
        <TabBar label="Which PDF to show">
          <Tab
            active={shownView === "purchaseOrder"}
            onClick={() => setView("purchaseOrder")}
          >
            Purchase order
          </Tab>
          <Tab
            active={shownView === "vendorQuote"}
            onClick={() => setView("vendorQuote")}
          >
            Vendor quote
          </Tab>
        </TabBar>
      ) : null}
      {/* Both stay on the page, so switching tabs is instant and each keeps
          its page and zoom (both open at the zoom the user's account keeps). */}
      <div className={shownView === "purchaseOrder" ? "" : "hidden"}>
        <LivePdfPreview
          title="Purchase order"
          subject={poNumber}
          requestKey={pdfUrl}
          load={loadPdf}
          live={false}
          emptyNote=""
          loadingNote="Drawing the purchase order…"
          zoomScreen="purchase-orders"
          actions={paneActions(pdfUrl, pdfFileName, `Purchase order ${poNumber}`)}
        />
      </div>
      {hasQuote ? (
        <div className={shownView === "vendorQuote" ? "" : "hidden"}>
          <LivePdfPreview
            title="Vendor quote"
            subject={vendorQuoteName}
            requestKey={quoteUrl}
            load={loadPdf}
            live={false}
            emptyNote=""
            loadingNote="Opening the vendor quote…"
            zoomScreen="purchase-orders"
            actions={paneActions(
              quoteUrl,
              vendorQuoteName,
              `The vendor's quote for ${poNumber}`,
            )}
          />
        </div>
      ) : null}
    </div>
  );
}
