"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createOneOffDrillSheets,
  type OneOffCreateInput,
  type OneOffCreateResult,
} from "@/app/quotes/one-off-actions";
import { saveOneOffDraft, deleteOneOffDraft } from "@/app/quotes/one-off-draft-actions";
import {
  OneOffDraftBar,
  type OneOffDraftRecord,
} from "@/components/quotes/one-off/one-off-draft-bar";
import { OneOffDraftsCard } from "@/components/quotes/one-off/one-off-drafts-card";
import { OneOffGrid } from "@/components/quotes/one-off/one-off-grid";
import {
  OneOffJobStep,
  describeJobChoice,
  isJobChoiceComplete,
  type OneOffJobChoice,
} from "@/components/quotes/one-off/one-off-job-step";
import { OneOffResults } from "@/components/quotes/one-off/one-off-results";
import { OneOffSetupPanel } from "@/components/quotes/one-off/one-off-setup-panel";
import { describeActionFailure, isActionError } from "@/lib/action-result";
import { useUnsavedChangesWarning } from "@/lib/hooks/use-unsaved-changes-warning";
import { navigateAfterAction } from "@/lib/reload-after-action";
import {
  defaultDraftName,
  describeDraftJob,
  serializeOneOffDraftState,
  type OneOffDraftJob,
  type OneOffDraftState,
  type OneOffDraftSummary,
  type OneOffResumedDraft,
} from "@/lib/quotes/one-off-draft";
import {
  buildRowsFromSetup,
  circularPipeTypeChoices,
  computeCircularOneOffRow,
  computeRectOneOffRow,
  createEmptySection,
  findDuplicateStructureNumbers,
  missingSetupFields,
  nextFreeStructureNumber,
  rectPipeTypeChoices,
  type OneOffCircularOptions,
  type OneOffRectOptions,
  type OneOffSection,
  type OneOffShape,
  type OneOffShapeChoice,
} from "@/lib/quotes/one-off-drill-sheets";

type OneOffDrillSheetsProps = {
  circularOptions: OneOffCircularOptions;
  rectOptions: OneOffRectOptions;
  /** Grids saved to finish later, listed before a new One-Off starts. */
  drafts: OneOffDraftSummary[];
  /** A saved draft to pick up where it left off. */
  resume: OneOffResumedDraft | null;
};

/** The job step as a draft stores it: an existing job by id only. */
function toDraftJob(choice: OneOffJobChoice | null): OneOffDraftJob | null {
  if (!choice) {
    return null;
  }
  if (choice.mode === "existing") {
    return choice.job ? { mode: "existing", jobId: choice.job.id } : null;
  }
  return { mode: "new", fields: choice.fields, customerLabel: choice.customerLabel };
}

/** The job step as the page shows it, with the resumed job reloaded. */
function fromResumedJob(resume: OneOffResumedDraft): OneOffJobChoice | null {
  const job = resume.state.job;
  if (!job) {
    return null;
  }
  if (job.mode === "existing") {
    return { mode: "existing", job: resume.job };
  }
  return { mode: "new", fields: job.fields, customerLabel: job.customerLabel };
}

const SHAPE_CHOICES: { value: OneOffShapeChoice; title: string; description: string }[] = [
  { value: "CIRCULAR", title: "Circular", description: "Manholes and round structures" },
  { value: "RECTANGULAR", title: "Rectangular", description: "Catch basins and boxes" },
  { value: "BOTH", title: "Both", description: "Circular first, then rectangular" },
];

