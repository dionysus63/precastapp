"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteStructureTemplatePdfAction,
  uploadStructureTemplatePdfAction,
} from "@/app/structures/actions";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  DRILL_SHEET_TEMPLATE_FIELD_NAMES,
  type TemplatePdfFieldCoverage,
} from "@/lib/drill-sheet-template-pdf";

type TemplatePdfSlot = {
  hasRiser: boolean;
  hasKey: boolean;
  label: string;
  pdf: {
    id: string;
    originalName: string;
    fileSize: number | null;
    uploadedAt: string;
    coverage: TemplatePdfFieldCoverage | null;
    loadError: string | null;
  } | null;
};

type StructureTemplatePdfsSectionProps = {
  templateId: string;
  slots: TemplatePdfSlot[];
};

function formatFileSize(bytes: number | null): string {
  if (bytes == null || bytes <= 0) {
    return "—";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function CoverageSummary({ coverage }: { coverage: TemplatePdfFieldCoverage }) {
  return (
    <div className="mt-2 space-y-1 text-[11px] text-slate-600">
      <p>
        <span className="font-medium text-green-700">
          {coverage.matched.length} matched
        </span>
        {" · "}
        <span className="font-medium text-amber-700">
          {coverage.unmatched.length} unmatched in PDF
        </span>
        {" · "}
        <span className="font-medium text-slate-500">
          {coverage.missingFromPdf.length} convention fields missing
        </span>
      </p>
      {coverage.unmatched.length > 0 ? (
        <p className="text-amber-700">
          Unmatched PDF fields: {coverage.unmatched.join(", ")}
        </p>
      ) : null}
    </div>
  );
}

function TemplatePdfSlotCard({
  templateId,
  slot,
  pending,
  onUpload,
  onDelete,
}: {
  templateId: string;
  slot: TemplatePdfSlot;
  pending: boolean;
  onUpload: (formData: FormData) => void;
  onDelete: (id: string) => void;
}) {
  const [showFields, setShowFields] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{slot.label}</h3>
          {slot.pdf ? (
            <p className="mt-1 text-xs text-slate-600">
              {slot.pdf.originalName} · {formatFileSize(slot.pdf.fileSize)} ·{" "}
              {slot.pdf.uploadedAt}
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">No PDF uploaded.</p>
          )}
        </div>
        {slot.pdf ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => onDelete(slot.pdf!.id)}
            className="rounded-md border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        ) : null}
      </div>

      {slot.pdf?.loadError ? (
        <p className="mt-2 text-[11px] text-red-700">
          Could not read this PDF from disk: {slot.pdf.loadError}. Re-upload the
          file to restore field coverage.
        </p>
      ) : null}

      {slot.pdf?.coverage ? <CoverageSummary coverage={slot.pdf.coverage} /> : null}

      <form action={onUpload} className="mt-3 flex flex-wrap items-end gap-3">
        <input type="hidden" name="templateId" value={templateId} />
        <input
          type="hidden"
          name="hasRiser"
          value={slot.hasRiser ? "true" : "false"}
        />
        <input type="hidden" name="hasKey" value={slot.hasKey ? "true" : "false"} />
        <div className="min-w-[220px] flex-1">
          <label className="block text-[11px] font-medium text-slate-700">
            {slot.pdf ? "Replace PDF" : "Upload PDF"}
          </label>
          <input
            name="file"
            type="file"
            accept=".pdf,application/pdf"
            required={!slot.pdf}
            disabled={pending}
            className="mt-1 block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : slot.pdf ? "Replace" : "Upload"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setShowFields((current) => !current)}
        className="mt-3 text-[11px] font-medium text-slate-500 hover:text-slate-800"
      >
        {showFields ? "Hide" : "Show"} expected field names (
        {DRILL_SHEET_TEMPLATE_FIELD_NAMES.length})
      </button>
      {showFields ? (
        <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-50 p-2 text-[10px] text-slate-600">
          {DRILL_SHEET_TEMPLATE_FIELD_NAMES.join("\n")}
        </pre>
      ) : null}
    </div>
  );
}

export function StructureTemplatePdfsSection({
  templateId,
  slots,
}: StructureTemplatePdfsSectionProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error?: string; success?: string }>(
    {},
  );

  function handleUpload(formData: FormData) {
    setMessage({});
    startTransition(async () => {
      try {
        await uploadStructureTemplatePdfAction(formData);
        setMessage({ success: "PDF uploaded." });
        router.refresh();
      } catch (error) {
        setMessage({
          error:
            error instanceof Error ? error.message : "Could not upload PDF.",
        });
      }
    });
  }

  function handleDelete(id: string) {
    if (!window.confirm("Delete this template PDF from disk?")) {
      return;
    }

    setMessage({});
    startTransition(async () => {
      try {
        await deleteStructureTemplatePdfAction(id);
        setMessage({ success: "PDF deleted." });
        router.refresh();
      } catch (error) {
        setMessage({
          error:
            error instanceof Error ? error.message : "Could not delete PDF.",
        });
      }
    });
  }

  return (
    <SectionCard
      title="Drill Sheet PDFs"
      description="Upload fillable PDF templates for each riser/key variant. AcroForm field names must match the naming convention below."
    >
      <div className="space-y-4">
        {message.error ? (
          <p className="text-xs text-red-600">{message.error}</p>
        ) : null}
        {message.success ? (
          <p className="text-xs text-green-700">{message.success}</p>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {slots.map((slot) => (
            <TemplatePdfSlotCard
              key={`${slot.hasRiser}-${slot.hasKey}`}
              templateId={templateId}
              slot={slot}
              pending={pending}
              onUpload={handleUpload}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>
    </SectionCard>
  );
}
