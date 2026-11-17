"use client";

import { useCallback, useState } from "react";
import { renderPurchaseOrderDraftPreview } from "@/app/purchase-orders/preview-actions";
import {
  LivePdfPreview,
  previewBesideOnlyClassName,
  previewDrawerOnlyClassName,
} from "@/components/common/live-pdf-preview";
import { Tab, TabBar } from "@/components/ui/tabs";
import { isActionError, type ActionError } from "@/lib/action-result";
import type { PurchaseOrderDraftPreviewInput } from "@/lib/purchase-order-draft-preview";

export type PurchaseOrderPreviewView = "purchaseOrder" | "vendorQuote";

type PurchaseOrderLivePreviewProps = {
  /** What is on the editor screen, as far as it prints. */
  input: PurchaseOrderDraftPreviewInput;
  /** The vendor's quote picked on this screen and not saved yet. */
  quoteFile: File | null;
  /** The name of the quote already saved with the purchase order. */
  savedQuoteName: string | null;
  view: PurchaseOrderPreviewView;
  onViewChange: (view: PurchaseOrderPreviewView) => void;
  onHide: () => void;
};

/**
 * The pane beside the purchase order editor: the purchase order PDF as it
 * will print, redrawn as the inputs change, and, once a vendor quote is
 * attached, that quote on a second tab to type the lines from.
 */
export function PurchaseOrderLivePreview({
  input,
  quoteFile,
  savedQuoteName,
  view,
  onViewChange,
  onHide,
}: PurchaseOrderLivePreviewProps) {
  // The number comes back with each fill: a new purchase order has none
  // until it is saved, so the server says which one it would get.
  const [poNumber, setPoNumber] = useState<string | null>(null);
  const load = useCallback(async (requestKey: string) => {
    const result = await renderPurchaseOrderDraftPreview(JSON.parse(requestKey));
    if (!isActionError(result)) {
      setPoNumber(result.poNumber || null);
    }
    return result;
  }, []);

  // The vendor's quote in the same pane: the file just picked, or the one
  // saved with the purchase order, read once per file.
  const savedQuoteId = quoteFile ? null : input.purchaseOrderId;
  const loadQuote = useCallback(async (): Promise<
    { pdfBytes: Uint8Array } | ActionError
  > => {
    try {
      if (quoteFile) {
        return { pdfBytes: new Uint8Array(await quoteFile.arrayBuffer()) };
      }
      const response = await fetch(`/api/purchase-orders/${savedQuoteId}/vendor-quote`);
      if (!response.ok) {
        return { error: "Could not load the vendor quote." };
      }
      return { pdfBytes: new Uint8Array(await response.arrayBuffer()) };
    } catch {
      return { error: "Could not load the vendor quote." };
    }
  }, [quoteFile, savedQuoteId]);
  const quoteKey = quoteFile
    ? `file:${quoteFile.name}:${quoteFile.size}:${quoteFile.lastModified}`
    : savedQuoteId && savedQuoteName
      ? `saved:${savedQuoteId}`
      : null;

  const hasQuote = quoteKey != null;
  const shownView = hasQuote ? view : "purchaseOrder";
  // Nothing useful prints until the order has a vendor.
  const requestKey = input.vendorId ? JSON.stringify(input) : null;

  const hideButton = (
    <button
      type="button"
      onClick={onHide}
      className="rounded btn-plain px-2 py-0.5 text-2xs font-semibold"
    >
      {/* Beside the inputs it is put away for good (remembered on this
          computer); opened over them on a narrow window it just closes. */}
      <span
        className={previewBesideOnlyClassName}
        title="Hide the preview and give the inputs the whole width"
      >
        Hide preview
      </span>
      <span className={previewDrawerOnlyClassName}>Close preview</span>
    </button>
  );

  return (
    <div className="space-y-2">
      {hasQuote ? (
        <TabBar label="Preview">
          <Tab
            active={shownView === "purchaseOrder"}
            onClick={() => onViewChange("purchaseOrder")}
          >
            Purchase order
          </Tab>
          <Tab
            active={shownView === "vendorQuote"}
            onClick={() => onViewChange("vendorQuote")}
          >
            Vendor quote
          </Tab>
        </TabBar>
      ) : null}
      {/* Both stay on the page, so switching tabs is instant and each keeps
          its page and zoom. */}
      <div className={shownView === "purchaseOrder" ? "" : "hidden"}>
        <LivePdfPreview
          title="Purchase order PDF"
          subject={requestKey ? (poNumber ?? null) : null}
          requestKey={requestKey}
          load={load}
          emptyNote="Pick a vendor to see the purchase order here."
          loadingNote="Drawing the purchase order…"
          actions={hideButton}
        />
      </div>
      {hasQuote ? (
        <div className={shownView === "vendorQuote" ? "" : "hidden"}>
          <LivePdfPreview
            title="Vendor quote"
            subject={quoteFile?.name ?? savedQuoteName}
            requestKey={quoteKey}
            load={loadQuote}
            live={false}
            emptyNote="Drop a vendor quote PDF to see it here."
            loadingNote="Opening the vendor quote…"
            actions={hideButton}
          />
        </div>
      ) : null}
    </div>
  );
}
