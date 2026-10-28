"use client";

import { isActionError, type ActionError } from "@/lib/action-result";
import { randomId } from "@/lib/random-id";
import { useMemo, useState } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  CatalogFilterBar,
  CatalogMaterialCard,
  CatalogSaveBar,
  catalogCellClassName,
  catalogCellInputClassName,
  catalogHeaderCellClassName,
  catalogTableClassName,
} from "@/components/structures/opening-catalog-ui";
import {
  duplicateSizeKeys,
  emptyRectMaterialGroup,
  emptyRectSizeLine,
  flattenRectOpeningGroups,
  groupRectOpeningRows,
  type RectOpeningCatalogRow,
  type RectOpeningMaterialGroup,
  type RectOpeningSizeLine,
  validateRectOpeningGroups,
} from "@/lib/opening-catalog-groups";

export type RectOpeningRow = RectOpeningCatalogRow;

type RectOpeningSizesFormProps = {
  /** Returns `{ error }` on failure (shown above the buttons). */
  action: (formData: FormData) => Promise<void | ActionError>;
  defaultRows: RectOpeningRow[];
  /** Price/Opening reads and writes this list's entries; blank = no entry. */
  priceListId: string;
  priceListName: string;
};

function uid() {
  return randomId();
}

type LineField = Exclude<keyof RectOpeningSizeLine, "key" | "id">;
type NumberField = Exclude<LineField, "pipeSizeInches">;

const cellClassName = catalogCellClassName;

