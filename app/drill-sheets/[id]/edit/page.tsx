import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DrillSheetForm } from "@/components/drill-sheets/drill-sheet-form";
import { updateDrillSheet } from "@/app/drill-sheets/actions";
import {
  buildDrillSheetFormValues,
  drillSheetDetailInclude,
} from "@/lib/drill-sheet-detail";
import { loadDrillSheetFormOptions } from "@/lib/drill-sheet-options";
import { prisma } from "@/lib/prisma";

type EditDrillSheetPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditDrillSheetPage({
  params,
}: EditDrillSheetPageProps) {
  const { id } = await params;

  const [sheet, { templateOptions, castingOptions, jobOptions }] =
    await Promise.all([
      prisma.jobStructure.findUnique({
        where: { id },
        include: drillSheetDetailInclude,
      }),
      loadDrillSheetFormOptions(),
    ]);

  if (!sheet || !sheet.manholeDetail) {
    notFound();
  }

  const template = templateOptions.find(
    (option) => option.id === sheet.structureTemplateId,
  );
  const initialValues = buildDrillSheetFormValues(
    sheet,
    template?.diameters ?? [],
    template?.minimumBrickFeet ?? null,
  );

  const updateAction = updateDrillSheet.bind(null, id);

  return (
    <DashboardShell
      title={`Edit Drill Sheet — ${sheet.structureNumber ?? "Untitled"}`}
      subtitle="Update rim, pipe data, and casting, then recompute the drill sheet."
    >
      <Link
        href={`/drill-sheets/${id}`}
        className="text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        ← Back to Drill Sheet
      </Link>

      <div className="mt-4">
        {templateOptions.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            No active circular templates available.
          </div>
        ) : (
          <DrillSheetForm
            action={updateAction}
            templates={templateOptions}
            castings={castingOptions}
            jobs={jobOptions}
            initialValues={initialValues}
            cancelHref={`/drill-sheets/${id}`}
            submitLabel="Save Changes"
          />
        )}
      </div>
    </DashboardShell>
  );
}
