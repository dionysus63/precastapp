"use client";

import { useEffect, useMemo, useState } from "react";

type VendorQuotePreviewProps = {
  file?: File | null;
  purchaseOrderId?: string;
  fileName?: string | null;
};

export function VendorQuotePreview({
  file,
  purchaseOrderId,
  fileName,
}: VendorQuotePreviewProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  // Object URLs are an external resource: creation and revocation have to be
  // paired in an effect, and the resulting URL cannot be derived during
  // render, so storing it from the effect is the correct shape here.
  useEffect(() => {
    if (!file) {
      return;
    }
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above the effect
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const src = useMemo(() => {
    // Ignore objectUrl once the file is gone; the effect above only revokes
    // it, the stale string stays in state harmlessly.
    if (file && objectUrl) {
      return objectUrl;
    }
    if (purchaseOrderId) {
      return `/api/purchase-orders/${purchaseOrderId}/vendor-quote`;
    }
    return null;
  }, [file, objectUrl, purchaseOrderId]);

  if (!src) {
    return (
      <div className="flex min-h-[480px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
        Drop a vendor quote PDF to preview it here.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-2 text-xs text-slate-600">
        {file?.name ?? fileName ?? "Vendor quote"}
      </div>
      <iframe
        title={file?.name ?? fileName ?? "Vendor quote preview"}
        src={src}
        className="h-[640px] w-full bg-white"
      />
    </div>
  );
}
