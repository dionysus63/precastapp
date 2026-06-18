"use client";

import Link from "next/link";
import { useState } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  type CastingRow,
  type OpeningRow,
  type StructureStatus,
  type StructureType,
  createCastingRow,
  createOpeningRow,
  placeholderCastings,
  placeholderOpenings,
  structureInputClassName,
  structureStatusOptions,
  structureTableInputClassName,
  structureTypeOptions,
} from "@/components/structures/structure-utils";

function updateRow<T extends { id: string }>(
  rows: T[],
  id: string,
  field: keyof T,
  value: string,
): T[] {
  return rows.map((row) =>
    row.id === id ? { ...row, [field]: value } : row,
  );
}

export function StructureForm() {
  const [structureType, setStructureType] =
    useState<StructureType>("CONFIGURABLE_PRODUCT");
  const [status, setStatus] = useState<StructureStatus>("NOT_SUBMITTED");
  const [openings, setOpenings] = useState<OpeningRow[]>(placeholderOpenings);
  const [castings, setCastings] = useState<CastingRow[]>(placeholderCastings);

  function handleAddOpening() {
    setOpenings((rows) => [
      ...rows,
      createOpeningRow(String(rows.length + 1)),
    ]);
  }

  function handleRemoveOpening() {
    setOpenings((rows) => (rows.length > 1 ? rows.slice(0, -1) : rows));
  }

  function handleAddCasting() {
    setCastings((rows) => [...rows, createCastingRow()]);
  }

  function handleRemoveCasting() {
    setCastings((rows) => (rows.length > 1 ? rows.slice(0, -1) : rows));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <SectionCard
        title="Structure Details"
        description="Static preview — saving and cut sheet generation are not connected yet."
      >
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label
                htmlFor="structureType"
                className="block text-xs font-medium text-slate-700"
              >
                Structure Type
              </label>
              <select
                id="structureType"
                name="structureType"
                value={structureType}
                onChange={(event) =>
                  setStructureType(event.target.value as StructureType)
                }
                className={structureInputClassName}
              >
                {structureTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="productTemplate"
                className="block text-xs font-medium text-slate-700"
              >
                Product / Template
              </label>
              <select
                id="productTemplate"
                name="productTemplate"
                disabled
                defaultValue=""
                className={`${structureInputClassName} bg-slate-50 text-slate-500`}
              >
                <option value="">Select product template — coming soon</option>
                <option value="MH-SC-SS">
                  MH-SC-SS — Suffolk County Sanitary Sewer Manhole
                </option>
                <option value="CB-4x4">CB-4x4 — 4&apos;x4&apos; Catch Basin</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="structureNumber"
                className="block text-xs font-medium text-slate-700"
              >
                Structure Number
              </label>
              <input
                id="structureNumber"
                name="structureNumber"
                type="text"
                placeholder="S-001"
                className={structureInputClassName}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-xs font-medium text-slate-700"
            >
              Description
            </label>
            <input
              id="description"
              name="description"
              type="text"
              placeholder="48x72 utility vault with two pipe openings"
              className={structureInputClassName}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label
                htmlFor="quantity"
                className="block text-xs font-medium text-slate-700"
              >
                Quantity
              </label>
              <input
                id="quantity"
                name="quantity"
                type="number"
                min="0"
                step="1"
                defaultValue="1"
                className={structureInputClassName}
              />
            </div>

            <div>
              <label
                htmlFor="weight"
                className="block text-xs font-medium text-slate-700"
              >
                Weight
              </label>
              <input
                id="weight"
                name="weight"
                type="number"
                min="0"
                step="0.01"
                placeholder="8400"
                className={structureInputClassName}
              />
            </div>

            <div>
              <label
                htmlFor="yards"
                className="block text-xs font-medium text-slate-700"
              >
                Yards
              </label>
              <input
                id="yards"
                name="yards"
                type="number"
                min="0"
                step="0.0001"
                placeholder="2.4"
                className={structureInputClassName}
              />
            </div>

            <div>
              <label
                htmlFor="status"
                className="block text-xs font-medium text-slate-700"
              >
                Status
              </label>
              <select
                id="status"
                name="status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as StructureStatus)
                }
                className={structureInputClassName}
              >
                {structureStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="max-w-xs">
            <label
              htmlFor="productionDate"
              className="block text-xs font-medium text-slate-700"
            >
              Production Date
            </label>
            <input
              id="productionDate"
              name="productionDate"
              type="date"
              className={structureInputClassName}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Dimensions">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["insideLength", "Inside Length"],
            ["insideWidth", "Inside Width"],
            ["insideHeight", "Inside Height"],
            ["outsideLength", "Outside Length"],
            ["outsideWidth", "Outside Width"],
            ["outsideHeight", "Outside Height"],
            ["wallThickness", "Wall Thickness"],
            ["topSlabThickness", "Top Slab Thickness"],
            ["baseSlabThickness", "Base Slab Thickness"],
          ].map(([name, label]) => (
            <div key={name}>
              <label
                htmlFor={name}
                className="block text-xs font-medium text-slate-700"
              >
                {label}
              </label>
              <input
                id={name}
                name={name}
                type="number"
                min="0"
                step="0.01"
                className={structureInputClassName}
              />
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Manhole Details">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label
              htmlFor="manholeStandard"
              className="block text-xs font-medium text-slate-700"
            >
              Manhole Standard
            </label>
            <input
              id="manholeStandard"
              name="manholeStandard"
              type="text"
              placeholder="Suffolk County Sanitary Sewer"
              className={structureInputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="rimElevation"
              className="block text-xs font-medium text-slate-700"
            >
              Rim Elevation
            </label>
            <input
              id="rimElevation"
              name="rimElevation"
              type="number"
              step="0.01"
              className={structureInputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="lowestInvertElevation"
              className="block text-xs font-medium text-slate-700"
            >
              Lowest Invert Elevation
            </label>
            <input
              id="lowestInvertElevation"
              name="lowestInvertElevation"
              type="number"
              step="0.01"
              className={structureInputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="requiredWallHeight"
              className="block text-xs font-medium text-slate-700"
            >
              Required Wall Height
            </label>
            <input
              id="requiredWallHeight"
              name="requiredWallHeight"
              type="number"
              min="0"
              step="0.01"
              className={structureInputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="insideDiameter"
              className="block text-xs font-medium text-slate-700"
            >
              Inside Diameter
            </label>
            <input
              id="insideDiameter"
              name="insideDiameter"
              type="number"
              min="0"
              step="0.01"
              className={structureInputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="frameAndCoverType"
              className="block text-xs font-medium text-slate-700"
            >
              Frame and Cover Type
            </label>
            <input
              id="frameAndCoverType"
              name="frameAndCoverType"
              type="text"
              placeholder="H-20 traffic-rated frame & solid cover"
              className={structureInputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="coneOrFlatTop"
              className="block text-xs font-medium text-slate-700"
            >
              Cone or Flat Top
            </label>
            <select
              id="coneOrFlatTop"
              name="coneOrFlatTop"
              defaultValue=""
              className={structureInputClassName}
            >
              <option value="">Select...</option>
              <option value="cone">Cone</option>
              <option value="flat">Flat Top</option>
            </select>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Pipe Openings"
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAddOpening}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Add Opening
            </button>
            <button
              type="button"
              onClick={handleRemoveOpening}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Remove Opening
            </button>
          </div>
        }
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2.5 font-semibold">Opening #</th>
                <th className="px-3 py-2.5 font-semibold">Wall Location</th>
                <th className="px-3 py-2.5 font-semibold">Clock Position</th>
                <th className="px-3 py-2.5 font-semibold">Pipe Type</th>
                <th className="px-3 py-2.5 font-semibold">Pipe Diameter</th>
                <th className="px-3 py-2.5 font-semibold">Connection Type</th>
                <th className="px-3 py-2.5 font-semibold">Invert Elevation</th>
                <th className="px-3 py-2.5 font-semibold">Hole Diameter</th>
                <th className="px-3 py-2.5 font-semibold">Boot Type</th>
                <th className="px-3 py-2.5 font-semibold">Angle</th>
                <th className="px-3 py-2.5 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {openings.map((row) => (
                <tr key={row.id}>
                  {(
                    [
                      "openingNumber",
                      "wallLocation",
                      "clockPosition",
                      "pipeType",
                      "pipeDiameter",
                      "connectionType",
                      "invertElevation",
                      "holeDiameter",
                      "bootType",
                      "angle",
                      "notes",
                    ] as const
                  ).map((field) => (
                    <td key={field} className="px-2 py-1.5">
                      <input
                        type="text"
                        value={row[field]}
                        onChange={(event) =>
                          setOpenings((rows) =>
                            updateRow(rows, row.id, field, event.target.value),
                          )
                        }
                        className={structureTableInputClassName}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Castings"
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAddCasting}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Add Casting
            </button>
            <button
              type="button"
              onClick={handleRemoveCasting}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Remove Casting
            </button>
          </div>
        }
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2.5 font-semibold">Casting Type</th>
                <th className="px-3 py-2.5 font-semibold">Description</th>
                <th className="px-3 py-2.5 font-semibold">Frame Size</th>
                <th className="px-3 py-2.5 font-semibold">Cover Type</th>
                <th className="px-3 py-2.5 font-semibold">Grate Type</th>
                <th className="px-3 py-2.5 font-semibold">Hatch Size</th>
                <th className="px-3 py-2.5 font-semibold">Load Rating</th>
                <th className="px-3 py-2.5 font-semibold">Bolt Down</th>
                <th className="px-3 py-2.5 font-semibold">Vented</th>
                <th className="px-3 py-2.5 font-semibold">Quantity</th>
                <th className="px-3 py-2.5 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {castings.map((row) => (
                <tr key={row.id}>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={row.castingType}
                      onChange={(event) =>
                        setCastings((rows) =>
                          updateRow(rows, row.id, "castingType", event.target.value),
                        )
                      }
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={row.description}
                      onChange={(event) =>
                        setCastings((rows) =>
                          updateRow(rows, row.id, "description", event.target.value),
                        )
                      }
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={row.frameSize}
                      onChange={(event) =>
                        setCastings((rows) =>
                          updateRow(rows, row.id, "frameSize", event.target.value),
                        )
                      }
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={row.coverType}
                      onChange={(event) =>
                        setCastings((rows) =>
                          updateRow(rows, row.id, "coverType", event.target.value),
                        )
                      }
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={row.grateType}
                      onChange={(event) =>
                        setCastings((rows) =>
                          updateRow(rows, row.id, "grateType", event.target.value),
                        )
                      }
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={row.hatchSize}
                      onChange={(event) =>
                        setCastings((rows) =>
                          updateRow(rows, row.id, "hatchSize", event.target.value),
                        )
                      }
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={row.loadRating}
                      onChange={(event) =>
                        setCastings((rows) =>
                          updateRow(rows, row.id, "loadRating", event.target.value),
                        )
                      }
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      value={row.boltDown}
                      onChange={(event) =>
                        setCastings((rows) =>
                          updateRow(rows, row.id, "boltDown", event.target.value),
                        )
                      }
                      className={structureTableInputClassName}
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      value={row.vented}
                      onChange={(event) =>
                        setCastings((rows) =>
                          updateRow(rows, row.id, "vented", event.target.value),
                        )
                      }
                      className={structureTableInputClassName}
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={row.quantity}
                      onChange={(event) =>
                        setCastings((rows) =>
                          updateRow(rows, row.id, "quantity", event.target.value),
                        )
                      }
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={row.notes}
                      onChange={(event) =>
                        setCastings((rows) =>
                          updateRow(rows, row.id, "notes", event.target.value),
                        )
                      }
                      className={structureTableInputClassName}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Documents"
        description="Cut sheets, submittals, and production drawings. Upload is not connected yet."
      >
        <div className="space-y-5">
          <div
            aria-disabled="true"
            className="flex min-h-32 flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center"
          >
            <p className="text-sm font-medium text-slate-700">
              Drag and drop cut sheet or submittal PDFs here
            </p>
            <p className="mt-1 text-xs text-slate-500">
              or click to browse — upload coming soon
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-semibold">Document Name</th>
                  <th className="px-4 py-2.5 font-semibold">Document Type</th>
                  <th className="px-4 py-2.5 font-semibold">Uploaded Date</th>
                  <th className="px-4 py-2.5 font-semibold">File Size</th>
                  <th className="px-4 py-2.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    No documents uploaded yet.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>

      <div className="flex flex-wrap justify-end gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
        <Link
          href="/"
          className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
        <button
          type="button"
          disabled
          className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-400"
        >
          Generate Cut Sheet Preview
        </button>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Save Structure
        </button>
      </div>
    </form>
  );
}
