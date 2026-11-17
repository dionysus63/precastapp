import Link from "next/link";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { DrillSheetPdfLink } from "@/components/drill-sheets/drill-sheet-pdf-link";
import {
  overviewEmptyCellClassName,
  overviewTableWrapperClassName,
} from "@/components/jobs/overview/overview-styles";
import { StructureStatusSelect } from "@/components/jobs/overview/structure-status-select";
import { StructureManageLink } from "@/components/jobs/structure-manage-link";
import type { JobOverviewStructure } from "@/lib/job-overview";
import {
  tableActionButtonClassName,
  tableBodyClassName,
  tableCellClassName,
  tableCompactClassName,
  tableHeaderCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";

const COLUMN_COUNT = 7;

/**
 * The job's structures on the Overview: what still needs work first, with a
 * status dropdown and the drill sheet one click away.
 */
export function JobOverviewStructures({
  jobId,
  structures,
  canManageProduction,
}: {
  jobId: string;
  structures: JobOverviewStructure[];
  /** Change a structure's status. */
  canManageProduction: boolean;
}) {
  return (
    <div className={overviewTableWrapperClassName}>
      <table className={tableCompactClassName}>
        <thead>
          <tr>
            <th className={tableHeaderCellClassName}>Structure</th>
            <th className={tableHeaderCellClassName}>Description</th>
            <th className={tableHeaderCellClassName}>Qty</th>
            <th className={tableHeaderCellClassName}>Status</th>
            <th className={tableHeaderCellClassName}>Made</th>
            <th className={tableHeaderCellClassName}>Shipped</th>
            <th className={tableHeaderCellClassName}>Actions</th>
          </tr>
        </thead>
        <tbody className={tableBodyClassName}>
          {structures.length === 0 ? (
            <tr>
              <td colSpan={COLUMN_COUNT} className={overviewEmptyCellClassName}>
                No structures on this job yet.
              </td>
            </tr>
          ) : (
            structures.map((structure) => {
              const shipped = structure.status === "SHIPPED";
              return (
                <tr key={structure.id} className={tableRowClassName}>
                  <td
                    className={`${tableCellClassName} whitespace-nowrap font-medium text-slate-900`}
                  >
                    <StructureManageLink
                      jobId={jobId}
                      structureId={structure.id}
                    >
                      {structure.structureNumber}
                    </StructureManageLink>
                  </td>
                  <td className={`${tableCellClassName} max-w-[16rem] text-slate-700`}>
                    {structure.description}
                  </td>
                  <td className={`${tableCellClassName} text-slate-700`}>
                    {structure.quantity}
                  </td>
                  <td className={`${tableCellClassName} whitespace-nowrap`}>
                    {structure.needsDrillSheet ? (
                      <StatusBadge label="Needs drill sheet" variant="warning" />
                    ) : canManageProduction && !shipped ? (
                      <StructureStatusSelect
                        jobId={jobId}
                        structureId={structure.id}
                        structureNumber={structure.structureNumber}
                        status={structure.status}
                      />
                    ) : (
                      <StatusBadge
                        label={structure.statusLabel}
                        variant={structure.statusVariant}
                      />
                    )}
                  </td>
                  <td
                    className={`${tableCellClassName} whitespace-nowrap text-slate-600`}
                  >
                    {structure.madeProgress ? (
                      <span className="font-medium text-slate-800">
                        {structure.madeProgress}
                      </span>
                    ) : (
                      structure.madeDate
                    )}
                  </td>
                  <td
                    className={`${tableCellClassName} whitespace-nowrap text-slate-600`}
                  >
                    {!shipped && structure.onLoad ? (
                      <Link
                        href={`/delivery-tickets/${structure.onLoad.ticketId}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        On {structure.onLoad.label}
                      </Link>
                    ) : (
                      structure.shippedDate
                    )}
                  </td>
                  <td className={tableCellClassName}>
                    <div className="flex flex-wrap gap-1.5">
                      <StructureManageLink
                        jobId={jobId}
                        structureId={structure.id}
                        className={tableActionButtonClassName}
                      >
                        Open
                      </StructureManageLink>
                      {structure.createDrillSheetHref ? (
                        <Link
                          href={structure.createDrillSheetHref}
                          className={tableActionButtonClassName}
                        >
                          Create Drill Sheet
                        </Link>
                      ) : null}
                      {structure.drillSheetId ? (
                        <>
                          <DrillSheetPdfLink
                            drillSheetId={structure.drillSheetId}
                            label="Sheet PDF"
                            className={tableActionButtonClassName}
                          />
                          <Link
                            href={`/drill-sheets/${structure.drillSheetId}`}
                            className={tableActionButtonClassName}
                          >
                            Edit Sheet
                          </Link>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