function StepCard({
  number,
  title,
  summary,
  open,
  onEdit,
  children,
}: {
  number: number;
  title: string;
  /** Shown instead of the body when the step is collapsed. */
  summary?: string;
  open: boolean;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
              open ? "bg-slate-900 text-white" : "bg-emerald-100 text-emerald-800"
            }`}
          >
            {open ? number : "✓"}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            {!open && summary ? (
              <p className="truncate text-xs text-slate-500">{summary}</p>
            ) : null}
          </div>
        </div>
        {!open && onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            Change
          </button>
        ) : null}
      </div>
      {open ? <div className="p-4">{children}</div> : null}
    </section>
  );
}

/**
 * Quotes → One-Off: pick the job, pick circular/rectangular/both, fill the
 * spreadsheet-style grids, then create every drill sheet in one go.
 */
export function OneOffDrillSheets({
  circularOptions,
  rectOptions,
  drafts,
  resume,
}: OneOffDrillSheetsProps) {
  const [jobChoice, setJobChoice] = useState<OneOffJobChoice | null>(() =>
    resume ? fromResumedJob(resume) : null,
  );
  const [jobConfirmed, setJobConfirmed] = useState(
    () => resume != null && resume.state.jobConfirmed && !resume.jobMissing,
  );
  const [shapeChoice, setShapeChoice] = useState<OneOffShapeChoice | null>(
    () => resume?.state.shapeChoice ?? null,
  );
  const [circular, setCircular] = useState<OneOffSection>(
    () => resume?.state.circular ?? createEmptySection("CIRCULAR"),
  );
  const [rect, setRect] = useState<OneOffSection>(
    () => resume?.state.rect ?? createEmptySection("RECTANGULAR"),
  );
  /** With "Both", the rectangular step opens once circular is done. */
  const [rectUnlocked, setRectUnlocked] = useState(
    () => resume?.state.rectUnlocked ?? false,
  );
  const [result, setResult] = useState<OneOffCreateResult | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, startCreating] = useTransition();

  // Saving for later: the draft this page works on, its name, and the
  // snapshot last written so "Save Changes" knows when there is anything new.
  const [draft, setDraft] = useState<OneOffDraftRecord | null>(() =>
    resume
      ? {
          id: resume.id,
          name: resume.name,
          savedBy: resume.savedBy,
          savedAt: resume.savedAt,
        }
      : null,
  );
  const [draftName, setDraftName] = useState(() => resume?.name ?? "");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [savingDraft, startSavingDraft] = useTransition();
  const draftState = useMemo<OneOffDraftState>(
    () => ({
      version: 1,
      job: toDraftJob(jobChoice),
      jobConfirmed,
      shapeChoice,
      rectUnlocked,
      circular,
      rect,
    }),
    [circular, jobChoice, jobConfirmed, rect, rectUnlocked, shapeChoice],
  );
  const draftSnapshot = useMemo(
    () => serializeOneOffDraftState(draftState),
    [draftState],
  );
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string | null>(
    () => (resume ? serializeOneOffDraftState(resume.state) : null),
  );

  const circularPipeChoices = useMemo(
    () => circularPipeTypeChoices(circularOptions.pipeOpeningSizes),
    [circularOptions.pipeOpeningSizes],
  );
  const rectPipeChoices = useMemo(
    () => rectPipeTypeChoices(rectOptions.openingSizes),
    [rectOptions.openingSizes],
  );

  const usesCircular = shapeChoice === "CIRCULAR" || shapeChoice === "BOTH";
  const usesRect = shapeChoice === "RECTANGULAR" || shapeChoice === "BOTH";
  const rectVisible =
    usesRect && (shapeChoice === "RECTANGULAR" || rectUnlocked);

  const jobNumbers = useMemo(
    () =>
      jobChoice?.mode === "existing" && jobChoice.job
        ? jobChoice.job.structureNumbers
        : [],
    [jobChoice],
  );

  const circularRows = useMemo(
    () => (usesCircular ? (circular.rows ?? []) : []),
    [circular.rows, usesCircular],
  );
  const rectRows = useMemo(
    () => (rectVisible ? (rect.rows ?? []) : []),
    [rect.rows, rectVisible],
  );

  const circularResults = useMemo(
    () => circularRows.map((row) => computeCircularOneOffRow(row, circularOptions)),
    [circularOptions, circularRows],
  );
  const rectResults = useMemo(
    () => rectRows.map((row) => computeRectOneOffRow(row, rectOptions)),
    [rectOptions, rectRows],
  );

  /** Numbers used twice in the grids, or already on the existing job. */
  const duplicateNumbers = useMemo(() => {
    const gridNumbers = [...circularRows, ...rectRows].map(
      (row) => row.structureNumber,
    );
    const keys = new Set(
      findDuplicateStructureNumbers(gridNumbers).map((number) =>
        number.toLowerCase(),
      ),
    );
    const onJob = new Set(jobNumbers.map((number) => number.trim().toLowerCase()));
    for (const number of gridNumbers) {
      const key = number.trim().toLowerCase();
      if (key && onJob.has(key)) {
        keys.add(key);
      }
    }
    return keys;
  }, [circularRows, jobNumbers, rectRows]);

  const started = jobChoice != null || circular.rows != null || rect.rows != null;
  const draftDirty =
    lastSavedSnapshot == null ? started : draftSnapshot !== lastSavedSnapshot;
  const isDirty = result == null && draftDirty;
  useUnsavedChangesWarning(
    isDirty,
    draft
      ? "You have changes since this draft was last saved. Leave and discard them?"
      : "This One-Off isn't saved. Leave without saving it for later?",
  );

  function takenFor(shape: OneOffShape): string[] {
    const other = shape === "CIRCULAR" ? rect.rows : circular.rows;
    return [...jobNumbers, ...(other ?? []).map((row) => row.structureNumber)];
  }

  function suggestedStart(section: OneOffSection, shape: OneOffShape): number {
    return nextFreeStructureNumber(section.setup.prefix, takenFor(shape));
  }

  function buildSection(shape: OneOffShape) {
    const section = shape === "CIRCULAR" ? circular : rect;
    const setter = shape === "CIRCULAR" ? setCircular : setRect;
    const setup = {
      ...section.setup,
      startNumber:
        section.setup.startNumber.trim() ||
        String(suggestedStart(section, shape)),
    };
    setter({
      ...section,
      setup,
      rows: buildRowsFromSetup(setup, section.openingCount),
    });
  }

  function chooseShape(choice: OneOffShapeChoice) {
    setShapeChoice(choice);
    setRectUnlocked(choice === "RECTANGULAR");
  }

  const totalRows = circularRows.length + rectRows.length;
  const readyCount =
    circularResults.filter((entry) => entry.ready).length +
    rectResults.filter((entry) => entry.ready).length;
  const allBuilt =
    (!usesCircular || circular.rows != null) &&
    (!usesRect || (rectVisible && rect.rows != null));
  const canCreate =
    allBuilt &&
    totalRows > 0 &&
    readyCount === totalRows &&
    duplicateNumbers.size === 0 &&
    isJobChoiceComplete(jobChoice);

  function handleCreate() {
    if (!jobChoice || !canCreate) {
      return;
    }
    const job: OneOffCreateInput["job"] =
      jobChoice.mode === "existing"
        ? { mode: "existing", jobId: jobChoice.job!.id }
        : { mode: "new", ...jobChoice.fields };
    const sheets: OneOffCreateInput["sheets"] = [
      ...circularRows.map((row, index) => ({
        shape: "CIRCULAR" as const,
        structureNumber: row.structureNumber,
        config: circularResults[index].config,
      })),
      ...rectRows.map((row, index) => ({
        shape: "RECTANGULAR" as const,
        structureNumber: row.structureNumber,
        config: rectResults[index].config,
      })),
    ];

    setCreateError(null);
    startCreating(async () => {
      try {
        const response = await createOneOffDrillSheets({
          job,
          sheets,
          draftId: draft?.id ?? null,
        });
        if (isActionError(response)) {
          setCreateError(response.error);
          return;
        }
        // The server removed the draft along with creating the sheets.
        setDraft(null);
        setLastSavedSnapshot(null);
        setResult(response);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (error) {
        setCreateError(
          describeActionFailure(error, "Could not create the drill sheets."),
        );
      }
    });
  }

  function startOver() {
    setJobChoice(null);
    setJobConfirmed(false);
    setShapeChoice(null);
    setCircular(createEmptySection("CIRCULAR"));
    setRect(createEmptySection("RECTANGULAR"));
    setRectUnlocked(false);
    setResult(null);
    setCreateError(null);
    setDraft(null);
    setDraftName("");
    setDraftError(null);
    setLastSavedSnapshot(null);
    if (resume) {
      // Drop ?draft= so the page starts fresh instead of reopening the draft
      // (a full navigation: the client router is unreliable on the LAN).
      navigateAfterAction("/quotes/one-off");
    }
  }

  function handleSaveDraft() {
    if (!started) {
      setDraftError("Pick a job or build a grid before saving.");
      return;
    }
    const snapshot = draftSnapshot;
    const name =
      draftName.trim() ||
      defaultDraftName(
        describeDraftJob(
          draftState.job,
          jobChoice?.mode === "existing" ? jobChoice.job : null,
        ),
      );
    setDraftError(null);
    startSavingDraft(async () => {
      try {
        const response = await saveOneOffDraft({
          id: draft?.id ?? null,
          name,
          state: draftState,
        });
        if (isActionError(response)) {
          setDraftError(response.error);
          return;
        }
        if (!draft) {
          // First save: reopen the page on the draft's own URL so a reload
          // (or the back button) lands on it. A full navigation, because the
          // client router can't be trusted to sync the URL on the LAN.
          navigateAfterAction(
            `/quotes/one-off?draft=${encodeURIComponent(response.id)}`,
            { type: "success", text: `Saved "${response.name}" to finish later.` },
          );
          return;
        }
        setDraft(response);
        setDraftName(response.name);
        setLastSavedSnapshot(snapshot);
      } catch (error) {
        setDraftError(describeActionFailure(error, "Could not save the draft."));
      }
    });
  }

  function handleDiscardDraft() {
    if (!draft) {
      return;
    }
    if (!window.confirm(`Delete the draft "${draft.name}" and clear this page?`)) {
      return;
    }
    const draftId = draft.id;
    setDraftError(null);
    startSavingDraft(async () => {
      try {
        const response = await deleteOneOffDraft(draftId);
        if (isActionError(response)) {
          setDraftError(response.error);
          return;
        }
        navigateAfterAction("/quotes/one-off", {
          type: "info",
          text: `Draft "${draft.name}" deleted.`,
        });
      } catch (error) {
        setDraftError(describeActionFailure(error, "Could not delete the draft."));
      }
    });
  }

  if (result) {
    return <OneOffResults result={result} onStartOver={startOver} />;
  }

  const jobComplete = isJobChoiceComplete(jobChoice);
  let stepNumber = 3;

  function renderShapeSection(shape: OneOffShape) {
    const section = shape === "CIRCULAR" ? circular : rect;
    const setter = shape === "CIRCULAR" ? setCircular : setRect;
    const pipeChoices = shape === "CIRCULAR" ? circularPipeChoices : rectPipeChoices;
    const results = shape === "CIRCULAR" ? circularResults : rectResults;
    const label = shape === "CIRCULAR" ? "Circular" : "Rectangular";
    const sectionReady = results.filter((entry) => entry.ready).length;
    const number = stepNumber;
    stepNumber += 1;

    return (
      <StepCard
        key={shape}
        number={number}
        title={`${label} Drill Sheets`}
        open
      >
        <div className="space-y-5">
          <OneOffSetupPanel
            shape={shape}
            setup={section.setup}
            pipeChoices={pipeChoices}
            circularOptions={circularOptions}
            rectOptions={rectOptions}
            suggestedStart={suggestedStart(section, shape)}
            missing={missingSetupFields(shape, section.setup)}
            hasRows={section.rows != null}
            onChange={(setup) => setter({ ...section, setup })}
            onBuild={() => buildSection(shape)}
          />

          {section.rows != null ? (
            <>
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {label} grid
                </h4>
                <span className="text-[11px] text-slate-500">
                  {sectionReady} of {section.rows.length} ready
                </span>
              </div>
              <OneOffGrid
                shape={shape}
                rows={section.rows}
                results={results}
                openingCount={section.openingCount}
                setup={section.setup}
                pipeChoices={pipeChoices}
                takenNumbers={takenFor(shape)}
                duplicateNumbers={duplicateNumbers}
                circularOptions={circularOptions}
                rectOptions={rectOptions}
                onRowsChange={(rows) =>
                  setter((current) => ({ ...current, rows }))
                }
                onOpeningCountChange={(openingCount) =>
                  setter((current) => ({ ...current, openingCount }))
                }
              />
            </>
          ) : null}
        </div>
      </StepCard>
    );
  }

  return (
    <div className="space-y-4">
      {!resume && !started ? <OneOffDraftsCard drafts={drafts} /> : null}

      {resume?.jobMissing ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          The job this draft was for no longer exists. Pick another job (or a
          new one) and your rows are kept.
        </div>
      ) : null}

      {started || draft ? (
        <OneOffDraftBar
          draft={draft}
          name={draftName}
          onNameChange={setDraftName}
          dirty={draftDirty}
          saving={savingDraft}
          error={draftError}
          onSave={handleSaveDraft}
          onDiscard={handleDiscardDraft}
        />
      ) : null}

      <StepCard
        number={1}
        title="Job"
        open={!jobConfirmed}
        summary={jobChoice && jobComplete ? describeJobChoice(jobChoice) : undefined}
        onEdit={() => setJobConfirmed(false)}
      >
        <div className="space-y-4">
          <OneOffJobStep choice={jobChoice} onChange={setJobChoice} />
          {jobChoice ? (
            <button
              type="button"
              disabled={!jobComplete}
              onClick={() => setJobConfirmed(true)}
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue
            </button>
          ) : null}
        </div>
      </StepCard>

      {jobConfirmed ? (
        <StepCard
          number={2}
          title="Structure Type"
          open
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {SHAPE_CHOICES.map((choice) => {
              const active = shapeChoice === choice.value;
              return (
                <button
                  key={choice.value}
                  type="button"
                  onClick={() => chooseShape(choice.value)}
                  className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span className="block text-sm font-semibold">{choice.title}</span>
                  <span
                    className={`mt-0.5 block text-xs ${active ? "text-slate-300" : "text-slate-500"}`}
                  >
                    {choice.description}
                  </span>
                </button>
              );
            })}
          </div>
          {(shapeChoice === "CIRCULAR" && rect.rows != null) ||
          (shapeChoice === "RECTANGULAR" && circular.rows != null) ? (
            <p className="mt-2 text-[11px] text-slate-500">
              Rows already typed for the other shape are kept but won&apos;t be
              created unless you switch back.
            </p>
          ) : null}
        </StepCard>
      ) : null}

      {jobConfirmed && usesCircular ? renderShapeSection("CIRCULAR") : null}

      {jobConfirmed && shapeChoice === "BOTH" && !rectUnlocked ? (
        <div>
          <button
            type="button"
            disabled={circular.rows == null}
            onClick={() => setRectUnlocked(true)}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next: Rectangular Drill Sheets
          </button>
        </div>
      ) : null}

      {jobConfirmed && rectVisible ? renderShapeSection("RECTANGULAR") : null}

      {jobConfirmed && allBuilt ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canCreate || creating}
            className="inline-flex items-center justify-center rounded-lg bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating
              ? "Creating…"
              : `Create Drill Sheets${totalRows > 0 ? ` (${totalRows})` : ""}`}
          </button>
          <span className="text-xs text-slate-500">
            {totalRows === 0
              ? "Add at least one row."
              : duplicateNumbers.size > 0
                ? "Fix the structure numbers marked in red."
                : readyCount < totalRows
                  ? `${totalRows - readyCount} row${totalRows - readyCount === 1 ? "" : "s"} still need rim and inverts (see Status).`
                  : jobChoice?.mode === "new"
                    ? "A new job is created along with the sheets."
                    : "Every row is ready."}
          </span>
          {createError ? (
            <p className="w-full text-xs text-red-600">{createError}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
