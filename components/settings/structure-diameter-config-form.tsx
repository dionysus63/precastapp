"use client";

import { useMemo, useState } from "react";
import { isActionError, type ActionError } from "@/lib/action-result";
import { randomId } from "@/lib/random-id";
import {
  MOLD_DIAMETER_BASIS_OPTIONS,
  type MoldDiameterBasis,
  moldOutsideDiameterFeet,
} from "@/lib/mold-sheet-settings";
import {
  tableBodyClassName,
  tableCellClassName,
  tableCellInputClassName,
  tableCompactClassName,
  tableGridCellClassName,
  tableHeaderCellWrapClassName,
} from "@/lib/table-styles";

export type DiameterConfigRow = {
  id: string;
  label: string;
  insideDiameterFeet: string;
  wallThicknessInches: string;
  maxBaseHeightFeet: string;
  maxRiserHeightFeet: string;
  keyHeightFeet: string;
  /** False = keyless mold (wall too thin to key). The key height is kept
   * (hidden and ignored) so it comes back if the key is switched on again. */
  hasKey: boolean;
  /** Which diameter this mold's drill sheets print. */
  sheetDiameterBasis: MoldDiameterBasis;
  wallPricePerFoot: string;
  basePrice: string;
};

type TextField = Exclude<
  keyof DiameterConfigRow,
  "id" | "hasKey" | "sheetDiameterBasis"
>;

type StructureDiameterConfigFormProps = {
  /** Returns `{ error }` on failure (shown above the save button). */
  action: (formData: FormData) => Promise<void | ActionError>;
  defaultRows: DiameterConfigRow[];
  /** Price columns read/write this list's entries; blank = no entry. */
  priceListId: string;
  priceListName: string;
};

function uid() {
  return randomId();
}

function createRow(): DiameterConfigRow {
  return {
    id: uid(),
    label: "",
    insideDiameterFeet: "",
    wallThicknessInches: "",
    maxBaseHeightFeet: "",
    maxRiserHeightFeet: "",
    keyHeightFeet: "",
    hasKey: true,
    sheetDiameterBasis: "INSIDE",
    wallPricePerFoot: "",
    basePrice: "",
  };
}

/** Outside Ø display: inside Ø + 2 × wall, e.g. sanity-check that a 7.33'
 * ID grease trap mold with 4" walls really is the 8' OD mold. It is the
 * same number a drill sheet prints when the mold is set to OD. */
function outsideDiameterLabel(row: DiameterConfigRow): string {
  const outside = moldOutsideDiameterFeet(
    row.insideDiameterFeet.trim() === "" ? null : Number(row.insideDiameterFeet),
    row.wallThicknessInches.trim() === ""
      ? null
      : Number(row.wallThicknessInches),
  );
  return outside == null ? "—" : `${outside.toFixed(2)}'`;
}

// Fixed, tight column widths: the table sizes to its content and sits on the
// left instead of stretching across the card. Inputs fill their cell
// (Excel-style), and each cell is held to its column width by a wrapper —
// an input's own default width would otherwise push the columns apart.
const COLUMN_WIDTHS = {
  name: "w-52",
  narrow: "w-16",
  medium: "w-[4.5rem]",
  wide: "w-20",
} as const;
type ColumnWidth = keyof typeof COLUMN_WIDTHS;

const headerClassName = `${tableHeaderCellWrapClassName} align-bottom`;
const numberInputClassName = `${tableCellInputClassName} tabular-nums`;
const selectClassName = `${tableCellInputClassName} cursor-pointer`;
/** Read-only cell, shaded like a locked spreadsheet cell. */
const lockedCellClassName = `${tableCellClassName} whitespace-nowrap bg-slate-50/60 tabular-nums text-slate-500`;

/** Header label held to its column's width (less the cell padding), so long
 * labels wrap instead of widening the column. */
function HeaderLabel({
  width = "narrow",
  children,
}: {
  width?: Exclude<ColumnWidth, "name">;
  children: React.ReactNode;
}) {
  const inner = { narrow: "w-12", medium: "w-14", wide: "w-16" }[width];
  return <div className={inner}>{children}</div>;
}

