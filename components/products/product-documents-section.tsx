"use client";

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
  documents: ProductDocumentRow[];
};

export function ProductDocumentsSection({
  documents,
}: ProductDocumentsSectionProps) {
  return (
    <SectionCard
      title="Product Documents"
      description="Upload submittals, shop drawings, and other product files. Upload is not connected yet."
    >
      <div className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
          <div
            aria-disabled="true"
            className="flex min-h-32 flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center"
          >
            <p className="text-sm font-medium text-slate-700">
              Drag and drop files here
            </p>
            <p className="mt-1 text-xs text-slate-500">
              or click to browse — upload coming soon
            </p>
          </div>

          <div>
            <label
              htmlFor="documentType"
              className="block text-xs font-medium text-slate-700"
            >
              Document Type
            </label>
            <select
              id="documentType"
              name="documentType"
              disabled
              defaultValue="GENERIC_SUBMITTAL"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500"
            >
              {documentTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

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
                    No documents uploaded yet.
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
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled
                          className="inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-400"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          disabled
                          className="inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-400"
                        >
                          Download
                        </button>
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
