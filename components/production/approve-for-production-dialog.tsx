"use client";

import { useState, useTransition } from "react";
import { approveStructureForProduction } from "@/app/operations/actions";
import { FileUploadDropzone } from "@/components/files/file-upload-dropzone";

export type ApproveForProductionTarget = {
  id: string;
  structureNumber: string | null;
  description: string | null;
  needsSubmittal: boolean;
};

type ApproveForProductionDialogProps = {
  target: ApproveForProductionTarget;
  onClose: () => void;
  onSuccess?: () => void;
};

export function ApproveForProductionDialog({
  target,
  onClose,
  onSuccess,
}: ApproveForProductionDialogProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [useGeneratedSubmittal, setUseGeneratedSubmittal] = useState(false);

  const label = target.structureNumber ?? "Structure";
  const canConfirm =
    useGeneratedSubmittal || files.length > 0;

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("jobStructureId", target.id);
      formData.set(
        "useGeneratedSubmittal",
        useGeneratedSubmittal ? "true" : "false",
      );
      if (!useGeneratedSubmittal && files[0]) {
        formData.set("approvalFile", files[0]);
      }

      const result = await approveStructureForProduction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }

      onSuccess?.();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="approve-for-production-title"
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <h3
          id="approve-for-production-title"
          className="text-sm font-semibold text-slate-900"
        >
          Approve for production
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          {label}
          {target.description ? ` — ${target.description}` : ""}
        </p>

        <div className="mt-4 space-y-4">
          <FileUploadDropzone
            files={files}
            onFilesChange={setFiles}
            disabled={pending || useGeneratedSubmittal}
            multiple={false}
            accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff"
            label="Drag and drop the signed approval"
            description="PDF or image of the returned, signed submittal approval."
            inputId="approval-file-upload"
          />

          <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={useGeneratedSubmittal}
              disabled={pending}
              onChange={(event) => {
                setUseGeneratedSubmittal(event.target.checked);
                if (event.target.checked) {
                  setFiles([]);
                }
              }}
              className="mt-0.5 rounded border-slate-300"
            />
            <span>
              <span className="font-medium text-slate-900">
                Use generated submittal (verbal OK)
              </span>
              <span className="mt-0.5 block text-slate-500">
                {target.needsSubmittal
                  ? "No signed return on file — use the job-specific submittal already uploaded, or a verbal approval."
                  : "No signed approval document — verbal or email approval is sufficient."}
              </span>
            </span>
          </label>
        </div>

        {error ? (
          <p className="mt-3 text-xs font-medium text-red-600">{error}</p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending || !canConfirm}
            onClick={handleConfirm}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {pending ? "Approving…" : "Approve for production"}
          </button>
        </div>
      </div>
    </div>
  );
}