function GridCell({
  width = "narrow",
  children,
}: {
  width?: ColumnWidth;
  children: React.ReactNode;
}) {
  return (
    <td className={tableGridCellClassName}>
      <div className={COLUMN_WIDTHS[width]}>{children}</div>
    </td>
  );
}

export function StructureDiameterConfigForm({
  action,
  defaultRows,
  priceListId,
  priceListName,
}: StructureDiameterConfigFormProps) {
  const [rows, setRows] = useState<DiameterConfigRow[]>(
    defaultRows.length > 0 ? defaultRows : [createRow()],
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  const payloadJson = useMemo(
    () =>
      JSON.stringify(
        rows.map((row) => ({
          label: row.label,
          insideDiameterFeet: row.insideDiameterFeet,
          wallThicknessInches: row.wallThicknessInches,
          maxBaseHeightFeet: row.maxBaseHeightFeet,
          maxRiserHeightFeet: row.maxRiserHeightFeet,
          keyHeightFeet: row.keyHeightFeet,
          hasKey: row.hasKey,
          sheetDiameterBasis: row.sheetDiameterBasis,
          wallPricePerFoot: row.wallPricePerFoot,
          basePrice: row.basePrice,
        })),
      ),
    [rows],
  );

  function patchRow(id: string, patch: Partial<DiameterConfigRow>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function updateRow(id: string, field: TextField, value: string) {
    patchRow(id, { [field]: value });
  }

  const priceTitle = `Prices on the "${priceListName}" price list. Blank = no entry — quotes on this list fall back to the default list's price.`;

  return (
    <form
      action={async (formData) => {
        setSaveError(null);
        const result = await action(formData);
        if (isActionError(result)) {
          setSaveError(result.error);
        }
      }}
      // Sized to the table, so the buttons line up with its right edge.
      className="w-fit max-w-full space-y-4"
    >
      <input type="hidden" name="payload" value={payloadJson} />
      <input type="hidden" name="priceListId" value={priceListId} />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setRows((current) => [...current, createRow()])}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-2xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Add Diameter
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className={tableCompactClassName}>
          <thead>
            <tr>
              <th className={headerClassName}>Mold</th>
              <th className={headerClassName}>
                <HeaderLabel>Inside Ø (ft)</HeaderLabel>
              </th>
              <th className={headerClassName}>
                <HeaderLabel>Wall (in)</HeaderLabel>
              </th>
              <th className={headerClassName}>
                <HeaderLabel>Outside Ø</HeaderLabel>
              </th>
              <th
                className={headerClassName}
                title="Which diameter this mold's drill sheets show: ID (inside) for manholes, OD (outside) for molds called by their outside diameter, like grease traps."
              >
                <HeaderLabel>Sheet Shows</HeaderLabel>
              </th>
              <th className={headerClassName}>
                <HeaderLabel>Max Base (ft)</HeaderLabel>
              </th>
              <th className={headerClassName}>
                <HeaderLabel>Max Riser (ft)</HeaderLabel>
              </th>
              <th
                className={headerClassName}
                title="No = this mold has no key (wall too thin, e.g. 4&quot; grease traps). Drill sheets then show no key in the top slab or at any joint."
              >
                <HeaderLabel>Key</HeaderLabel>
              </th>
              <th className={headerClassName}>
                <HeaderLabel width="medium">Key Height (ft)</HeaderLabel>
              </th>
              <th className={headerClassName} title={priceTitle}>
                <HeaderLabel width="wide">$/ft Wall ({priceListName})</HeaderLabel>
              </th>
              <th className={headerClassName} title={priceTitle}>
                <HeaderLabel width="wide">
                  Base Price ({priceListName})
                </HeaderLabel>
              </th>
              <th className={headerClassName}></th>
            </tr>
          </thead>
          <tbody className={tableBodyClassName}>
            {rows.map((row) => (
              <tr key={row.id}>
                <GridCell width="name">
                  <input
                    type="text"
                    value={row.label}
                    onChange={(e) => updateRow(row.id, "label", e.target.value)}
                    placeholder={`e.g. 8' OD Grease Trap`}
                    aria-label="Mold name"
                    className={tableCellInputClassName}
                  />
                </GridCell>
                <GridCell>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.insideDiameterFeet}
                    onChange={(e) =>
                      updateRow(row.id, "insideDiameterFeet", e.target.value)
                    }
                    aria-label="Inside diameter (ft)"
                    className={numberInputClassName}
                  />
                </GridCell>
                <GridCell>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.wallThicknessInches}
                    onChange={(e) =>
                      updateRow(row.id, "wallThicknessInches", e.target.value)
                    }
                    aria-label="Wall thickness (in)"
                    className={numberInputClassName}
                  />
                </GridCell>
                <td className={lockedCellClassName}>
                  {outsideDiameterLabel(row)}
                </td>
                <GridCell>
                  <select
                    value={row.sheetDiameterBasis}
                    onChange={(e) =>
                      patchRow(row.id, {
                        sheetDiameterBasis: e.target.value as MoldDiameterBasis,
                      })
                    }
                    aria-label="Diameter shown on drill sheets"
                    className={selectClassName}
                  >
                    {MOLD_DIAMETER_BASIS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </GridCell>
                <GridCell>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.maxBaseHeightFeet}
                    onChange={(e) =>
                      updateRow(row.id, "maxBaseHeightFeet", e.target.value)
                    }
                    aria-label="Max base height (ft)"
                    className={numberInputClassName}
                  />
                </GridCell>
                <GridCell>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.maxRiserHeightFeet}
                    onChange={(e) =>
                      updateRow(row.id, "maxRiserHeightFeet", e.target.value)
                    }
                    aria-label="Max riser height (ft)"
                    className={numberInputClassName}
                  />
                </GridCell>
                <GridCell>
                  <select
                    value={row.hasKey ? "yes" : "no"}
                    onChange={(e) =>
                      patchRow(row.id, { hasKey: e.target.value === "yes" })
                    }
                    aria-label="Key"
                    className={selectClassName}
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </GridCell>
                {row.hasKey ? (
                  <GridCell width="medium">
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={row.keyHeightFeet}
                      onChange={(e) =>
                        updateRow(row.id, "keyHeightFeet", e.target.value)
                      }
                      aria-label="Key height (ft)"
                      className={numberInputClassName}
                    />
                  </GridCell>
                ) : (
                  <td
                    className={lockedCellClassName}
                    title="This mold has no key."
                  >
                    —
                  </td>
                )}
                <GridCell width="wide">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.wallPricePerFoot}
                    onChange={(e) =>
                      updateRow(row.id, "wallPricePerFoot", e.target.value)
                    }
                    aria-label="Wall price per foot"
                    className={numberInputClassName}
                  />
                </GridCell>
                <GridCell width="wide">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.basePrice}
                    onChange={(e) =>
                      updateRow(row.id, "basePrice", e.target.value)
                    }
                    aria-label="Base price"
                    className={numberInputClassName}
                  />
                </GridCell>
                <td className={tableCellClassName}>
                  {rows.length > 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setRows((current) =>
                          current.filter((r) => r.id !== row.id),
                        )
                      }
                      className="text-2xs font-medium text-rose-600 hover:text-rose-800"
                    >
                      Remove
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* w-0 + min-w-full: wraps to the table's width without widening it. */}
      <div className="w-0 min-w-full space-y-2 text-2xs text-slate-500">
        <p>
          Wall thickness belongs to the mold — templates and drill sheets pick
          it up per diameter. ASTM C478 minimum wall is inside Ø ÷ 12 (4&apos;
          → 4&quot;, 5&apos; → 5&quot;, 6&apos; → 6&quot;). For molds sized by
          outside diameter, enter inside Ø = OD − 2 × wall (an 8&apos; OD mold
          with 4&quot; walls is 7.33&apos; inside) and check the Outside Ø
          column.
        </p>
        <p>
          <span className="font-semibold text-slate-600">Sheet Shows</span>{" "}
          picks the diameter printed on this mold&apos;s drill sheets: ID for
          manholes, OD for molds called by their outside diameter (grease
          traps).{" "}
          <span className="font-semibold text-slate-600">Key</span> = No is for
          molds whose wall is too thin to key: their drill sheets show no key
          in the top slab or at any joint, and nothing is taken off for a key
          in the height calculations.
        </p>
      </div>

      {saveError ? (
        <p className="w-0 min-w-full rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          {saveError}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Save Molds ({priceListName} prices)
        </button>
      </div>
    </form>
  );
}
