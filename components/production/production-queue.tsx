"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  approveStructureForProduction,
  markStructureMade,
  startStructureProduction,
} from "@/app/operations/actions";
import { StructureManageLink } from "@/components/jobs/structure-manage-link";

export type ProductionQueueItem = {
  id: string;
  structureNumber: string | null;
  description: string | null;
  status: string;
  quantity: string | null;
  unit: string | null;
  jobId: string | null;
  jobNumber: string | null;
  projectName: string | null;
  quoteNumber: string | null;
  productCode: string | null;
  productName: string | null;
  needsSubmittal: boolean;
};

function StructurePrimaryName({ item }: { item: ProductionQueueItem }) {
  const label = item.structureNumber ?? item.productCode ?? "—";

  if (item.jobId && item.structureNumber) {
    return (
      <StructureManageLink jobId={item.jobId} structureId={item.id}>
        {label}
      </StructureManageLink>
    );
  }

  return <span>{label}</span>;
}

type ProductionQueueProps = {
  items: ProductionQueueItem[];
};

export function ProductionQueue({ items }: ProductionQueueProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function runAction(action: () => Promise<{ error?: string } | unknown>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result && typeof result === "object" && "error" in result && result.error) {
        setError(String(result.error));
      }
    });
  }

  return (
    <SectionCard
      title="In Production Queue"
      description="Configurable and custom structures approved or actively in production."
      noPadding
    >
      {error ? (
        <p className="px-4 py-2 text-xs font-medium text-red-600">{error}</p>
      ) : null}
      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">
          No structures in production. Approve structures from a won quote to
          start.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-slate-600">
              <tr>
                <th className="px-4 py-2 font-semibold">Structure</th>
                <th className="px-4 py-2 font-semibold">Job</th>
                <th className="px-4 py-2 font-semibold">Quote</th>
                <th className="px-4 py-2 font-semibold">Qty</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className="text-slate-800">
                  <td className="px-4 py-2">
                    <div className="font-medium text-slate-900">
                      <StructurePrimaryName item={item} />
                    </div>
                    <div className="text-slate-500">
                      {item.description ?? item.productName ?? "—"}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    {item.jobNumber ? (
                      <span>
                        {item.jobNumber}
                        <span className="block text-slate-500">
                          {item.projectName}
                        </span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2">{item.quoteNumber ?? "—"}</td>
                  <td className="px-4 py-2">
                    {item.quantity ?? "—"} {item.unit ?? ""}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge label={item.status.replace(/_/g, " ")} />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {item.status === "APPROVED" ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            runAction(() =>
                              startStructureProduction(item.id),
                            )
                          }
                          className="rounded border border-slate-200 px-2 py-1 text-[11px] hover:bg-slate-50 disabled:opacity-50"
                        >
                          Start
                        </button>
                      ) : null}
                      {item.status === "IN_PRODUCTION" ? (
                        <label className="flex items-center gap-1 text-[11px]">
                          <input
                            type="checkbox"
                            disabled={pending}
                            onChange={() =>
                              runAction(() => markStructureMade(item.id))
                            }
                          />
                          Made
                        </label>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
        Approve submitted structures, then start production and mark them made.
        Custom structures need submittals uploaded on the structure detail page
        first.
      </div>
    </SectionCard>
  );
}

export function NeedsSubmittalPanel({
  structures,
}: {
  structures: ProductionQueueItem[];
}) {
  return (
    <SectionCard
      title="Needs Submittal"
      description="Custom structures waiting for a job-specific submittal upload."
      noPadding
    >
      {structures.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">
          No structures waiting for submittals.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {structures.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 px-4 py-3 text-xs"
            >
              <div>
                <div className="font-medium text-slate-900">
                  <StructureManageLink jobId={item.jobId} structureId={item.id}>
                    {item.structureNumber ?? "Structure"}
                  </StructureManageLink>
                </div>
                <div className="text-slate-500">
                  {item.jobNumber ? `${item.jobNumber} — ` : ""}
                  {item.description ?? "—"}
                </div>
              </div>
              {item.jobId ? (
                <Link
                  href={`/jobs/${item.jobId}/structures/${item.id}#submittals`}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium hover:bg-slate-50"
                >
                  Add submittal
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function ApproveStructuresPanel({
  pendingStructures,
  skippableStructures = [],
}: {
  pendingStructures: ProductionQueueItem[];
  skippableStructures?: ProductionQueueItem[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const hasItems =
    pendingStructures.length > 0 || skippableStructures.length > 0;

  function approve(structureId: string) {
    setError(null);
    startTransition(async () => {
      const result = await approveStructureForProduction(structureId);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <SectionCard
      title="Awaiting Approval"
      description="Submitted structures ready for production approval."
      noPadding
    >
      {error ? (
        <p className="px-4 py-2 text-xs font-medium text-red-600">{error}</p>
      ) : null}
      {!hasItems ? (
        <p className="px-4 py-6 text-sm text-slate-500">None awaiting approval.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {pendingStructures.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 px-4 py-3 text-xs"
            >
              <div>
                <div className="font-medium text-slate-900">
                  <StructureManageLink jobId={item.jobId} structureId={item.id}>
                    {item.structureNumber ?? "Structure"}
                  </StructureManageLink>
                </div>
                <div className="text-slate-500">{item.description}</div>
              </div>
              <div className="flex items-center gap-2">
                {item.jobId ? (
                  <Link
                    href={`/jobs/${item.jobId}/structures/${item.id}#submittals`}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-medium hover:bg-slate-50"
                  >
                    View
                  </Link>
                ) : null}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => approve(item.id)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium hover:bg-slate-50 disabled:opacity-50"
                >
                  Approve for production
                </button>
              </div>
            </li>
          ))}
          {skippableStructures.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 px-4 py-3 text-xs"
            >
              <div>
                <div className="font-medium text-slate-900">
                  <StructureManageLink jobId={item.jobId} structureId={item.id}>
                    {item.structureNumber ?? "Structure"}
                  </StructureManageLink>
                </div>
                <div className="text-slate-500">
                  {item.description}
                  <span className="block text-[10px] text-slate-400">
                    No submittal required
                  </span>
                </div>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => approve(item.id)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                Approve for production
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
