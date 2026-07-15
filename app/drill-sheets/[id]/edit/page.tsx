import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DrillSheetForm } from "@/components/drill-sheets/drill-sheet-form";
import { updateDrillSheet } from "@/app/drill-sheets/actions";
import {
  buildDrillSheetFormValues,
  drillSheetDetailInclude,
} from "@/lib/drill-sheet-detail";
import { loadDrillSheetFormOptions } from "@/lib/drill-sheet-options";
import { prisma } from "@/lib/prisma";

import { BackButton } from "@/components/dashboard/back-button";
type EditDrillSheetPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditDrillSheetPage({
  params,
}: EditDrillSheetPageProps) {
  const { id } = await params;

  const [
    sheet,
    {
      templateOptions,
      castingOptions,
      jobOptions,
      pipeOpeningSizes,
      diameterConfigs,
    },
  ] = await Promise.all([
    prisma.jobStructure.findUnique({
      where: { id },
      include: drillSheetDetailInclude,
    }),
    loadDrillSheetFormOptions(),
  ]);

  if (!sheet || !sheet.calc) {
    notFound();
  }

  if (sheet.structureTemplate?.shape === "RECTANGULAR") {
    redirect(`/drill-sheets/rect/${id}/edit`);
  }

  const template = templateOptions.find(
    (option) => option.id === sheet.structureTemplateId,
  );
  const initialValues = buildDrillSheetFormValues(
    sheet,
    template?.diameters ?? [],
  );

  const updateAction = updateDrillSheet.bind(null, id);

  return (
    <DashboardShell
      title={`Edit Drill Sheet — ${sheet.structureNumber ?? "Untitled"}`}
      subtitle="Update rim, pipe data, and casting, then recompute the drill sheet."
    >
      <BackButton href={`/drill-sheets/${id}`} label="Back to Drill Sheet" />

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
            pipeOpeningSizes={pipeOpeningSizes}
            diameterConfigs={diameterConfigs}
            initialValues={initialValues}
            expectedUpdatedAt={sheet.updatedAt.toISOString()}
            cancelHref={`/drill-sheets/${id}`}
            submitLabel="Save Changes"
          />
        )}
      </div>
    </DashboardShell>
  );
}
