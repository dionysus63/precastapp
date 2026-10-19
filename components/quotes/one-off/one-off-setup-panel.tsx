"use client";

import { jobInputClassName } from "@/components/jobs/job-utils";
import {
  sizesForPipeType,
  type OneOffCircularOptions,
  type OneOffRectOptions,
  type OneOffSetup,
  type OneOffShape,
  type PipeTypeChoice,
} from "@/lib/quotes/one-off-drill-sheets";

type OneOffSetupPanelProps = {
  shape: OneOffShape;
  setup: OneOffSetup;
  pipeChoices: PipeTypeChoice[];
  circularOptions: OneOffCircularOptions;
  rectOptions: OneOffRectOptions;
  /** Next free number for the current prefix, shown when Start # is blank. */
  suggestedStart: number;
  missing: string[];
  /** True once rows exist: the button rebuilds instead of building. */
  hasRows: boolean;
  onChange: (setup: OneOffSetup) => void;
  onBuild: () => void;
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

/**
 * The picks every row starts from. All of them are required before the grid
 * is built; each row can still be changed afterwards from its own dropdowns.
 */
export function OneOffSetupPanel({
  shape,
  setup,
  pipeChoices,
  circularOptions,
  rectOptions,
  suggestedStart,
  missing,
  hasRows,
  onChange,
  onBuild,
}: OneOffSetupPanelProps) {
  const isCircular = shape === "CIRCULAR";
  const templates = isCircular ? circularOptions.templates : rectOptions.templates;
  const castings = isCircular ? circularOptions.castings : rectOptions.castings;
  const diameters = isCircular
    ? (circularOptions.templates.find((entry) => entry.id === setup.templateId)
        ?.diameters ?? [])
    : [];
  const sizes = sizesForPipeType(pipeChoices, setup.pipeType);

  function patch(next: Partial<OneOffSetup>) {
    onChange({ ...setup, ...next });
  }

  function handleTemplateChange(templateId: string) {
    const template = templates.find((entry) => entry.id === templateId);
    const nextDiameters = isCircular
      ? (circularOptions.templates.find((entry) => entry.id === templateId)
          ?.diameters ?? [])
      : [];
    patch({
      templateId,
      // One-size molds don't need a second pick.
      diameterFeet:
        nextDiameters.length === 1
          ? String(nextDiameters[0].insideDiameterFeet)
          : nextDiameters.some(
                (entry) => String(entry.insideDiameterFeet) === setup.diameterFeet,
              )
            ? setup.diameterFeet
            : "",
      // Start from the template's own casting; it can still be changed.
      castingProductId:
        setup.castingProductId || template?.defaultCastingProductId || "",
    });
  }

  const missingClass = (field: boolean) =>
    `${jobInputClassName} ${field ? "" : "border-amber-300 bg-amber-50"}`;

  if (templates.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        No active {isCircular ? "circular" : "rectangular"} templates yet. Add
        one in Structures first.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Template *">
          <select
            value={setup.templateId}
            onChange={(event) => handleTemplateChange(event.target.value)}
            className={missingClass(Boolean(setup.templateId))}
          >
            <option value="">— choose a template —</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </Field>
        {isCircular ? (
          <Field label="Diameter *">
            <select
              value={setup.diameterFeet}
              onChange={(event) => patch({ diameterFeet: event.target.value })}
              disabled={!setup.templateId}
              className={missingClass(Boolean(setup.diameterFeet))}
            >
              <option value="">— choose —</option>
              {diameters.map((entry) => (
                <option key={entry.id} value={String(entry.insideDiameterFeet)}>
                  {entry.insideDiameterFeet}&apos;
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="Casting *">
          <select
            value={setup.castingProductId}
            onChange={(event) => patch({ castingProductId: event.target.value })}
            className={missingClass(Boolean(setup.castingProductId))}
          >
            <option value="">— choose a casting —</option>
            {castings.map((casting) => (
              <option key={casting.id} value={casting.id}>
                {casting.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pipe Type *">
          <select
            value={setup.pipeType}
            onChange={(event) => {
              const nextSizes = sizesForPipeType(pipeChoices, event.target.value);
              patch({
                pipeType: event.target.value,
                pipeSize: nextSizes.some((size) => String(size) === setup.pipeSize)
                  ? setup.pipeSize
                  : "",
              });
            }}
            className={missingClass(Boolean(setup.pipeType))}
          >
            <option value="">— choose a pipe type —</option>
            {pipeChoices.map((choice) => (
              <option key={choice.label} value={choice.label}>
                {choice.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pipe Size *">
          <select
            value={setup.pipeSize}
            onChange={(event) => patch({ pipeSize: event.target.value })}
            disabled={!setup.pipeType}
            className={missingClass(Boolean(setup.pipeSize))}
          >
            <option value="">— choose a size —</option>
            {sizes.map((size) => (
              <option key={size} value={String(size)}>
                {size}&quot;
              </option>
            ))}
          </select>
        </Field>
        <Field label="Quantity (rows) *">
          <input
            type="number"
            min={1}
            step={1}
            value={setup.quantity}
            onChange={(event) => patch({ quantity: event.target.value })}
            placeholder="How many structures?"
            className={missingClass(Number(setup.quantity) >= 1)}
          />
        </Field>
        <Field label="Number Prefix">
          <input
            type="text"
            value={setup.prefix}
            onChange={(event) => patch({ prefix: event.target.value })}
            className={jobInputClassName}
          />
        </Field>
        <Field label="Start #">
          <input
            type="number"
            min={1}
            step={1}
            value={setup.startNumber}
            onChange={(event) => patch({ startNumber: event.target.value })}
            placeholder={String(suggestedStart)}
            className={jobInputClassName}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBuild}
          disabled={missing.length > 0}
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {hasRows ? "Rebuild Rows" : "Build Rows"}
        </button>
        {missing.length > 0 ? (
          <span className="text-[11px] text-amber-700">
            Still needed: {missing.join(", ")}.
          </span>
        ) : hasRows ? (
          <span className="text-[11px] text-slate-500">
            Rebuilding replaces the rows below and anything typed in them.
          </span>
        ) : null}
      </div>
    </div>
  );
}
