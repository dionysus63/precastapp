"use client";

import { isActionError, type ActionError } from "@/lib/action-result";
import { randomId } from "@/lib/random-id";
import { useMemo, useState } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  CatalogFilterBar,
  CatalogMaterialCard,
  CatalogRemoveSizeButton,
  CatalogSaveBar,
  catalogCellClassName,
  catalogCellInputClassName,
  catalogGroupHeaderCellClassName,
  catalogHeaderCellClassName,
  catalogTableClassName,
} from "@/components/structures/opening-catalog-ui";
import {
  duplicateSizeKeys,
  emptyPipeMaterialGroup,
  emptyPipeSizeLine,
  flattenPipeOpeningGroups,
  groupPipeOpeningRows,
  type PipeOpeningCatalogRow,
  type PipeOpeningMaterialGroup,
  type PipeOpeningSizeLine,
  validatePipeOpeningGroups,
} from "@/lib/opening-catalog-groups";

export type PipeOpeningRow = PipeOpeningCatalogRow;

type PipeOpeningSizesFormProps = {
  /** Returns `{ error }` on failure (shown above the buttons). */
  action: (formData: FormData) => Promise<void | ActionError>;
  defaultRows: PipeOpeningRow[];
  /** Price/Boot reads and writes this list's entries; blank = no entry. */
  priceListId: string;
  priceListName: string;
};

function uid() {
  return randomId();
}

const numericOnly = (value: string) => value.replace(/[^0-9]/g, "");

type PipeLineField = Exclude<
  keyof PipeOpeningSizeLine,
  "key" | "bootRowId" | "noBootRowId"
>;

