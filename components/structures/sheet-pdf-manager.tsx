"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { unwrapAction } from "@/lib/action-result";
import { reloadAfterAction } from "@/lib/reload-after-action";
import {
  SHEET_PDF_SHAPE_LABELS,
  sheetPdfCoverageHref,
  sheetPdfDownloadHref,
  sheetPdfDownloadName,
  type SheetPdfShape,
} from "@/lib/sheet-pdf";
import {
  tableBodyClassName,
  tableCellClassName,
  tableCompactClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableHeaderCellWrapClassName,
  tableInlineInputClassName,
  tableRowClassName,
} from "@/lib/table-styles";
import {
  createSheetPdfAction,
  deleteSheetPdfAction,
  renameSheetPdfAction,
  replaceSheetPdfFileAction,
} from "@/app/structures/sheet-pdfs/actions";
import { PdfDragChip } from "@/components/common/pdf-drag-chip";
import { SectionCard } from "@/components/dashboard/section-card";
import { structureInputClassName } from "@/components/structures/structure-utils";

export type SheetPdfView = {
  id: string;
  name: string;
  shape: SheetPdfShape;
  hasTopSlab: boolean;
  hasBaseSlab: boolean;
  originalName: string;
  uploadedAt: string;
  /** Changes on every upload; keeps a replaced PDF from being served stale. */
  version: number;
  usedByTemplates: string[];
};

export type SheetPdfCoverageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      matched: number;
      /** Field names in the PDF that the app does not fill. */
      unmatched: string[];
      /** Field names the app fills that the PDF lacks. */
      missing: string[];
    };

/**
 * A Sheet PDF's field check, fetched after the page paints: computing it
 * during the page render parses every uploaded PDF and made the page take
 * ~25s to open. `version` refetches after the file is replaced.
 */
