"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import { createJobStructure } from "@/app/jobs/actions";
import {
  structureInputClassName,
  structureTypeOptions,
  type StructureType,
} from "@/components/structures/structure-utils";

type JobStructureFormProps = {
  jobId: string;
  jobNumber: string;
};

export function JobStructureForm({ jobId, jobNumber }: JobStructureFormProps) {
  const [structureType, setStructureType] =
    useState<StructureType>("CONFIGURABLE_PRODUCT");
  const [needsSubmittal, setNeedsSubmittal] = useState(false);
  const [needsCutSheet, setNeedsCutSheet] = useState(false);

  useEffect(() => {
    if (structureType === "CUSTOM_STRUCTURE") {
      setNeedsSubmittal(true);
      setNeedsCutSheet(true);
    }
  }, [structureType]);

  return (
    <form action={createJobStructure} className="space-y-4">
      <input type="hidden" name="jobId" value={jobId} />

      <SectionCard
        title="Structure Details"
        description={`This structure will be added to job ${jobNumber} as Not Submitted.`}
      >
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
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
                step="0.0001"
                defaultValue="1"
                className={structureInputClassName}
              />
            </div>

            <div>
              <label
                htmlFor="unit"
                className="block text-xs font-medium text-slate-700"
              >
                Unit
              </label>
              <input
                id="unit"
                name="unit"
                type="text"
                placeholder="EA"
                defaultValue="EA"
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
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                name="needsCutSheet"
                checked={needsCutSheet}
                onChange={(event) => setNeedsCutSheet(event.target.checked)}
                className="rounded"
              />
              Needs cut sheet
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                name="needsSubmittal"
                checked={needsSubmittal}
                onChange={(event) => setNeedsSubmittal(event.target.checked)}
                className="rounded"
              />
              Needs submittal
            </label>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Notes">
        <textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Production or detailing notes for this structure."
          className={structureInputClassName}
        />
      </SectionCard>

      <div className="flex flex-wrap justify-end gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
        <Link
          href={`/jobs/${jobId}?tab=production`}
          className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
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
