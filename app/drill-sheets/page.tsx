import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { PaginationControls } from "@/components/common/pagination-controls";
import { formatFeetInches } from "@/lib/drill-sheet";
import { withDatabaseRetry } from "@/lib/prisma";
import {
  buildPageInfo,
  parsePageParam,
  type RawSearchParams,
} from "@/lib/list-params";
import type { Prisma } from "@/app/generated/prisma/client";

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
        structureTemplate: { select: { name: true } },
        calc: {
          select: {
            insideDiameterFeet: true,
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
      subtitle="Build and review circular manhole drill sheets."
    >
      <div className="mb-4 flex justify-end">
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
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Manhole #</th>
                <th className="px-4 py-2.5 font-semibold">Template</th>
                <th className="px-4 py-2.5 font-semibold">Diameter</th>
                <th className="px-4 py-2.5 font-semibold">Wall Height</th>
                <th className="px-4 py-2.5 font-semibold">Price</th>
                <th className="px-4 py-2.5 font-semibold">Project</th>
                <th className="px-4 py-2.5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sheets.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    No drill sheets yet. Create one to get started.
                  </td>
                </tr>
              ) : (
                sheets.map((sheet) => (
                  <tr key={sheet.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {sheet.structureNumber ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {sheet.structureTemplate?.name ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {sheet.calc?.insideDiameterFeet != null
                        ? formatFeetInches(Number(sheet.calc.insideDiameterFeet))
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 tabular-nums">
                      {sheet.calc?.wallHeightFeet != null
                        ? formatFeetInches(Number(sheet.calc.wallHeightFeet))
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 tabular-nums">
                      {sheet.calc?.totalPrice != null
                        ? `$${Number(sheet.calc.totalPrice).toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {sheet.calc?.projectName ?? sheet.job?.projectName ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1.5">
                        <Link
                          href={`/drill-sheets/${sheet.id}`}
                          className="inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                        >
                          View
                        </Link>
                        <Link
                          href={`/drill-sheets/${sheet.id}/edit`}
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
