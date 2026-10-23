"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  importExistingJob,
  type ImportJobResult,
} from "@/app/jobs/import-actions";
import {
  OneOffJobStep,
  describeJobChoice,
  isJobChoiceComplete,
  type OneOffJobChoice,
} from "@/components/quotes/one-off/one-off-job-step";
import { describeActionFailure, isActionError } from "@/lib/action-result";
import { useUnsavedChangesWarning } from "@/lib/hooks/use-unsaved-changes-warning";
import {
  IMPORT_DOC_KINDS,
  IMPORT_PHASES,
  autoMatchFiles,
  getImportPhase,
  importFileField,
  parseMoneyInput,
  sumImportRows,
  type ImportDocKind,
  type ImportJobPayload,
  type ImportPhase,
  type ImportRow,
  type ImportStructureRow,
} from "@/lib/job-import";
import { formatUsd } from "@/lib/format";
import { ImportDocumentsStep } from "./import-documents-step";
import {
  ImportStructuresStep,
  newImportKey,
  newStructureRow,
} from "./import-structures-step";
import type { ImportFileEntry, ImportQuoteFields } from "./import-types";
import { loadPdfFromFile } from "./pdf-page-thumbnails";

const STEP_LABELS = ["Job and phase", "Drop the PDFs", "Structures", "Review and import"];

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

async function readPageCount(file: File): Promise<number | null> {
  try {
    const loaded = await loadPdfFromFile(file);
    const count = loaded.pdf.numPages;
    loaded.destroy();
    return count;
  } catch {
    return null;
  }
}