export function PipeOpeningSizesForm({
  action,
  defaultRows,
  priceListId,
  priceListName,
}: PipeOpeningSizesFormProps) {
  const [groups, setGroups] = useState<PipeOpeningMaterialGroup[]>(() => {
    const grouped = groupPipeOpeningRows(defaultRows, uid);
    return grouped.length > 0 ? grouped : [emptyPipeMaterialGroup(uid)];
  });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  const payloadJson = useMemo(
    () =>
      JSON.stringify(
        flattenPipeOpeningGroups(groups).map((row) => ({
          id: row.id ?? null,
          pipeMaterial: row.pipeMaterial,
          pipeSizeInches: row.pipeSizeInches,
          hasBoot: row.hasBoot,
          holeDiameterInches: row.holeDiameterInches,
          pipeWallThicknessInches: row.pipeWallThicknessInches,
          bootModel: row.bootModel || null,
          pricePerBoot: row.pricePerBoot || null,
        })),
      ),
    [groups],
  );

  function updateGroup(
    key: string,
    update: (group: PipeOpeningMaterialGroup) => PipeOpeningMaterialGroup,
  ) {
    setGroups((current) =>
      current.map((group) => (group.key === key ? update(group) : group)),
    );
  }

  function updateLine(
    groupKey: string,
    lineKey: string,
    field: PipeLineField,
    value: string,
  ) {
    updateGroup(groupKey, (group) => ({
      ...group,
      sizes: group.sizes.map((line) =>
        line.key === lineKey ? { ...line, [field]: value } : line,
      ),
    }));
  }

  function toggleCollapsed(key: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const filterText = filter.trim().toLowerCase();
  const visibleGroups = filterText
    ? groups.filter((group) =>
        group.pipeMaterial.toLowerCase().includes(filterText),
      )
    : groups;
  const allCollapsed =
    groups.length > 0 && groups.every((group) => collapsed.has(group.key));

  return (
    <form
      action={async (formData) => {
        setSaveError(null);
        const problems = validatePipeOpeningGroups(groups);
        if (problems.length > 0) {
          setSaveError(problems.join(" "));
          return;
        }
        const result = await action(formData);
        if (isActionError(result)) {
          setSaveError(result.error);
        }
      }}
      className="space-y-4"
    >
      <input type="hidden" name="payload" value={payloadJson} />
      <input type="hidden" name="priceListId" value={priceListId} />

      <SectionCard
        title="Round Structure Opening Catalog"
        description="Grouped by pipe material. Each size lists its boot (Kor-N-Seal) hole, boot model, and price next to its no-boot (grouted) hole. Pipe wall sets the pipe's outside: top-of-pipe on the sheet is invert + size + wall, and grouted holes must clear OD = size + 2 × wall."
      >
        <div className="space-y-3">
          <CatalogFilterBar
            filter={filter}
            onFilterChange={setFilter}
            allCollapsed={allCollapsed}
            onToggleAll={() =>
              setCollapsed(
                allCollapsed
                  ? new Set()
                  : new Set(groups.map((group) => group.key)),
              )
            }
            onAddMaterial={() => {
              const group = emptyPipeMaterialGroup(uid);
              setGroups((current) => [group, ...current]);
              setFilter("");
            }}
          />

          {visibleGroups.length === 0 ? (
            <p className="px-1 py-3 text-xs text-slate-500">
              No materials match “{filter}”.
            </p>
          ) : null}

          {visibleGroups.map((group) => (
            <PipeMaterialCard
              key={group.key}
              group={group}
              priceListName={priceListName}
              collapsed={collapsed.has(group.key)}
              onToggleCollapsed={() => toggleCollapsed(group.key)}
              onRename={(name) =>
                updateGroup(group.key, (g) => ({ ...g, pipeMaterial: name }))
              }
              onToggleBoot={() =>
                updateGroup(group.key, (g) => ({ ...g, boot: !g.boot }))
              }
              onToggleNoBoot={() =>
                updateGroup(group.key, (g) => ({ ...g, noBoot: !g.noBoot }))
              }
              onRemove={() =>
                setGroups((current) =>
                  current.filter((g) => g.key !== group.key),
                )
              }
              onAddSize={() =>
                updateGroup(group.key, (g) => ({
                  ...g,
                  sizes: [...g.sizes, emptyPipeSizeLine(uid())],
                }))
              }
              onRemoveSize={(lineKey) =>
                updateGroup(group.key, (g) => ({
                  ...g,
                  sizes: g.sizes.filter((line) => line.key !== lineKey),
                }))
              }
              onUpdateLine={(lineKey, field, value) =>
                updateLine(group.key, lineKey, field, value)
              }
            />
          ))}
        </div>
      </SectionCard>

      <CatalogSaveBar saveError={saveError} />
    </form>
  );
}

type PipeMaterialCardProps = {
  group: PipeOpeningMaterialGroup;
  priceListName: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onRename: (name: string) => void;
  onToggleBoot: () => void;
  onToggleNoBoot: () => void;
  onRemove: () => void;
  onAddSize: () => void;
  onRemoveSize: (lineKey: string) => void;
  onUpdateLine: (lineKey: string, field: PipeLineField, value: string) => void;
};

function PipeMaterialCard({
  group,
  priceListName,
  collapsed,
  onToggleCollapsed,
  onRename,
  onToggleBoot,
  onToggleNoBoot,
  onRemove,
  onAddSize,
  onRemoveSize,
  onUpdateLine,
}: PipeMaterialCardProps) {
  const duplicates = duplicateSizeKeys(group.sizes);
  const hiddenBootData =
    !group.boot && group.sizes.some((line) => line.bootHoleInches.trim());
  const hiddenNoBootData =
    !group.noBoot && group.sizes.some((line) => line.noBootHoleInches.trim());

  return (
    <CatalogMaterialCard
      material={group.pipeMaterial}
      materialPlaceholder="PVC SDR35"
      sizeCount={
        group.sizes.filter((line) => line.pipeSizeInches.trim()).length
      }
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      onRename={onRename}
      onRemove={onRemove}
      onAddSize={onAddSize}
      toggles={
        <>
          <ToggleChip
            label="Boot"
            on={group.boot}
            onClick={onToggleBoot}
            onClassName="bg-teal-50 text-teal-700"
          />
          <ToggleChip
            label="No Boot"
            on={group.noBoot}
            onClick={onToggleNoBoot}
            onClassName="bg-amber-50 text-amber-700"
          />
        </>
      }
      notice={
        hiddenBootData || hiddenNoBootData
          ? `${[
              hiddenBootData ? "Boot" : null,
              hiddenNoBootData ? "No-boot" : null,
            ]
              .filter(Boolean)
              .join(
                " and ",
              )} sizes are hidden and will be removed when you save.`
          : null
      }
    >
      {!group.boot && !group.noBoot ? (
        <p className="px-3 py-3 text-xs text-slate-500">
          Turn on Boot or No Boot to list sizes for this material.
        </p>
      ) : (
        <table className={catalogTableClassName}>
          <thead>
            <tr>
              <th
                colSpan={2}
                className={`${catalogGroupHeaderCellClassName} bg-slate-100`}
              />
              {group.boot ? (
                <th
                  colSpan={3}
                  className={`${catalogGroupHeaderCellClassName} bg-teal-50 text-center text-teal-700`}
                >
                  Boot
                </th>
              ) : null}
              {group.noBoot ? (
                <th
                  className={`${catalogGroupHeaderCellClassName} bg-amber-50 text-center text-amber-700`}
                >
                  No Boot
                </th>
              ) : null}
              <th
                className={`${catalogGroupHeaderCellClassName} bg-slate-100`}
              />
            </tr>
            <tr>
              <th className={catalogHeaderCellClassName}>Size (in)</th>
              <th
                className={catalogHeaderCellClassName}
                title="Pipe wall thickness. Drives the top-of-pipe elevation on the sheet (invert + size + wall) and the joint clearance for grouted/cast-in holes (pipe OD = size + 2 × wall)."
              >
                Pipe Wall (in)
              </th>
              {group.boot ? (
                <>
                  <th className={catalogHeaderCellClassName}>Hole (in)</th>
                  <th className={catalogHeaderCellClassName}>Boot Model</th>
                  <th
                    className={catalogHeaderCellClassName}
                    title={`Prices on the "${priceListName}" price list. Blank = no entry — quotes on this list fall back to the default list's price.`}
                  >
                    Price/Boot
                  </th>
                </>
              ) : null}
              {group.noBoot ? (
                <th className={catalogHeaderCellClassName}>Hole (in)</th>
              ) : null}
              <th className={catalogHeaderCellClassName} />
            </tr>
          </thead>
          <tbody>
            {group.sizes.map((line) => (
              <tr key={line.key}>
                <td className={catalogCellClassName}>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={line.pipeSizeInches}
                    onChange={(e) =>
                      onUpdateLine(
                        line.key,
                        "pipeSizeInches",
                        numericOnly(e.target.value),
                      )
                    }
                    placeholder="8"
                    aria-label="Pipe size (in)"
                    title={
                      duplicates.has(line.key)
                        ? "This size is listed twice"
                        : undefined
                    }
                    className={`${catalogCellInputClassName} font-semibold ${
                      duplicates.has(line.key) ? "bg-rose-50 text-rose-700" : ""
                    }`}
                  />
                </td>
                <td className={catalogCellClassName}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.pipeWallThicknessInches}
                    onChange={(e) =>
                      onUpdateLine(
                        line.key,
                        "pipeWallThicknessInches",
                        e.target.value,
                      )
                    }
                    placeholder="0.5"
                    aria-label="Pipe wall (in)"
                    className={`${catalogCellInputClassName}`}
                  />
                </td>
                {group.boot ? (
                  <>
                    <td className={catalogCellClassName}>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={line.bootHoleInches}
                        onChange={(e) =>
                          onUpdateLine(
                            line.key,
                            "bootHoleInches",
                            numericOnly(e.target.value),
                          )
                        }
                        placeholder="—"
                        aria-label="Boot hole (in)"
                        className={`${catalogCellInputClassName}`}
                      />
                    </td>
                    <td className={catalogCellClassName}>
                      <input
                        type="text"
                        value={line.bootModel}
                        onChange={(e) =>
                          onUpdateLine(line.key, "bootModel", e.target.value)
                        }
                        placeholder="106-008"
                        aria-label="Boot model"
                        className={`${catalogCellInputClassName}`}
                      />
                    </td>
                    <td className={catalogCellClassName}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.pricePerBoot}
                        onChange={(e) =>
                          onUpdateLine(line.key, "pricePerBoot", e.target.value)
                        }
                        placeholder="—"
                        aria-label={`Price per boot (${priceListName})`}
                        className={`${catalogCellInputClassName}`}
                      />
                    </td>
                  </>
                ) : null}
                {group.noBoot ? (
                  <td className={catalogCellClassName}>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={line.noBootHoleInches}
                      onChange={(e) =>
                        onUpdateLine(
                          line.key,
                          "noBootHoleInches",
                          numericOnly(e.target.value),
                        )
                      }
                      placeholder="—"
                      aria-label="No-boot hole (in)"
                      className={`${catalogCellInputClassName}`}
                    />
                  </td>
                ) : null}
                <td className={`${catalogCellClassName} px-2`}>
                  <CatalogRemoveSizeButton
                    label={
                      `${line.pipeSizeInches ? `${line.pipeSizeInches}" ` : ""}${group.pipeMaterial.trim()}`.trim() ||
                      "this size"
                    }
                    onRemove={() => onRemoveSize(line.key)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </CatalogMaterialCard>
  );
}

function ToggleChip({
  label,
  on,
  onClick,
  onClassName,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  onClassName: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        on
          ? `border-transparent ${onClassName}`
          : "border-slate-200 bg-white text-slate-400 hover:text-slate-600"
      }`}
    >
      <span
        aria-hidden
        className="inline-grid h-3 w-3 place-items-center rounded-[3px] border-[1.5px] border-current text-[8px] leading-none"
      >
        {on ? "✓" : ""}
      </span>
      {label}
    </button>
  );
}
