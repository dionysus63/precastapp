"use client";

import { useTransition } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  approveStructureForProduction,
  markStructureMade,
  startStructureProduction,
} from "@/app/operations/actions";

export type ProductionQueueItem = {
  id: string;
  structureNumber: string | null;
  description: string | null;
  status: string;
  quantity: string | null;
  unit: string | null;
  jobNumber: string | null;
  projectName: string | null;
  quoteNumber: string | null;
  productCode: string | null;
  productName: string | null;
};

type ProductionQueueProps = {
  items: ProductionQueueItem[];
};

export function ProductionQueue({ items }: ProductionQueueProps) {
  const [pending, startTransition] = useTransition();

  function runAction(action: () => Promise<unknown>) {
    startTransition(() => {
      void action();
    });
  }

  return (
    <SectionCard
      title="In Production Queue"
      description="Configurable and custom structures approved or actively in production."
      noPadding
    >
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
                      {item.structureNumber ?? item.productCode ?? "—"}
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
        To approve new structures, mark a quote as{" "}
        <strong className="font-medium text-slate-700">WON</strong> and use{" "}
        <strong className="font-medium text-slate-700">Link structures</strong>{" "}
        on the quote detail page.
      </div>
    </SectionCard>
  );
}

export function ApproveStructuresPanel({
  pendingStructures,
}: {
  pendingStructures: ProductionQueueItem[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <SectionCard
      title="Awaiting Approval"
      description="Submitted structures ready for production approval."
      noPadding
    >
      {pendingStructures.length === 0 ? (
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
                  {item.structureNumber ?? "Structure"}
                </div>
                <div className="text-slate-500">{item.description}</div>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(() =>
                    approveStructureForProduction(item.id),
                  )
                }
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
