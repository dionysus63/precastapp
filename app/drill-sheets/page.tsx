import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { PaginationControls } from "@/components/common/pagination-controls";
import { formatFeetInches } from "@/lib/drill-sheet";
import { formatUsd } from "@/lib/format";
import { withDatabaseRetry } from "@/lib/prisma";
import {
  buildPageInfo,
  parsePageParam,
  type RawSearchParams,
} from "@/lib/list-params";
import type { Prisma } from "@/app/generated/prisma/client";

import {
  tableBodyClassName,
  tableCellBordersClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";
const where: Prisma.JobStructureWhereInput = {
  structureTemplateId: { not: null },
};

export default async function DrillSheetsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const requestedPage = parsePageParam(params.page);

  const total = await withDatabaseRetry((prisma) =>
    prisma.jobStructure.count({ where }),
  );
  const pageInfo = buildPageInfo(total, requestedPage);

  const sheets = await withDatabaseRetry((prisma) =>
    prisma.jobStructure.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pageInfo.skip,
      take: pageInfo.take,
      select: {
        id: true,
        structureNumber: true,
        structureTemplate: { select: { name: true, shape: true } },
        calc: {
          select: {
            insideDiameterFeet: true,
            insideLengthFeet: true,
            insideWidthFeet: true,
            wallHeightFeet: true,
            totalPrice: true,
            projectName: true,
          },
        },
        job: { select: { projectName: true } },
      },
    }),
  );

  return (
    <DashboardShell
      title="Drill Sheet Workbook"
      subtitle="Build and review circular manhole and rectangular structure sheets."
    >
      <div className="mb-4 flex justify-end gap-2">
        <Link
          href="/drill-sheets/rect/new"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          New Rect Sheet
        </Link>
        <Link
          href="/drill-sheets/new"
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
        >
          New Drill Sheet
        </Link>
      </div>

      <SectionCard
        title="Drill Sheets"
        description={`${pageInfo.total.toLocaleString()} sheet${pageInfo.total === 1 ? "" : "s"}`}
        noPadding
      >
        <div className={tableFlushWrapperClassName}>
          <table className={tableClassName}>
            <thead>
              <tr>
                <th className={tableHeaderCellClassName}>Structure #</th>
                <th className={tableHeaderCellClassName}>Template</th>
                <th className={tableHeaderCellClassName}>Size</th>
                <th className={tableHeaderCellClassName}>Wall Height</th>
                <th className={tableHeaderCellClassName}>Price</th>
                <th className={tableHeaderCellClassName}>Project</th>
                <th className={tableHeaderCellClassName}>Actions</th>
              </tr>
            </thead>
            <tbody className={tableBodyClassName}>
              {sheets.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className={`${tableCellBordersClassName} px-4 py-8 text-center text-sm text-slate-500`}
                  >
                    No drill sheets yet. Create one to get started.
                  </td>
                </tr>
              ) : (
                sheets.map((sheet) => (
                  <tr key={sheet.id} className={tableRowClassName}>
                    <td className={`${tableCellClassName} font-medium text-slate-900`}>
                      {sheet.structureNumber ?? "—"}
                    </td>
                    <td className={`${tableCellClassName} text-slate-600`}>
                      {sheet.structureTemplate?.name ?? "—"}
                    </td>
                    <td className={`${tableCellClassName} text-slate-600`}>
                      {sheet.structureTemplate?.shape === "RECTANGULAR"
                        ? sheet.calc?.insideLengthFeet != null &&
                          sheet.calc?.insideWidthFeet != null
                          ? `${formatFeetInches(Number(sheet.calc.insideLengthFeet))} x ${formatFeetInches(Number(sheet.calc.insideWidthFeet))}`
                          : "—"
                        : sheet.calc?.insideDiameterFeet != null
                          ? formatFeetInches(Number(sheet.calc.insideDiameterFeet))
                          : "—"}
                    </td>
                    <td className={`${tableCellClassName} text-slate-600 tabular-nums`}>
                      {sheet.calc?.wallHeightFeet != null
                        ? formatFeetInches(Number(sheet.calc.wallHeightFeet))
                        : "—"}
                    </td>
                    <td className={`${tableCellClassName} text-slate-600 tabular-nums`}>
                      {sheet.calc?.totalPrice != null
                        ? formatUsd(Number(sheet.calc.totalPrice))
                        : "—"}
                    </td>
                    <td className={`${tableCellClassName} text-slate-600`}>
                      {sheet.calc?.projectName ?? sheet.job?.projectName ?? "—"}
                    </td>
                    <td className={tableCellClassName}>
                      <div className="flex gap-1.5">
                        <Link
                          href={`/drill-sheets/${sheet.id}`}
                          className="inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                        >
                          View
                        </Link>
                        <Link
                          href={
                            sheet.structureTemplate?.shape === "RECTANGULAR"
                              ? `/drill-sheets/rect/${sheet.id}/edit`
                              : `/drill-sheets/${sheet.id}/edit`
                          }
                          className="inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={pageInfo.page}
          totalPages={pageInfo.totalPages}
          fromIndex={pageInfo.fromIndex}
          toIndex={pageInfo.toIndex}
          total={pageInfo.total}
          noun="sheet"
        />
      </SectionCard>
    </DashboardShell>
  );
}