function Stepper({ step, onPick, canReach }: {
  step: number;
  onPick: (step: number) => void;
  canReach: (step: number) => boolean;
}) {
  return (
    <ol className="flex flex-wrap gap-2">
      {STEP_LABELS.map((label, index) => {
        const done = index < step;
        const current = index === step;
        return (
          <li key={label}>
            <button
              type="button"
              disabled={!canReach(index)}
              onClick={() => onPick(index)}
              aria-current={current ? "step" : undefined}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed ${
                current
                  ? "bg-slate-900 text-white"
                  : done
                    ? "bg-emerald-100 text-emerald-900 hover:bg-emerald-200"
                    : "bg-slate-200 text-slate-600"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                  current
                    ? "bg-white text-slate-900"
                    : done
                      ? "bg-emerald-700 text-white"
                      : "bg-white text-slate-600"
                }`}
              >
                {done ? "✓" : index + 1}
              </span>
              {label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Jobs → Import Existing Job: bring a job quoted and submitted outside the
 * app in one pass. Four steps (job and phase, drop the PDFs, the structure
 * grid, review), then one server call creates the job, its won quote,
 * structures with their statuses, and files every PDF.
 */
export function ImportJobWizard({ defaultTaxRate }: { defaultTaxRate: number }) {
  const [step, setStep] = useState(0);
  const [jobChoice, setJobChoice] = useState<OneOffJobChoice | null>(null);
  const [phase, setPhase] = useState<ImportPhase | null>(null);
  const [files, setFiles] = useState<ImportFileEntry[]>([]);
  const [modes, setModes] = useState<Record<ImportDocKind, "combined" | "separate">>({
    DRILL_SHEET: "combined",
    SUBMITTAL: "combined",
    APPROVED_SUBMITTAL: "combined",
  });
  const [quote, setQuote] = useState<ImportQuoteFields>({
    quoteNumber: "",
    quoteDate: todayIso(),
    taxRate: String(defaultTaxRate),
    totalCheck: "",
  });
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportJobResult | null>(null);
  const [submitting, startSubmit] = useTransition();

  const phaseInfo = phase ? getImportPhase(phase) : null;
  const makesStructures = phaseInfo?.structureStatus != null;
  const defaultStatus = phaseInfo?.structureStatus ?? "NOT_SUBMITTED";

  const dirty = !result && (jobChoice != null || files.length > 0 || rows.length > 0);
  useUnsavedChangesWarning(dirty);

  function updateRows(next: ImportRow[], fileList: ImportFileEntry[] = files) {
    setRows(autoMatchFiles(next, fileList));
  }

  function choosePhase(next: ImportPhase) {
    const previousDefault = phaseInfo?.structureStatus ?? null;
    const nextDefault = getImportPhase(next).structureStatus;
    setPhase(next);
    // Rows still on the old phase's status follow the new one.
    if (nextDefault && previousDefault !== nextDefault) {
      setRows((current) =>
        current.map((row) =>
          row.kind === "STRUCTURE" && (previousDefault == null || row.status === previousDefault)
            ? { ...row, status: nextDefault }
            : row,
        ),
      );
    }
  }

  async function addFiles(kind: ImportDocKind | "QUOTE", dropped: File[], combined: boolean) {
    const pdfs = dropped.filter(
      (file) => file.type === "application/pdf" || /\.pdf$/i.test(file.name),
    );
    if (pdfs.length === 0) {
      return;
    }
    const entries: ImportFileEntry[] = [];
    for (const file of pdfs) {
      entries.push({
        key: newImportKey("f"),
        kind,
        name: file.name,
        combined,
        file,
        pageCount: combined ? await readPageCount(file) : null,
      });
    }
    // The quote and a combined PDF are one-per-kind: a new drop replaces it.
    const replaced = files.filter(
      (entry) =>
        entry.kind === kind && (kind === "QUOTE" || (combined && entry.combined)),
    );
    const replacedKeys = new Set(replaced.map((entry) => entry.key));
    const nextFiles = [...files.filter((entry) => !replacedKeys.has(entry.key)), ...entries];
    setFiles(nextFiles);
    updateRows(clearFileRefs(rows, replacedKeys), nextFiles);
  }

  function clearFileRefs(current: ImportRow[], keys: Set<string>): ImportRow[] {
    if (keys.size === 0) {
      return current;
    }
    return current.map((row) => {
      if (row.kind !== "STRUCTURE") {
        return row;
      }
      const docs = { ...row.docs };
      for (const kind of IMPORT_DOC_KINDS) {
        const ref = docs[kind.value];
        if (ref && keys.has(ref.fileKey)) {
          delete docs[kind.value];
        }
      }
      return { ...row, docs };
    });
  }

  function removeFile(key: string) {
    const nextFiles = files.filter((entry) => entry.key !== key);
    setFiles(nextFiles);
    setRows(clearFileRefs(rows, new Set([key])));
  }

  function dropFileOnRow(rowKey: string, kind: ImportDocKind, file: File) {
    if (!(file.type === "application/pdf" || /\.pdf$/i.test(file.name))) {
      return;
    }
    const entry: ImportFileEntry = {
      key: newImportKey("f"),
      kind,
      name: file.name,
      combined: false,
      file,
      pageCount: null,
    };
    const nextFiles = [...files, entry];
    setFiles(nextFiles);
    setRows(
      rows.map((row) =>
        row.key === rowKey && row.kind === "STRUCTURE"
          ? { ...row, docs: { ...row.docs, [kind]: { fileKey: entry.key, pages: null } } }
          : row,
      ),
    );
  }

  const structureRows = rows.filter(
    (row): row is ImportStructureRow => row.kind === "STRUCTURE",
  );
  const productRows = rows.filter((row) => row.kind === "PRODUCT");

  const matchedTo = new Map<string, string>();
  for (const row of structureRows) {
    for (const ref of Object.values(row.docs)) {
      if (ref && ref.pages == null) {
        matchedTo.set(ref.fileKey, row.structureNumber || "a row");
      }
    }
  }

  const step1Done = isJobChoiceComplete(jobChoice) && phase != null;
  const step3Done = rows.length > 0;
  function canReach(index: number) {
    if (index === 0) return true;
    if (index <= 2) return step1Done;
    return step1Done && step3Done;
  }

  function goTo(index: number) {
    if (!canReach(index)) {
      return;
    }
    if (index === 2 && rows.length === 0) {
      setRows([newStructureRow(defaultStatus)]);
    }
    setSubmitError(null);
    setStep(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Review warnings: nothing here blocks the import.
  const warnings: string[] = [];
  const numbers = structureRows.map((row) => row.structureNumber.trim().toLowerCase());
  const blankNumbers = numbers.filter((number) => !number).length;
  if (blankNumbers > 0) {
    warnings.push(`${blankNumbers} structure row${blankNumbers === 1 ? " has" : "s have"} no structure number.`);
  }
  const duplicates = [...new Set(numbers.filter((n, i) => n && numbers.indexOf(n) !== i))];
  if (duplicates.length > 0) {
    warnings.push(`Structure numbers used twice: ${duplicates.join(", ").toUpperCase()}.`);
  }
  if (makesStructures) {
    for (const kind of IMPORT_DOC_KINDS) {
      if (!files.some((entry) => entry.kind === kind.value)) {
        continue;
      }
      const missing = structureRows
        .filter((row) => !row.docs[kind.value])
        .map((row) => row.structureNumber || "(blank)");
      if (missing.length > 0) {
        warnings.push(
          `No ${kind.label.toLowerCase()} for ${missing.join(", ")}. You can attach it later on the structure page.`,
        );
      }
      for (const file of files.filter((entry) => entry.kind === kind.value && entry.combined)) {
        const used = new Set<number>();
        for (const row of structureRows) {
          const ref = row.docs[kind.value];
          if (ref?.fileKey === file.key) {
            ref.pages?.forEach((page) => used.add(page));
          }
        }
        const left = (file.pageCount ?? 0) - used.size;
        if (left > 0) {
          warnings.push(`${left} page${left === 1 ? "" : "s"} of ${file.name} not matched to a structure (the whole PDF is still kept in the job folder).`);
        }
      }
    }
  }
  const unpickedProducts = productRows.filter((row) => row.kind === "PRODUCT" && !row.productId).length;
  if (unpickedProducts > 0) {
    warnings.push(`${unpickedProducts} casting/stock row${unpickedProducts === 1 ? " has" : "s have"} no product picked. Those must be fixed before importing.`);
  }
  const total = sumImportRows(rows);
  const check = parseMoneyInput(quote.totalCheck);
  if (check != null && Math.round((check - total) * 100) !== 0) {
    warnings.push(
      `The grid comes to ${formatUsd(total)} but the quote says ${formatUsd(check)}. Anything not on a row can't be put on a ticket or invoice.`,
    );
  }
  if (jobChoice?.mode === "existing" && jobChoice.job) {
    const onJob = new Set(jobChoice.job.structureNumbers.map((n) => n.trim().toLowerCase()));
    const overlap = structureRows
      .filter((row) => onJob.has(row.structureNumber.trim().toLowerCase()))
      .map((row) => row.structureNumber);
    if (overlap.length > 0 && makesStructures) {
      warnings.push(
        `Already on job ${jobChoice.job.jobNumber}: ${overlap.join(", ")}. Drill sheets made in the app are adopted and keep their sheet; ones already on a won quote stop the import.`,
      );
    }
  }

  function submit() {
    if (!jobChoice || !phase) {
      return;
    }
    const payload: ImportJobPayload = {
      job:
        jobChoice.mode === "existing"
          ? { mode: "existing", jobId: jobChoice.job?.id ?? "" }
          : { mode: "new", ...jobChoice.fields },
      phase,
      quote: {
        quoteNumber: quote.quoteNumber,
        quoteDate: quote.quoteDate,
        taxRate: quote.taxRate,
      },
      files: files.map(({ key, kind, name, combined }) => ({ key, kind, name, combined })),
      rows,
    };
    const formData = new FormData();
    formData.set("payload", JSON.stringify(payload));
    for (const entry of files) {
      formData.set(importFileField(entry.key), entry.file, entry.name);
    }
    setSubmitError(null);
    startSubmit(async () => {
      try {
        const response = await importExistingJob(formData);
        if (isActionError(response)) {
          setSubmitError(response.error);
          return;
        }
        setResult(response);
      } catch (error) {
        setSubmitError(describeActionFailure(error, "The import didn't finish. Nothing may have been saved; check the job list before trying again."));
      }
    });
  }

  function startOver() {
    setStep(0);
    setJobChoice(null);
    setPhase(null);
    setFiles([]);
    setRows([]);
    setQuote({ quoteNumber: "", quoteDate: todayIso(), taxRate: String(defaultTaxRate), totalCheck: "" });
    setResult(null);
    setSubmitError(null);
  }

  if (result) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
          <p className="font-semibold">
            Imported {result.jobCreated ? "new job " : "into job "}
            <Link href={`/jobs/${result.jobId}`} className="underline">
              {result.jobNumber} — {result.projectName}
            </Link>
            .
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs">
            <li>
              Quote{" "}
              <Link href={`/quotes/${result.quoteId}`} className="font-semibold underline">
                {result.quoteNumber}
              </Link>{" "}
              {result.structureCount > 0 ? "marked Won" : "saved as Sent"}
            </li>
            {result.structureCount > 0 ? (
              <li>{result.structureCount} structure{result.structureCount === 1 ? "" : "s"} with their statuses</li>
            ) : null}
            {result.productLineCount > 0 ? (
              <li>{result.productLineCount} casting/stock line{result.productLineCount === 1 ? "" : "s"}</li>
            ) : null}
            <li>{result.filesSaved} file{result.filesSaved === 1 ? "" : "s"} saved</li>
          </ul>
          {result.errors.length > 0 ? (
            <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs text-red-700">
              {result.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/jobs/${result.jobId}`}
            className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Open the job
          </Link>
          <button
            type="button"
            onClick={startOver}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Import another job
          </button>
        </div>
      </div>
    );
  }

  const nextButtonClass =
    "inline-flex items-center rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50";
  const backButtonClass =
    "inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50";

  return (
    <div className="space-y-5">
      <Stepper step={step} onPick={goTo} canReach={canReach} />

      {step > 0 && jobChoice ? (
        <p className="text-xs text-slate-600">
          {describeJobChoice(jobChoice)} · <b>{phaseInfo?.title}</b>
        </p>
      ) : null}

      {step === 0 ? (
        <div className="space-y-4">
          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Which job?</h3>
            <OneOffJobStep choice={jobChoice} onChange={setJobChoice} />
          </section>
          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Where is this job right now?</h3>
              <p className="text-xs text-slate-500">
                This sets the starting status for every structure. You can
                still change any one of them in the grid.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {IMPORT_PHASES.map((option) => {
                const active = phase === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => choosePhase(option.value)}
                    aria-pressed={active}
                    className={`flex min-h-24 flex-col gap-1 rounded-xl border px-3 py-3 text-left transition-colors ${
                      active
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-sm font-semibold">{option.title}</span>
                    <span className={`text-xs ${active ? "text-slate-300" : "text-slate-500"}`}>
                      {option.description}
                    </span>
                    <span className={`mt-auto text-[11px] font-semibold ${active ? "text-slate-200" : "text-slate-500"}`}>
                      {option.structureStatus
                        ? `Structures start as ${option.structureStatus.replace(/_/g, " ").toLowerCase()}`
                        : "Quote only, no structures yet"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
          <div className="flex justify-end">
            <button type="button" disabled={!step1Done} onClick={() => goTo(1)} className={nextButtonClass}>
              Next: drop the PDFs
            </button>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-4">
          <ImportDocumentsStep
            files={files}
            modes={modes}
            quote={quote}
            showStructurePaperwork={makesStructures}
            matchedTo={matchedTo}
            onAddFiles={(kind, dropped, combined) => void addFiles(kind, dropped, combined)}
            onRemoveFile={removeFile}
            onModeChange={(kind, mode) => setModes((current) => ({ ...current, [kind]: mode }))}
            onQuoteChange={(patch) => setQuote((current) => ({ ...current, ...patch }))}
          />
          <div className="flex justify-between">
            <button type="button" onClick={() => goTo(0)} className={backButtonClass}>
              Back
            </button>
            <button type="button" onClick={() => goTo(2)} className={nextButtonClass}>
              Next: structures
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <ImportStructuresStep
            rows={rows}
            files={files}
            makesStructures={makesStructures}
            defaultStatus={defaultStatus}
            quote={quote}
            onRowsChange={(next) => updateRows(next)}
            onDropFileOnRow={dropFileOnRow}
          />
          <div className="flex justify-between">
            <button type="button" onClick={() => goTo(1)} className={backButtonClass}>
              Back
            </button>
            <button type="button" disabled={!step3Done} onClick={() => goTo(3)} className={nextButtonClass}>
              Next: review
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 && phaseInfo ? (
        <div className="space-y-4">
          <p className="text-xs text-slate-600">Nothing is saved until you press Import job.</p>
          {warnings.length > 0 ? (
            <ul className="space-y-2">
              {warnings.map((warning) => (
                <li
                  key={warning}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                >
                  {warning}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-4 text-xs">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Job</h3>
              <p className="text-slate-700">{jobChoice ? describeJobChoice(jobChoice) : ""}</p>
              <p className="mt-1 text-slate-500">
                {jobChoice?.mode === "new"
                  ? `A job number is assigned and the job folder is created. Status: ${phaseInfo.jobStatus.toLowerCase()}.`
                  : "Moves forward to the matching status if it's at an earlier stage."}
              </p>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-4 text-xs">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Quote</h3>
              <p className="text-slate-700">
                {quote.quoteNumber.trim() || "Number assigned"} ·{" "}
                {makesStructures ? "marked Won" : "saved as Sent"} · {rows.length} line
                {rows.length === 1 ? "" : "s"} · {formatUsd(total)} before tax
              </p>
              <p className="mt-1 text-slate-500">
                {files.some((entry) => entry.kind === "QUOTE")
                  ? "The quote PDF is saved to 02 Quotes."
                  : "No quote PDF dropped."}
              </p>
            </section>
            {makesStructures ? (
              <section className="rounded-xl border border-slate-200 bg-white p-4 text-xs">
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Structures</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(
                    structureRows.reduce<Record<string, number>>((counts, row) => {
                      counts[row.status] = (counts[row.status] ?? 0) + 1;
                      return counts;
                    }, {}),
                  ).map(([status, count]) => (
                    <span key={status} className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                      {count} {status.replace(/_/g, " ").toLowerCase()}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-slate-500">
                  They show up in Production right away; Made ones can go on a
                  delivery ticket.
                </p>
              </section>
            ) : null}
            <section className="rounded-xl border border-slate-200 bg-white p-4 text-xs">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Files</h3>
              <p className="text-slate-700">
                {files.length} file{files.length === 1 ? "" : "s"} dropped.
                {files.some((entry) => entry.combined)
                  ? " Combined PDFs are split per structure, and the whole PDF is kept in the job folder too."
                  : ""}
              </p>
            </section>
          </div>
          {submitError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {submitError}
            </p>
          ) : null}
          <div className="flex justify-between">
            <button type="button" onClick={() => goTo(2)} className={backButtonClass}>
              Back
            </button>
            <button
              type="button"
              disabled={submitting || unpickedProducts > 0}
              onClick={submit}
              className="inline-flex items-center rounded-lg bg-emerald-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Importing…" : "Import job"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
