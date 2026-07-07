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

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const src = useMemo(() => {
    if (objectUrl) {
      return objectUrl;
    }
    if (purchaseOrderId) {
      return `/api/purchase-orders/${purchaseOrderId}/vendor-quote`;
    }
    return null;
  }, [objectUrl, purchaseOrderId]);

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
