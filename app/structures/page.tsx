import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { prisma } from "@/lib/prisma";

import {
  tableBodyClassName,
  tableCellBordersClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";
export default async function StructuresPage() {
  const [templates, pipeOpeningCount, rectOpeningCount] = await Promise.all([
    prisma.structureTemplate.findMany({
      orderBy: { name: "asc" },
      include: {
        castingProduct: { select: { name: true } },
        _count: { select: { diameters: true, rectSizes: true } },
      },
    }),
    prisma.pipeOpeningSize.count(),
    prisma.rectOpeningSize.count(),
  ]);

  return (
    <DashboardShell
      title="Structures"
      subtitle="Structure templates and pipe opening size catalog for the Drill Sheet Workbook."
    >
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <Link
          href="/structures/pipe-openings"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Pipe Opening Sizes ({pipeOpeningCount})
        </Link>
        <Link
          href="/structures/rect-openings"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Rect Opening Sizes ({rectOpeningCount})
        </Link>
        <Link
          href="/structures/sheet-pdfs"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Sheet PDF Sets
        </Link>
        <Link
          href="/structures/import"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Bulk Import
        </Link>
        <Link
          href="/structures/new"
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
        >
          New Template
        </Link>
      </div>

      <SectionCard
        title="Structure Templates"
        description={`${templates.length} template${templates.length === 1 ? "" : "s"}`}
        noPadding
      >
        <div className={tableFlushWrapperClassName}>
          <table className={tableClassName}>
            <thead>
              <tr>
                <th className={tableHeaderCellClassName}>Name</th>
                <th className={tableHeaderCellClassName}>Agency / Standard</th>
                <th className={tableHeaderCellClassName}>Shape</th>
                <th className={tableHeaderCellClassName}>Casting</th>
                <th className={tableHeaderCellClassName}>Sizes</th>
                <th className={tableHeaderCellClassName}>Status</th>
                <th className={tableHeaderCellClassName}>Actions</th>
              </tr>
            </thead>
            <tbody className={tableBodyClassName}>
              {templates.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className={`${tableCellBordersClassName} px-4 py-8 text-center text-sm text-slate-500`}
                  >
                    No templates yet. Create one to start building drill sheets.
                  </td>
                </tr>
              ) : (
                templates.map((template) => (
                  <tr key={template.id} className={tableRowClassName}>
                    <td className={`${tableCellClassName} font-medium text-slate-900`}>
                      {template.name}
                    </td>
                    <td className={`${tableCellClassName} text-slate-600`}>
                      {template.agencyStandard ?? "—"}
                    </td>
                    <td className={`${tableCellClassName} text-slate-600`}>
                      {template.shape === "CIRCULAR" ? "Circular" : "Rectangular"}
                    </td>
                    <td className={`${tableCellClassName} text-slate-600`}>
                      {template.castingProduct?.name ?? "—"}
                    </td>
                    <td className={`${tableCellClassName} text-slate-600`}>
                      {template.shape === "CIRCULAR"
                        ? template._count.diameters
                        : template._count.rectSizes}
                    </td>
                    <td className={tableCellClassName}>
                      <StatusBadge
                        label={
                          template.status === "ACTIVE" ? "Active" : "Inactive"
                        }
                        variant={
                          template.status === "ACTIVE" ? "success" : "neutral"
                        }
                      />
                    </td>
                    <td className={tableCellClassName}>
                      <Link
                        href={`/structures/${template.id}`}
                        className="inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </DashboardShell>
  );
}
