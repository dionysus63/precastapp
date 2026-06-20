"use client";

import { useRef, useState, useTransition } from "react";
import {
  deleteProductDocumentAction,
  openProductDocument,
  openProductSubmittalsFolder,
  scanProductDocumentsAction,
  uploadProductDocumentAction,
} from "@/app/products/actions";
import { SectionCard } from "@/components/dashboard/section-card";

const documentTypeOptions = [
  { value: "GENERIC_SUBMITTAL", label: "Generic Submittal" },
  { value: "SHOP_DRAWING", label: "Shop Drawing" },
  { value: "CUT_SHEET_TEMPLATE", label: "Cut Sheet Template" },
  { value: "SPEC_SHEET", label: "Spec Sheet" },
  { value: "INSTALLATION_INSTRUCTIONS", label: "Installation Instructions" },
  { value: "OTHER", label: "Other" },
];

type ProductDocumentRow = {
  id: string;
  documentName: string;
  documentTypeLabel: string;
  uploadedDate: string;
  fileSize: string;
};

type ProductDocumentsSectionProps = {
  productId: string;
  productCode: string;
  documents: ProductDocumentRow[];
};

export function ProductDocumentsSection({
  productId,
  productCode,
  documents,
}: ProductDocumentsSectionProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error?: string; success?: string }>(
    {},
  );
  const [rowMessages, setRowMessages] = useState<
    Record<string, { error?: string; success?: string }>
  >({});

  function handleUpload(formData: FormData) {
    setMessage({});
    startTransition(async () => {
      try {
        await uploadProductDocumentAction(formData);
        formRef.current?.reset();
        setMessage({ success: "Document uploaded." });
      } catch (error) {
        setMessage({
          error:
            error instanceof Error ? error.message : "Could not upload document.",
        });
      }
    });
  }

  function handleScan() {
    setMessage({});
    startTransition(async () => {
      try {
        const result = await scanProductDocumentsAction(productId);
        setMessage({
          success: `Scan complete: ${result.added} added, ${result.removed} removed.`,
        });
      } catch (error) {
        setMessage({
          error:
            error instanceof Error ? error.message : "Could not scan folder.",
        });
      }
    });
  }

  function handleOpenFolder() {
    setMessage({});
    startTransition(async () => {
      try {
        const result = await openProductSubmittalsFolder(productId);
        setMessage({ success: `Opened in Explorer: ${result.path}` });
      } catch (error) {
        setMessage({
          error:
            error instanceof Error ? error.message : "Could not open folder.",
        });
      }
    });
  }

  function handleOpenDocument(documentId: string) {
    setRowMessages((current) => ({ ...current, [documentId]: {} }));
    startTransition(async () => {
      try {
        const result = await openProductDocument(documentId);
        setRowMessages((current) => ({
          ...current,
          [documentId]: { success: `Opened: ${result.documentName}` },
        }));
      } catch (error) {
        setRowMessages((current) => ({
          ...current,
          [documentId]: {
            error:
              error instanceof Error ? error.message : "Could not open file.",
          },
        }));
      }
    });
  }

  function handleDelete(documentId: string) {
    if (!window.confirm("Delete this document from disk and the catalog?")) {
      return;
    }

    setMessage({});
    startTransition(async () => {
      try {
        await deleteProductDocumentAction(documentId);
        setMessage({ success: "Document deleted." });
      } catch (error) {
        setMessage({
          error:
            error instanceof Error ? error.message : "Could not delete document.",
        });
      }
    });
  }

  return (
    <SectionCard
      title="Product Documents"
      description={`Submittals and related files for ${productCode}. Stored under the stock submittals root.`}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={handleScan}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Scan folder
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={handleOpenFolder}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Open folder in Explorer
          </button>
        </div>

        <form
          ref={formRef}
          action={handleUpload}
          className="grid gap-4 lg:grid-cols-[1fr_220px_auto]"
        >
          <input type="hidden" name="productId" value={productId} />
          <div>
            <label
              htmlFor="documentFile"
              className="block text-xs font-medium text-slate-700"
            >
              Upload file
            </label>
            <input
              id="documentFile"
              name="file"
              type="file"
              required
              disabled={pending}
              className="mt-1 block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700"
            />
          </div>

          <div>
            <label
              htmlFor="documentType"
              className="block text-xs font-medium text-slate-700"
            >
              Document type
            </label>
            <select
              id="documentType"
              name="documentType"
              disabled={pending}
              defaultValue="GENERIC_SUBMITTAL"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900"
            >
              {documentTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {pending ? "Uploading…" : "Upload"}
            </button>
          </div>
        </form>

        {message.error ? (
          <p className="text-xs text-red-600">{message.error}</p>
        ) : null}
        {message.success ? (
          <p className="text-xs text-green-700">{message.success}</p>
        ) : null}

        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Document Name</th>
                <th className="px-4 py-2.5 font-semibold">Document Type</th>
                <th className="px-4 py-2.5 font-semibold">Uploaded Date</th>
                <th className="px-4 py-2.5 font-semibold">File Size</th>
                <th className="px-4 py-2.5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    No documents yet. Upload a file or scan the product folder.
                  </td>
                </tr>
              ) : (
                documents.map((document) => (
                  <tr key={document.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {document.documentName}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {document.documentTypeLabel}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {document.uploadedDate}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {document.fileSize}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => handleOpenDocument(document.id)}
                            className="inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => handleDelete(document.id)}
                            className="inline-flex rounded-md border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                        {rowMessages[document.id]?.error ? (
                          <span className="text-[10px] text-red-600">
                            {rowMessages[document.id]?.error}
                          </span>
                        ) : null}
                        {rowMessages[document.id]?.success ? (
                          <span className="text-[10px] text-green-700">
                            {rowMessages[document.id]?.success}
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </SectionCard>
  );
}