export function useSheetPdfCoverage(
  id: string | null,
  version = 0,
): SheetPdfCoverageState | null {
  const key = id ? `${id}:${version}` : null;
  const [loaded, setLoaded] = useState<{
    key: string;
    state: SheetPdfCoverageState;
  } | null>(null);

  useEffect(() => {
    if (!id || !key) {
      return;
    }
    let cancelled = false;
    fetch(`${sheetPdfCoverageHref(id)}?v=${version}`)
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
          setLoaded({ key, state: { status: "ready", ...data } });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoaded({
            key,
            state: {
              status: "error",
              message:
                error instanceof Error && error.message
                  ? error.message
                  : "Could not read the PDF.",
            },
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, key, version]);

  if (!key) {
    return null;
  }
  return loaded?.key === key ? loaded.state : { status: "loading" };
}

/** "All fields matched" / "2 fields missing", as one short line. */
export function sheetPdfCoverageSummary(
  state: Extract<SheetPdfCoverageState, { status: "ready" }>,
): { text: string; ok: boolean } {
  const missing = state.missing.length;
  return missing === 0
    ? { text: "All fields matched", ok: true }
    : { text: `${missing} field${missing === 1 ? "" : "s"} missing`, ok: false };
}

function FieldCheck({ id, version }: { id: string; version: number }) {
  const state = useSheetPdfCoverage(id, version);
  if (!state || state.status === "loading") {
    return <span className="text-slate-400">Checking…</span>;
  }
  if (state.status === "error") {
    return <span className="text-rose-700">{state.message}</span>;
  }
  const summary = sheetPdfCoverageSummary(state);
  return (
    <div className="space-y-0.5">
      <p
        className={
          summary.ok
            ? "font-semibold text-green-700"
            : "font-semibold text-amber-700"
        }
      >
        {summary.text}
      </p>
      {state.missing.length > 0 || state.unmatched.length > 0 ? (
        // Folded away: a sheet that is still being drawn can list dozens.
        <details className="text-xs">
          <summary className="cursor-pointer text-slate-500 hover:text-slate-800">
            Show field names
          </summary>
          {state.missing.length > 0 ? (
            <p className="mt-1 text-amber-700">
              Missing: {state.missing.join(", ")}
            </p>
          ) : null}
          {state.unmatched.length > 0 ? (
            <p className="mt-1 text-slate-500">
              In the PDF but not filled by the app:{" "}
              {state.unmatched.join(", ")}
            </p>
          ) : null}
        </details>
      ) : null}
    </div>
  );
}

type SheetPdfManagerProps = {
  sheetPdfs: SheetPdfView[];
  /** The field names the app fills, per kind (for the "field names" toggle). */
  expectedFieldNames: Record<SheetPdfShape, string[]>;
};

const cellClassName = `${tableCellClassName} align-middle text-sm`;
const headerClassName = `${tableHeaderCellClassName} text-xs`;
const narrowHeaderClassName = `${tableHeaderCellWrapClassName} w-16 text-xs`;
const actionButtonClassName =
  "rounded-md border px-2.5 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50";

export function SheetPdfManager({
  sheetPdfs,
  expectedFieldNames,
}: SheetPdfManagerProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error?: string; success?: string }>(
    {},
  );
  const [newShape, setNewShape] = useState<SheetPdfShape>("RECTANGULAR");
  const [shownFields, setShownFields] = useState<SheetPdfShape | null>(null);

  function run(
    action: () => Promise<unknown>,
    success: string,
    onError?: () => void,
  ) {
    setMessage({});
    startTransition(async () => {
      try {
        await unwrapAction(action());
        reloadAfterAction({ type: "success", text: success });
      } catch (error) {
        onError?.();
        setMessage({
          error: error instanceof Error ? error.message : "Action failed.",
        });
      }
    });
  }

  const isRect = newShape === "RECTANGULAR";

  return (
    <div className="space-y-4">
      {message.error ? (
        <p
          role="alert"
          className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700"
        >
          {message.error}
        </p>
      ) : null}

      <SectionCard
        title="Add Sheet PDF"
        description="Top slab and Base slab only apply to rectangular sheets."
      >
        {/* Submitted by hand so a refused add (say, a name already in use)
            keeps what was typed and the chosen file. */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            run(() => createSheetPdfAction(formData), "Sheet PDF added.");
          }}
          className="flex flex-wrap items-end gap-4"
        >
          <div className="min-w-[240px] flex-1 sm:max-w-xs">
            <label
              htmlFor="new-sheet-pdf-name"
              className="block text-xs font-medium text-slate-700"
            >
              Name
            </label>
            <input
              id="new-sheet-pdf-name"
              name="name"
              type="text"
              required
              placeholder="e.g. Rect box, top slab + base"
              className={structureInputClassName}
            />
          </div>
          <div>
            <label
              htmlFor="new-sheet-pdf-kind"
              className="block text-xs font-medium text-slate-700"
            >
              Kind
            </label>
            <select
              id="new-sheet-pdf-kind"
              name="shape"
              value={newShape}
              onChange={(event) =>
                setNewShape(event.target.value as SheetPdfShape)
              }
              className={structureInputClassName}
            >
              <option value="RECTANGULAR">Rectangular</option>
              <option value="CIRCULAR">Round</option>
            </select>
          </div>
          <label
            className={`flex items-center gap-2 pb-2 text-sm font-medium ${isRect ? "text-slate-800" : "text-slate-400"}`}
          >
            <input
              type="checkbox"
              name="hasTopSlab"
              defaultChecked
              disabled={!isRect}
              className="h-4 w-4"
            />
            Top slab
          </label>
          <label
            className={`flex items-center gap-2 pb-2 text-sm font-medium ${isRect ? "text-slate-800" : "text-slate-400"}`}
          >
            <input
              type="checkbox"
              name="hasBaseSlab"
              defaultChecked
              disabled={!isRect}
              className="h-4 w-4"
            />
            Base slab
          </label>
          <div>
            <label
              htmlFor="new-sheet-pdf-file"
              className="block text-xs font-medium text-slate-700"
            >
              PDF file
            </label>
            <input
              id="new-sheet-pdf-file"
              name="file"
              type="file"
              accept=".pdf,application/pdf"
              required
              className="mt-1 block text-xs text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Add
          </button>
        </form>
      </SectionCard>

      <SectionCard
        title="Sheet PDFs"
        description={`${sheetPdfs.length} sheet PDF${sheetPdfs.length === 1 ? "" : "s"}. Click a name to rename it. A sheet a template uses cannot be deleted until its templates pick another one.`}
        noPadding
      >
        {sheetPdfs.length === 0 ? (
          <p className="px-4 py-3 text-sm text-slate-500">
            No Sheet PDFs yet. Add the first one above.
          </p>
        ) : (
          <div className={tableFlushWrapperClassName}>
            <table className={tableCompactClassName}>
              <thead>
                <tr>
                  <th className={headerClassName}>Name</th>
                  <th className={headerClassName}>Kind</th>
                  <th className={narrowHeaderClassName}>Top slab</th>
                  <th className={narrowHeaderClassName}>Base slab</th>
                  <th className={headerClassName}>Used by</th>
                  <th className={headerClassName}>Field check</th>
                  <th className={headerClassName}>Actions</th>
                </tr>
              </thead>
              <tbody className={tableBodyClassName}>
                {sheetPdfs.map((sheetPdf) => (
                  <SheetPdfRow
                    key={sheetPdf.id}
                    sheetPdf={sheetPdf}
                    pending={pending}
                    run={run}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-3 text-xs font-medium text-slate-500">
          {(["CIRCULAR", "RECTANGULAR"] as const).map((shape) => (
            <button
              key={shape}
              type="button"
              aria-expanded={shownFields === shape}
              onClick={() =>
                setShownFields((current) => (current === shape ? null : shape))
              }
              className="hover:text-slate-800"
            >
              {shownFields === shape ? "Hide" : "Show"}{" "}
              {SHEET_PDF_SHAPE_LABELS[shape].toLowerCase()} field names (
              {expectedFieldNames[shape].length})
            </button>
          ))}
        </div>
        {shownFields ? (
          <pre className="max-h-48 overflow-auto rounded bg-slate-50 p-2 text-[11px] text-slate-600">
            {expectedFieldNames[shownFields].join("\n")}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

function SheetPdfRow({
  sheetPdf,
  pending,
  run,
}: {
  sheetPdf: SheetPdfView;
  pending: boolean;
  run: (
    action: () => Promise<unknown>,
    success: string,
    onError?: () => void,
  ) => void;
}) {
  const [name, setName] = useState(sheetPdf.name);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inUse = sheetPdf.usedByTemplates.length > 0;
  const isRect = sheetPdf.shape === "RECTANGULAR";

  function commitName() {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(sheetPdf.name);
      return;
    }
    if (trimmed === sheetPdf.name) {
      return;
    }
    run(
      () => renameSheetPdfAction(sheetPdf.id, trimmed),
      "Sheet PDF renamed.",
      () => setName(sheetPdf.name),
    );
  }

  return (
    <tr className={tableRowClassName}>
      <td className={cellClassName}>
        <input
          type="text"
          value={name}
          aria-label={`Name of ${sheetPdf.name}`}
          disabled={pending}
          onChange={(event) => setName(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              setName(sheetPdf.name);
            }
          }}
          className={`${tableInlineInputClassName} w-64 !text-sm font-semibold`}
        />
        <p
          className="px-1.5 text-[11px] text-slate-500"
          title="The file's name when it was uploaded"
        >
          {sheetPdf.originalName} · {sheetPdf.uploadedAt}
        </p>
      </td>
      <td className={`${cellClassName} whitespace-nowrap`}>
        {SHEET_PDF_SHAPE_LABELS[sheetPdf.shape]}
      </td>
      <td className={cellClassName}>
        {isRect ? (sheetPdf.hasTopSlab ? "Yes" : "No") : ""}
      </td>
      <td className={cellClassName}>
        {isRect ? (sheetPdf.hasBaseSlab ? "Yes" : "No") : ""}
      </td>
      <td className={`${cellClassName} max-w-[280px]`}>
        {inUse ? (
          sheetPdf.usedByTemplates.join(", ")
        ) : (
          <span className="text-slate-400">Not used</span>
        )}
      </td>
      <td className={`${cellClassName} max-w-[280px]`}>
        <FieldCheck id={sheetPdf.id} version={sheetPdf.version} />
      </td>
      <td className={cellClassName}>
        <div className="flex flex-nowrap items-center gap-2">
          {/* Keyed by upload time so a replaced PDF drops the copy the
              desktop shell warmed for the old one. */}
          <PdfDragChip
            key={`${sheetPdf.id}-${sheetPdf.version}`}
            href={`${sheetPdfDownloadHref(sheetPdf.id)}?v=${sheetPdf.version}`}
            fileName={sheetPdfDownloadName(sheetPdf.name)}
            title="Save this blank sheet PDF to your PC: drag it onto a folder or the desktop, or click to download. Edit it, then bring it back with Replace."
            label="Save PDF"
            className={`${actionButtonClassName} whitespace-nowrap border-sky-300 bg-sky-50 text-sky-900 hover:border-sky-400 hover:bg-sky-100`}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            aria-label={`Replacement PDF for ${sheetPdf.name}`}
            className="hidden"
            onChange={(event) => {
              const input = event.currentTarget;
              const file = input.files?.[0];
              if (!file) {
                return;
              }
              const formData = new FormData();
              formData.set("id", sheetPdf.id);
              formData.set("file", file);
              // Cleared so picking the same file again still fires.
              input.value = "";
              run(
                () => replaceSheetPdfFileAction(formData),
                `"${sheetPdf.name}" replaced.`,
              );
            }}
          />
          <button
            type="button"
            disabled={pending}
            title="Upload an edited PDF in place of this one. Every template using it follows."
            onClick={() => fileInputRef.current?.click()}
            className={`${actionButtonClassName} border-slate-300 bg-white text-slate-800 hover:bg-slate-50`}
          >
            Replace
          </button>
          <button
            type="button"
            disabled={pending || inUse}
            title={
              inUse
                ? "In use: pick another Sheet PDF on its templates first."
                : "Delete this Sheet PDF and its file."
            }
            onClick={() => {
              if (window.confirm(`Delete the Sheet PDF "${sheetPdf.name}"?`)) {
                run(
                  () => deleteSheetPdfAction(sheetPdf.id),
                  "Sheet PDF deleted.",
                );
              }
            }}
            className={`${actionButtonClassName} border-red-200 bg-white text-red-700 hover:bg-red-50`}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