export function RectOpeningSizesForm({
  action,
  defaultRows,
  priceListId,
  priceListName,
}: RectOpeningSizesFormProps) {
  const [groups, setGroups] = useState<RectOpeningMaterialGroup[]>(() => {
    const grouped = groupRectOpeningRows(defaultRows, uid);
    return grouped.length > 0 ? grouped : [emptyRectMaterialGroup(uid)];
  });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  const payloadJson = useMemo(
    () =>
      JSON.stringify(
        flattenRectOpeningGroups(groups).map((row) => ({
          id: row.id ?? null,
          pipeMaterial: row.pipeMaterial,
          pipeSizeInches: row.pipeSizeInches,
          openingWidthInches: row.openingWidthInches,
          openingHeightInches: row.openingHeightInches,
          pipeWallThicknessInches: row.pipeWallThicknessInches || null,
          pricePerOpening: row.pricePerOpening || null,
        })),
      ),
    [groups],
  );

  function updateGroup(
    key: string,
    update: (group: RectOpeningMaterialGroup) => RectOpeningMaterialGroup,
  ) {
    setGroups((current) =>
      current.map((group) => (group.key === key ? update(group) : group)),
    );
  }

  function updateLine(
    groupKey: string,
    lineKey: string,
    field: LineField,
    value: string,
  ) {
    updateGroup(groupKey, (group) => ({
      ...group,
      sizes: group.sizes.map((line) =>
        line.key === lineKey ? { ...line, [field]: value } : line,
      ),
    }));
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
        const problems = validateRectOpeningGroups(groups);
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
        title="Rect Structure Opening Catalog"
        description="Grouped by pipe material. Each pipe size maps to the block-out opening width and height. Skewed pipes widen the opening manually on the sheet. Pipe wall sets the outside top of pipe (invert + size + wall) for wall-height checks."
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
              setGroups((current) => [emptyRectMaterialGroup(uid), ...current]);
              setFilter("");
            }}
          />

          {visibleGroups.length === 0 ? (
            <p className="px-1 py-3 text-xs text-slate-500">
              No materials match “{filter}”.
            </p>
          ) : null}

          {visibleGroups.map((group) => {
            const duplicates = duplicateSizeKeys(group.sizes);
            const input = (
              line: RectOpeningSizeLine,
              field: NumberField,
              props: {
                label: string;
                placeholder: string;
                widthClassName: string;
              },
            ) => (
              <input
                type="number"
                min="0"
                step="0.01"
                value={line[field]}
                onChange={(e) =>
                  updateLine(group.key, line.key, field, e.target.value)
                }
                placeholder={props.placeholder}
                aria-label={props.label}
                className={`${catalogCellInputClassName} ${props.widthClassName}`}
              />
            );

            return (
              <CatalogMaterialCard
                key={group.key}
                material={group.pipeMaterial}
                materialPlaceholder="PVC SDR35"
                sizeCount={
                  group.sizes.filter((line) => line.pipeSizeInches.trim())
                    .length
                }
                collapsed={collapsed.has(group.key)}
                onToggleCollapsed={() =>
                  setCollapsed((current) => {
                    const next = new Set(current);
                    if (next.has(group.key)) next.delete(group.key);
                    else next.add(group.key);
                    return next;
                  })
                }
                onRename={(name) =>
                  updateGroup(group.key, (g) => ({ ...g, pipeMaterial: name }))
                }
                onRemove={() =>
                  setGroups((current) =>
                    current.filter((g) => g.key !== group.key),
                  )
                }
                onAddSize={() =>
                  updateGroup(group.key, (g) => ({
                    ...g,
                    sizes: [...g.sizes, emptyRectSizeLine(uid())],
                  }))
                }
              >
                <table className={catalogTableClassName}>
                  <thead>
                    <tr>
                      <th className={catalogHeaderCellClassName}>
                        Pipe Size (in)
                      </th>
                      <th className={catalogHeaderCellClassName}>Width (in)</th>
                      <th className={catalogHeaderCellClassName}>
                        Height (in)
                      </th>
                      <th
                        className={catalogHeaderCellClassName}
                        title="Pipe wall thickness. Drives the outside top of pipe (invert + size + wall), used to check the pipe clears the wall height."
                      >
                        Pipe Wall (in)
                      </th>
                      <th
                        className={catalogHeaderCellClassName}
                        title={`Prices on the "${priceListName}" price list. Blank = no entry — quotes on this list fall back to the default list's price.`}
                      >
                        Price/Opening
                      </th>
                      <th className={catalogHeaderCellClassName} />
                    </tr>
                  </thead>
                  <tbody>
                    {group.sizes.map((line) => (
                      <tr key={line.key}>
                        <td className={cellClassName}>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={line.pipeSizeInches}
                            onChange={(e) =>
                              updateLine(
                                group.key,
                                line.key,
                                "pipeSizeInches",
                                e.target.value.replace(/[^0-9]/g, ""),
                              )
                            }
                            placeholder="12"
                            aria-label="Pipe size (in)"
                            title={
                              duplicates.has(line.key)
                                ? "This size is listed twice"
                                : undefined
                            }
                            className={`${catalogCellInputClassName} w-[6ch] font-semibold ${
                              duplicates.has(line.key)
                                ? "bg-rose-50 text-rose-700"
                                : ""
                            }`}
                          />
                        </td>
                        <td className={cellClassName}>
                          {input(line, "openingWidthInches", {
                            label: "Opening width (in)",
                            placeholder: "18",
                            widthClassName: "w-[8ch]",
                          })}
                        </td>
                        <td className={cellClassName}>
                          {input(line, "openingHeightInches", {
                            label: "Opening height (in)",
                            placeholder: "16",
                            widthClassName: "w-[8ch]",
                          })}
                        </td>
                        <td className={cellClassName}>
                          {input(line, "pipeWallThicknessInches", {
                            label: "Pipe wall (in)",
                            placeholder: "2.5",
                            widthClassName: "w-[9ch]",
                          })}
                        </td>
                        <td className={cellClassName}>
                          {input(line, "pricePerOpening", {
                            label: `Price per opening (${priceListName})`,
                            placeholder: "50.00",
                            widthClassName: "w-[10ch] text-right",
                          })}
                        </td>
                        <td className={`${cellClassName} pl-3 pr-2 text-right`}>
                          <button
                            type="button"
                            onClick={() =>
                              updateGroup(group.key, (g) => ({
                                ...g,
                                sizes: g.sizes.filter(
                                  (l) => l.key !== line.key,
                                ),
                              }))
                            }
                            className="text-[11px] font-medium text-rose-600 hover:text-rose-800"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CatalogMaterialCard>
            );
          })}
        </div>
      </SectionCard>

      <CatalogSaveBar saveError={saveError} />
    </form>
  );
}
