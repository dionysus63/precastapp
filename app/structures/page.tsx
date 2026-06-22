import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { prisma } from "@/lib/prisma";

export default async function StructuresPage() {
  const templates = await prisma.structureTemplate.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { diameters: true, bootSizes: true } },
    },
  });

  return (
    <DashboardShell
      title="Structures"
      subtitle="Reusable structure templates that drive the Drill Sheet Workbook."
    >
      <div className="mb-4 flex justify-end">
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
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Name</th>
                <th className="px-4 py-2.5 font-semibold">Agency / Standard</th>
                <th className="px-4 py-2.5 font-semibold">Shape</th>
                <th className="px-4 py-2.5 font-semibold">Diameters</th>
                <th className="px-4 py-2.5 font-semibold">Boot Sizes</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {templates.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    No templates yet. Create one to start building drill sheets.
                  </td>
                </tr>
              ) : (
                templates.map((template) => (
                  <tr key={template.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {template.name}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {template.agencyStandard ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {template.shape === "CIRCULAR" ? "Circular" : "Rectangular"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {template._count.diameters}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {template._count.bootSizes}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        label={
                          template.status === "ACTIVE" ? "Active" : "Inactive"
                        }
                        variant={
                          template.status === "ACTIVE" ? "success" : "neutral"
                        }
                      />
                    </td>
                    <td className="px-4 py-2.5">
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
