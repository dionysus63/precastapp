"use client";

import { useEffect, useState, useTransition } from "react";
import { reloadAfterAction } from "@/lib/reload-after-action";
import {
  createSheetPdfSetAction,
  deleteSheetPdfSetAction,
  deleteSheetPdfSetFileAction,
  renameSheetPdfSetAction,
  uploadSheetPdfSetFileAction,
} from "@/app/structures/sheet-pdfs/actions";
import { SectionCard } from "@/components/dashboard/section-card";
import { structureInputClassName } from "@/components/structures/structure-utils";

export type SheetPdfSetShape = "CIRCULAR" | "RECTANGULAR";

export type SheetPdfSetSlotView = {
  hasTopSlab: boolean;
  hasBaseSlab: boolean;
  label: string;
  file: {
    id: string;
    originalName: string;
    uploadedAt: string;
  } | null;
};

export type SheetPdfSetView = {
  id: string;
  name: string;
  shape: SheetPdfSetShape;
  usedByTemplates: string[];
  slots: SheetPdfSetSlotView[];
};

type SlotCoverageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      matched: number;
      /** Field names present in the PDF but not in the convention. */
      unmatched: string[];
      /** Convention field names this variant expects but the PDF lacks. */
      missing: string[];
    };

/** Coverage is fetched lazily — computing it during the page render parses
 * every uploaded PDF and made the page take ~25s to open. */
function SlotCoverage({ fileId }: { fileId: string }) {
  const [state, setState] = useState<SlotCoverageState>({ status: "loading" });

  // Back to "loading" the render fileId changes (the effect refetches below).
  const [prevFileId, setPrevFileId] = useState(fileId);
  if (fileId !== prevFileId) {
    setPrevFileId(fileId);
    setState({ status: "loading" });
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/rect-pdf-set-files/${fileId}/coverage`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await response.text());
        }
        return response.json() as Promise<{
          matched: number;
          unmatched: string[];
          missing: string[];
        }>;
      })
      .then((data) => {
        if (!cancelled) {
          setState({ status: "ready", ...data });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Could not read the uploaded PDF.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  if (state.status === "loading") {
    return <p className="text-slate-400">Checking fields…</p>;
  }
  if (state.status === "error") {
    return <p className="text-rose-700">{state.message}</p>;
  }
  return (
    <>
      <p>
        <span className="font-medium text-green-700">
          {state.matched} matched
        </span>
        {" · "}
        <span
          className={
            state.missing.length > 0
              ? "font-medium text-amber-700"
              : "font-medium text-slate-500"
          }
        >
          {state.missing.length} missing
        </span>
        {" · "}
        <span className="font-medium text-slate-500">
          {state.unmatched.length} unmatched in PDF
        </span>
      </p>
      {state.missing.length > 0 ? (
        <p className="text-amber-700">Missing: {state.missing.join(", ")}</p>
      ) : null}
      {state.unmatched.length > 0 ? (
        <p className="text-slate-500">
          Unmatched PDF fields: {state.unmatched.join(", ")}
        </p>
      ) : null}
    </>
  );
}

type SheetPdfSetManagerProps = {
  sets: SheetPdfSetView[];
  /** Convention field names per shape (for the "expected fields" toggle). */
  expectedFieldNames: Record<SheetPdfSetShape, string[]>;
};

const SHAPE_LABELS: Record<SheetPdfSetShape, string> = {
  CIRCULAR: "Circular",
  RECTANGULAR: "Rectangular",
};

export function SheetPdfSetManager({
  sets,
  expectedFieldNames,
}: SheetPdfSetManagerProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [newName, setNewName] = useState("");
  const [newShape, setNewShape] = useState<SheetPdfSetShape>("RECTANGULAR");

  function run(action: () => Promise<unknown>, success: string) {
    setMessage({});
    startTransition(async () => {
      try {
        await action();
        setMessage({ success });
        reloadAfterAction();
      } catch (error) {
        setMessage({
          error: error instanceof Error ? error.message : "Action failed.",
        });
      }
    });
  }

  const circularSets = sets.filter((set) => set.shape === "CIRCULAR");
  const rectSets = sets.filter((set) => set.shape !== "CIRCULAR");

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
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Shape
            </label>
            <select
              value={newShape}
              onChange={(e) => setNewShape(e.target.value as SheetPdfSetShape)}
              className={structureInputClassName}
            >
              <option value="RECTANGULAR">Rectangular (4 slab variants)</option>
              <option value="CIRCULAR">Circular (one sheet)</option>
            </select>
          </div>
          <button
            type="button"
            disabled={pending || !newName.trim()}
            onClick={() =>
              run(async () => {
                await createSheetPdfSetAction(newName, newShape);
                setNewName("");
              }, "PDF set created.")
            }
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Create Set
          </button>
        </div>
      </SectionCard>

      {(
        [
          ["CIRCULAR", circularSets],
          ["RECTANGULAR", rectSets],
        ] as const
      ).map(([shape, group]) => (
        <div key={shape} className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {SHAPE_LABELS[shape]} Sets ({group.length})
          </h3>
          {group.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500">
              No {SHAPE_LABELS[shape].toLowerCase()} sets yet.
            </p>
          ) : (
            group.map((set) => (
              <SheetPdfSetCard
                key={set.id}
                set={set}
                pending={pending}
                run={run}
                expectedFields={expectedFieldNames[set.shape]}
              />
            ))
          )}
        </div>
      ))}
    </div>
  );
}

function SheetPdfSetCard({
  set,
  pending,
  run,
  expectedFields,
}: {
  set: SheetPdfSetView;
  pending: boolean;
  run: (action: () => Promise<unknown>, success: string) => void;
  expectedFields: string[];
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
              run(() => deleteSheetPdfSetAction(set.id), "PDF set deleted.");
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
            run(() => renameSheetPdfSetAction(set.id, name), "PDF set renamed.")
          }
          className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Save Name
        </button>
      </div>

      <div
        className={
          set.slots.length > 1 ? "grid gap-3 lg:grid-cols-2" : "grid gap-3"
        }
      >
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
                  <div className="mt-0.5 text-[11px] text-slate-600">
                    <p>
                      {slot.file.originalName} · {slot.file.uploadedAt}
                    </p>
                    <SlotCoverage fileId={slot.file.id} />
                  </div>
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
                      () => deleteSheetPdfSetFileAction(slot.file!.id),
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
                  () => uploadSheetPdfSetFileAction(formData),
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
        {expectedFields.length})
      </button>
      {showFields ? (
        <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-50 p-2 text-[10px] text-slate-600">
          {expectedFields.join("\n")}
        </pre>
      ) : null}
    </SectionCard>
  );
}
