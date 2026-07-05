"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  markStructureMade,
  startStructureProduction,
} from "@/app/operations/actions";
import { StructureManageLink } from "@/components/jobs/structure-manage-link";
import { DrillSheetPdfLink } from "@/components/drill-sheets/drill-sheet-pdf-link";
import {
  ApproveForProductionDialog,
  type ApproveForProductionTarget,
} from "@/components/production/approve-for-production-dialog";

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
  usedGeneratedSubmittalForApproval: boolean;
  madeDate: string | null;
  drillSheetId: string | null;
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

function StructureQueueTable({
  items,
  showApprovalSource,
  renderActions,
}: {
  items: ProductionQueueItem[];
  showApprovalSource?: boolean;
  renderActions: (item: ProductionQueueItem) => ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs">
        <thead className="border-b border-slate-100 bg-slate-50/80 text-slate-600">
          <tr>
            <th className="px-4 py-2 font-semibold">Structure</th>
            <th className="px-4 py-2 font-semibold">Job</th>
            <th className="px-4 py-2 font-semibold">Quote</th>
            <th className="px-4 py-2 font-semibold">Qty</th>
            {showApprovalSource ? (
              <th className="px-4 py-2 font-semibold">Approval</th>
            ) : (
              <th className="px-4 py-2 font-semibold">Status</th>
            )}
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
                {showApprovalSource ? (
                  <StatusBadge
                    label={
                      item.usedGeneratedSubmittalForApproval
                        ? "Generated / verbal"
                        : "Signed"
                    }
                  />
                ) : (
                  <StatusBadge label={item.status.replace(/_/g, " ")} />
                )}
              </td>
              <td className="px-4 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {renderActions(item)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function useProductionAction() {
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

  return { pending, error, runAction };
}

export function ApprovedNotInProductionPanel({
  items,
}: {
  items: ProductionQueueItem[];
}) {
  const { pending, error, runAction } = useProductionAction();

  return (
    <SectionCard
      title="Approved — Not in Production"
      description="Structures approved for production waiting to be started on the shop floor."
      noPadding
    >
      {error ? (
        <p className="px-4 py-2 text-xs font-medium text-red-600">{error}</p>
      ) : null}
      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">
          No approved structures waiting to start production.
        </p>
      ) : (
        <StructureQueueTable
          items={items}
          showApprovalSource
          renderActions={(item) => (
            <>
              {item.drillSheetId ? (
                <DrillSheetPdfLink
                  drillSheetId={item.drillSheetId}
                  label="Drill Sheet PDF"
                />
              ) : null}
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  runAction(() => startStructureProduction(item.id))
                }
                className="rounded border border-slate-200 px-2 py-1 text-[11px] hover:bg-slate-50 disabled:opacity-50"
              >
                Start
              </button>
            </>
          )}
        />
      )}
      <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
        Click Start when fabrication begins to move a structure into active
        production.
      </div>
    </SectionCard>
  );
}

export function InProductionPanel({ items }: { items: ProductionQueueItem[] }) {
  const { pending, error, runAction } = useProductionAction();

  return (
    <SectionCard
      title="In Production"
      description="Structures actively being fabricated."
      noPadding
    >
      {error ? (
        <p className="px-4 py-2 text-xs font-medium text-red-600">{error}</p>
      ) : null}
      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">
          No structures currently in production.
        </p>
      ) : (
        <StructureQueueTable
          items={items}
          renderActions={(item) => (
            <>
              {item.drillSheetId ? (
                <DrillSheetPdfLink
                  drillSheetId={item.drillSheetId}
                  label="Drill Sheet PDF"
                />
              ) : null}
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
            </>
          )}
        />
      )}
      <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
        Check Made when fabrication is complete and the structure is ready to
        ship.
      </div>
    </SectionCard>
  );
}

export function ReadyToShipPanel({ items }: { items: ProductionQueueItem[] }) {
  return (
    <SectionCard
      title="Ready to Ship"
      description="Job-specific structures made and waiting to be shipped."
      noPadding
    >
      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">
          No structures waiting to ship.
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
                <th className="px-4 py-2 font-semibold">Made</th>
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
                  <td className="px-4 py-2">{item.madeDate ?? "—"}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.drillSheetId ? (
                        <DrillSheetPdfLink
                          drillSheetId={item.drillSheetId}
                          label="Drill Sheet PDF"
                        />
                      ) : null}
                      {item.jobId ? (
                        <Link
                          href={`/jobs/${item.jobId}?tab=deliveries`}
                          className="rounded border border-slate-200 px-2 py-1 text-[11px] hover:bg-slate-50"
                        >
                          Deliveries
                        </Link>
                      ) : null}
                      {!item.jobId && !item.drillSheetId ? "—" : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
        Schedule loads from{" "}
        <Link href="/delivery-tickets" className="font-medium text-slate-700 hover:underline">
          Delivery Tickets
        </Link>
        . Structures move to shipped when their ticket is marked delivered.
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
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [approveTarget, setApproveTarget] =
    useState<ApproveForProductionTarget | null>(null);
  const hasItems =
    pendingStructures.length > 0 || skippableStructures.length > 0;

  function openApproveDialog(item: ProductionQueueItem) {
    setError(null);
    setApproveTarget({
      id: item.id,
      structureNumber: item.structureNumber,
      description: item.description,
      needsSubmittal: item.needsSubmittal,
    });
  }

  function renderRow(item: ProductionQueueItem, skippable: boolean) {
    return (
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
            {skippable ? (
              <span className="block text-[10px] text-slate-400">
                No submittal required
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {item.drillSheetId ? (
            <DrillSheetPdfLink
              drillSheetId={item.drillSheetId}
              label="Drill Sheet PDF"
              className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] font-medium text-sky-800 hover:bg-sky-100"
            />
          ) : null}
          {!skippable && item.jobId ? (
            <Link
              href={`/jobs/${item.jobId}/structures/${item.id}#submittals`}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-medium hover:bg-slate-50"
            >
              View
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => openApproveDialog(item)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium hover:bg-slate-50"
          >
            Approve for production
          </button>
        </div>
      </li>
    );
  }

  return (
    <>
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
            {pendingStructures.map((item) => renderRow(item, false))}
            {skippableStructures.map((item) => renderRow(item, true))}
          </ul>
        )}
      </SectionCard>

      {approveTarget ? (
        <ApproveForProductionDialog
          target={approveTarget}
          onClose={() => setApproveTarget(null)}
          onSuccess={() => router.refresh()}
        />
      ) : null}
    </>
  );
}
