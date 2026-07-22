"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { reloadAfterAction } from "@/lib/reload-after-action";
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

import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableHeaderCellClassName,
} from "@/lib/table-styles";

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
  customerName: string | null;
  quoteNumber: string | null;
  productCode: string | null;
  productName: string | null;
  needsSubmittal: boolean;
  usedGeneratedSubmittalForApproval: boolean;
  madeDate: string | null;
  productionDate: string | null;
  submittedDate: string | null;
  drillSheetId: string | null;
  /** Awaiting-approval tab: NOT_SUBMITTED structures that skip submittals. */
  noSubmittalRequired?: boolean;
  /** Needs-drill-sheet tab: where "Create drill sheet" should link. */
  createDrillSheetHref?: string | null;
  /** Needs-drill-sheet tab: bulk-complete workbook for the whole quote. */
  completeWorkbookHref?: string | null;
};

export type ProductionTabId =
  | "approved"
  | "in-production"
  | "ready-to-ship"
  | "needs-submittal"
  | "needs-drill-sheet"
  | "awaiting-approval";

const TABS: {
  id: ProductionTabId;
  label: string;
  title: string;
  description: string;
  detailHeader: string;
  emptyMessage: string;
  hint: string | null;
}[] = [
  {
    id: "approved",
    label: "Approved",
    title: "Approved — not in production",
    description: "Structures approved for production waiting to be started on the shop floor.",
    detailHeader: "Approval",
    emptyMessage: "No approved structures waiting to start production.",
    hint: "Click Start when fabrication begins to move a structure into active production.",
  },
  {
    id: "in-production",
    label: "In production",
    title: "In production",
    description: "Structures actively being fabricated.",
    detailHeader: "Started",
    emptyMessage: "No structures currently in production.",
    hint: "Check Made when fabrication is complete and the structure is ready to ship.",
  },
  {
    id: "ready-to-ship",
    label: "Ready to ship",
    title: "Ready to ship",
    description: "Job-specific structures made and waiting to be shipped.",
    detailHeader: "Made",
    emptyMessage: "No structures waiting to ship.",
    hint: "Schedule loads from the Delivery Hub. Structures move to shipped when their ticket is marked delivered.",
  },
  {
    id: "needs-submittal",
    label: "Needs submittal",
    title: "Needs submittal",
    description: "Custom structures waiting for a job-specific submittal upload.",
    detailHeader: "Submittal",
    emptyMessage: "No structures waiting for submittals.",
    hint: null,
  },
  {
    id: "needs-drill-sheet",
    label: "Needs drill sheet",
    title: "Needs drill sheet",
    description:
      "Structures quoted without drill-sheet detail. Create the cut sheet before they can be approved for production.",
    detailHeader: "Quoted",
    emptyMessage: "No structures waiting on drill sheets.",
    hint: "Create drill sheet opens the sheet editor pre-filled from the quote. Saving upgrades the structure in place — quote link, status, and documents are kept.",
  },
  {
    id: "awaiting-approval",
    label: "Awaiting approval",
    title: "Awaiting approval",
    description: "Submitted structures ready for production approval.",
    detailHeader: "Submitted",
    emptyMessage: "None awaiting approval.",
    hint: null,
  },
];

type JobGroup = {
  key: string;
  jobId: string | null;
  jobNumber: string | null;
  projectName: string | null;
  customerName: string | null;
  items: ProductionQueueItem[];
};

/** Group items by job, preserving the queue's priority order. */
function groupByJob(items: ProductionQueueItem[]): JobGroup[] {
  const groups = new Map<string, JobGroup>();
  for (const item of items) {
    const key = item.jobId ?? "__none__";
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(key, {
        key,
        jobId: item.jobId,
        jobNumber: item.jobNumber,
        projectName: item.projectName,
        customerName: item.customerName,
        items: [item],
      });
    }
  }
  const list = [...groups.values()];
  // Stock/no-job structures sink to the bottom.
  return [
    ...list.filter((group) => group.jobId),
    ...list.filter((group) => !group.jobId),
  ];
}

function isProductionTabId(value: string | undefined): value is ProductionTabId {
  return TABS.some((tab) => tab.id === value);
}

