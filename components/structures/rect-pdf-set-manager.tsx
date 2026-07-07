"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createRectPdfSetAction,
  deleteRectPdfSetAction,
  deleteRectPdfSetFileAction,
  renameRectPdfSetAction,
  uploadRectPdfSetFileAction,
} from "@/app/structures/rect-pdf-sets/actions";
import { SectionCard } from "@/components/dashboard/section-card";
import { structureInputClassName } from "@/components/structures/structure-utils";
import { RECT_SHEET_TEMPLATE_FIELD_NAMES } from "@/lib/rect-template-pdf-fields";

export type RectPdfSetSlotView = {
  hasTopSlab: boolean;
  hasBaseSlab: boolean;
  label: string;
  file: {
    id: string;
    originalName: string;
    uploadedAt: string;
    matched: number;
    missing: number;
    loadError: string | null;
  } | null;
};

export type RectPdfSetView = {
  id: string;
  name: string;
  usedByTemplates: string[];
  slots: RectPdfSetSlotView[];
};

type RectPdfSetManagerProps = {
  sets: RectPdfSetView[];
};

export function RectPdfSetManager({ sets }: RectPdfSetManagerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [newName, setNewName] = useState("");

  function run(action: () => Promise<unknown>, success: string) {
    setMessage({});
    startTransition(async () => {
      try {
        await action();
        setMessage({ success });
        router.refresh();
      } catch (error) {
        setMessage({
          error: error instanceof Error ? error.message : "Action failed.",
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      {message.error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          {message.error}
        </p>
      ) : null}
      {message.success ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-700">
          {message.success}
        </p>
      ) : null}

      <SectionCard title="New PDF Set">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px]">
            <label className="block text-xs font-medium text-slate-700">
              Set Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Catch Basin Standard"
              className={structureInputClassName}
            />
          </div>
          <button
            type="button"
            disabled={pending || !newName.trim()}
            onClick={() =>
              run(async () => {
                await createRectPdfSetAction(newName);
                setNewName("");
              }, "PDF set created.")
            }
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Create Set
          </button>
        </div>
      </SectionCard>

      {sets.map((set) => (
        <RectPdfSetCard key={set.id} set={set} pending={pending} run={run} />
      ))}
    </div>
  );
}

function RectPdfSetCard({
  set,
  pending,
  run,
}: {
  set: RectPdfSetView;
  pending: boolean;
  run: (action: () => Promise<unknown>, success: string) => void;
}) {
  const [name, setName] = useState(set.name);
  const [showFields, setShowFields] = useState(false);

  return (
    <SectionCard
      title={set.name}
      description={
        set.usedByTemplates.length > 0
          ? `Used by: ${set.usedByTemplates.join(", ")}`
          : "Not assigned to any template yet."
      }
      action={
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm(`Delete PDF set "${set.name}" and its files?`)) {
              run(() => deleteRectPdfSetAction(set.id), "PDF set deleted.");
            }
          }}
          className="rounded-md border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Delete Set
        </button>
      }
    >
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-[220px]">
          <label className="block text-[11px] font-medium text-slate-700">
            Rename
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={structureInputClassName}
          />
        </div>
        <button
          type="button"
          disabled={pending || name.trim() === set.name || !name.trim()}
          onClick={() =>
            run(() => renameRectPdfSetAction(set.id, name), "PDF set renamed.")
          }
          className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Save Name
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {set.slots.map((slot) => (
          <div
            key={`${slot.hasTopSlab}-${slot.hasBaseSlab}`}
            className="rounded-lg border border-slate-200 bg-white p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h4 className="text-xs font-semibold text-slate-900">
                  {slot.label}
                </h4>
                {slot.file ? (
                  <p className="mt-0.5 text-[11px] text-slate-600">
                    {slot.file.originalName} · {slot.file.uploadedAt}
                    {slot.file.loadError ? (
                      <span className="block text-rose-700">
                        {slot.file.loadError}
                      </span>
                    ) : (
                      <span className="block text-slate-500">
                        {slot.file.matched} fields matched
                        {slot.file.missing > 0
                          ? ` · ${slot.file.missing} convention fields missing`
                          : ""}
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    No PDF uploaded.
                  </p>
                )}
              </div>
              {slot.file ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => deleteRectPdfSetFileAction(slot.file!.id),
                      "PDF deleted.",
                    )
                  }
                  className="rounded-md border border-red-200 px-2 py-0.5 text-[11px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Delete
                </button>
              ) : null}
            </div>

            <form
              action={(formData) =>
                run(
                  () => uploadRectPdfSetFileAction(formData),
                  "PDF uploaded.",
                )
              }
              className="mt-2 flex flex-wrap items-center gap-2"
            >
              <input type="hidden" name="setId" value={set.id} />
              <input
                type="hidden"
                name="hasTopSlab"
                value={slot.hasTopSlab ? "true" : "false"}
              />
              <input
                type="hidden"
                name="hasBaseSlab"
                value={slot.hasBaseSlab ? "true" : "false"}
              />
              <input
                name="file"
                type="file"
                accept=".pdf,application/pdf"
                required
                disabled={pending}
                className="flex-1 text-[11px] text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-[11px] file:font-medium file:text-slate-700"
              />
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {slot.file ? "Replace" : "Upload"}
              </button>
            </form>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowFields((current) => !current)}
        className="mt-3 text-[11px] font-medium text-slate-500 hover:text-slate-800"
      >
        {showFields ? "Hide" : "Show"} expected field names (
        {RECT_SHEET_TEMPLATE_FIELD_NAMES.length})
      </button>
      {showFields ? (
        <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-50 p-2 text-[10px] text-slate-600">
          {RECT_SHEET_TEMPLATE_FIELD_NAMES.join("\n")}
        </pre>
      ) : null}
    </SectionCard>
  );
}