export function ProductionBoard({
  approved,
  inProduction,
  readyToShip,
  needsSubmittal,
  needsDrillSheet,
  awaitingApproval,
  initialTab,
}: {
  approved: ProductionQueueItem[];
  inProduction: ProductionQueueItem[];
  readyToShip: ProductionQueueItem[];
  needsSubmittal: ProductionQueueItem[];
  needsDrillSheet: ProductionQueueItem[];
  awaitingApproval: ProductionQueueItem[];
  initialTab?: string;
}) {
  const itemsByTab: Record<ProductionTabId, ProductionQueueItem[]> = useMemo(
    () => ({
      approved,
      "in-production": inProduction,
      "ready-to-ship": readyToShip,
      "needs-submittal": needsSubmittal,
      "needs-drill-sheet": needsDrillSheet,
      "awaiting-approval": awaitingApproval,
    }),
    [
      approved,
      inProduction,
      readyToShip,
      needsSubmittal,
      needsDrillSheet,
      awaitingApproval,
    ],
  );

  const defaultTab: ProductionTabId = isProductionTabId(initialTab)
    ? initialTab
    : TABS.find((tab) => itemsByTab[tab.id].length > 0)?.id ?? "approved";

  const [activeTab, setActiveTab] = useState<ProductionTabId>(defaultTab);
  // Expanded groups, keyed `${tabId}:${jobKey}` so each tab keeps its own state.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [approveTarget, setApproveTarget] =
    useState<ApproveForProductionTarget | null>(null);

  const tab = TABS.find((entry) => entry.id === activeTab) ?? TABS[0];
  const items = itemsByTab[tab.id];
  const groups = useMemo(() => groupByJob(items), [items]);
  const allExpanded =
    groups.length > 0 &&
    groups.every((group) => expanded.has(`${tab.id}:${group.key}`));

  function selectTab(id: ProductionTabId) {
    setActiveTab(id);
    setActionError(null);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", id);
    window.history.replaceState(null, "", url.toString());
  }

  function toggleGroup(groupKey: string) {
    const key = `${tab.id}:${groupKey}`;
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function setAllExpanded(open: boolean) {
    setExpanded((current) => {
      const next = new Set(current);
      for (const group of groups) {
        const key = `${tab.id}:${group.key}`;
        if (open) {
          next.add(key);
        } else {
          next.delete(key);
        }
      }
      return next;
    });
  }

  function runAction(action: () => Promise<{ error?: string } | unknown>) {
    setActionError(null);
    startTransition(async () => {
      const result = await action();
      if (
        result &&
        typeof result === "object" &&
        "error" in result &&
        result.error
      ) {
        setActionError(String(result.error));
      }
    });
  }

  function renderDetail(item: ProductionQueueItem): ReactNode {
    switch (tab.id) {
      case "approved":
        return (
          <StatusBadge
            label={
              item.usedGeneratedSubmittalForApproval
                ? "Generated / verbal"
                : "Signed"
            }
          />
        );
      case "in-production":
        return item.productionDate ?? "—";
      case "ready-to-ship":
        return item.madeDate ?? "—";
      case "needs-submittal":
        return <span className="text-slate-500">Awaiting upload</span>;
      case "needs-drill-sheet":
        return item.quoteNumber ? (
          <span className="text-slate-500">{item.quoteNumber}</span>
        ) : (
          <span className="text-slate-500">Quote only — no cut sheet</span>
        );
      case "awaiting-approval":
        return item.noSubmittalRequired ? (
          <span className="text-slate-500">No submittal required</span>
        ) : (
          item.submittedDate ?? "—"
        );
    }
  }

  function renderActions(item: ProductionQueueItem): ReactNode {
    const drillSheet = item.drillSheetId ? (
      <DrillSheetPdfLink drillSheetId={item.drillSheetId} label="Drill Sheet PDF" />
    ) : null;

    switch (tab.id) {
      case "approved":
        return (
          <>
            {drillSheet}
            <button
              type="button"
              disabled={pending}
              onClick={() => runAction(() => startStructureProduction(item.id))}
              className="rounded border border-slate-200 px-2 py-1 text-[11px] hover:bg-slate-50 disabled:opacity-50"
            >
              Start
            </button>
          </>
        );
      case "in-production":
        return (
          <>
            {drillSheet}
            <label className="flex items-center gap-1 text-[11px]">
              <input
                type="checkbox"
                disabled={pending}
                onChange={() => runAction(() => markStructureMade(item.id))}
              />
              Made
            </label>
          </>
        );
      case "ready-to-ship":
        return (
          <>
            {drillSheet}
            {item.jobId ? (
              <Link
                href={`/jobs/${item.jobId}?tab=deliveries`}
                className="rounded border border-slate-200 px-2 py-1 text-[11px] hover:bg-slate-50"
              >
                Deliveries
              </Link>
            ) : null}
            {!item.jobId && !item.drillSheetId ? "—" : null}
          </>
        );
      case "needs-submittal":
        return item.jobId ? (
          <Link
            href={`/jobs/${item.jobId}/structures/${item.id}#submittals`}
            className="rounded border border-slate-200 px-2 py-1 text-[11px] font-medium hover:bg-slate-50"
          >
            Add submittal
          </Link>
        ) : (
          "—"
        );
      case "needs-drill-sheet":
        return item.createDrillSheetHref ? (
          <>
            <Link
              href={item.createDrillSheetHref}
              className="rounded border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-100"
            >
              Create drill sheet
            </Link>
            {item.completeWorkbookHref ? (
              <Link
                href={item.completeWorkbookHref}
                className="rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
              >
                Complete all in workbook
              </Link>
            ) : null}
          </>
        ) : item.jobId ? (
          <Link
            href={`/jobs/${item.jobId}/structures/${item.id}`}
            className="rounded border border-slate-200 px-2 py-1 text-[11px] hover:bg-slate-50"
          >
            Open structure
          </Link>
        ) : (
          "—"
        );
      case "awaiting-approval":
        return (
          <>
            {drillSheet}
            {!item.noSubmittalRequired && item.jobId ? (
              <Link
                href={`/jobs/${item.jobId}/structures/${item.id}#submittals`}
                className="rounded border border-slate-200 px-2 py-1 text-[11px] hover:bg-slate-50"
              >
                View
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setActionError(null);
                setApproveTarget({
                  id: item.id,
                  structureNumber: item.structureNumber,
                  description: item.description,
                  needsSubmittal: item.needsSubmittal,
                });
              }}
              className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium hover:bg-slate-50"
            >
              Approve for production
            </button>
          </>
        );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((entry) => {
          const isActive = entry.id === activeTab;
          const count = itemsByTab[entry.id].length;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => selectTab(entry.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                isActive
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {entry.label}{" "}
              <span className={isActive ? "text-slate-300" : "text-slate-400"}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <SectionCard
        title={tab.title}
        description={tab.description}
        noPadding
        action={
          <div className="flex items-center gap-3">
            {tab.id === "needs-submittal" ? (
              <Link
                href="/production/attach?mode=submittals"
                className="text-xs font-medium text-sky-700 hover:text-sky-900"
              >
                Bulk add submittals →
              </Link>
            ) : tab.id === "awaiting-approval" ? (
              <Link
                href="/production/attach?mode=approvals"
                className="text-xs font-medium text-sky-700 hover:text-sky-900"
              >
                Bulk approve with signed files →
              </Link>
            ) : null}
            {groups.length > 0 ? (
              <button
                type="button"
                onClick={() => setAllExpanded(!allExpanded)}
                className="text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                {allExpanded ? "Collapse all" : "Expand all"}
              </button>
            ) : null}
          </div>
        }
      >
        {actionError ? (
          <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs font-medium text-red-700">
            {actionError}
          </p>
        ) : null}
        {groups.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">{tab.emptyMessage}</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {groups.map((group) => {
              const isOpen = expanded.has(`${tab.id}:${group.key}`);
              return (
                <div key={group.key}>
                  <div className="flex items-center gap-2.5 px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.key)}
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? "Collapse" : "Expand"} ${group.jobNumber ?? "ungrouped"} structures`}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <span
                        className={`text-[10px] transition-transform ${isOpen ? "rotate-90" : ""}`}
                      >
                        ▶
                      </span>
                    </button>
                    {group.jobId ? (
                      <Link
                        href={`/jobs/${group.jobId}`}
                        className="truncate text-xs font-semibold text-sky-700 hover:underline"
                      >
                        {group.jobNumber} — {group.projectName}
                      </Link>
                    ) : (
                      <span className="text-xs font-semibold text-slate-700">
                        No job
                      </span>
                    )}
                    {group.customerName ? (
                      <span className="truncate text-[11px] text-slate-500">
                        {group.customerName}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.key)}
                      className="ml-auto shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100"
                    >
                      {group.items.length} structure
                      {group.items.length === 1 ? "" : "s"}
                    </button>
                  </div>
                  {isOpen ? (
                    <div className="border-t border-slate-100">
                      <table className={tableClassName}>
                        <thead>
                          <tr>
                            <th className={tableHeaderCellClassName}>Structure</th>
                            <th className={tableHeaderCellClassName}>Description</th>
                            <th className={tableHeaderCellClassName}>Qty</th>
                            <th className={tableHeaderCellClassName}>
                              {tab.detailHeader}
                            </th>
                            <th className={tableHeaderCellClassName}>Actions</th>
                          </tr>
                        </thead>
                        <tbody className={tableBodyClassName}>
                          {group.items.map((item) => (
                            <tr key={item.id} className="text-slate-800">
                              <td className={tableCellClassName}>
                                <StructureManageLink
                                  jobId={item.jobId}
                                  structureId={item.id}
                                >
                                  {item.structureNumber ?? item.productCode ?? "—"}
                                </StructureManageLink>
                              </td>
                              <td className={`${tableCellClassName} text-slate-600`}>
                                {item.description ?? item.productName ?? "—"}
                              </td>
                              <td className={tableCellClassName}>
                                {item.quantity ?? "—"} {item.unit ?? ""}
                              </td>
                              <td className={tableCellClassName}>
                                {renderDetail(item)}
                              </td>
                              <td className={tableCellClassName}>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {renderActions(item)}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
        {tab.hint ? (
          <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            {tab.hint}
          </div>
        ) : null}
      </SectionCard>

      {approveTarget ? (
        <ApproveForProductionDialog
          target={approveTarget}
          onClose={() => setApproveTarget(null)}
          onSuccess={() => reloadAfterAction()}
        />
      ) : null}
    </div>
  );
}
