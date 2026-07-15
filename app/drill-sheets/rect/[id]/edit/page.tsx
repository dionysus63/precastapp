import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { RectSheetForm } from "@/components/drill-sheets/rect-sheet-form";
import { updateRectSheet } from "@/app/drill-sheets/actions";
import { loadRectSheetFormOptions } from "@/lib/drill-sheet-options";
import {
  buildRectSheetFormValues,
  rectSheetDetailInclude,
} from "@/lib/rect-sheet-detail";
import { prisma } from "@/lib/prisma";

import { BackButton } from "@/components/dashboard/back-button";
type EditRectSheetPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditRectSheetPage({
  params,
}: EditRectSheetPageProps) {
  const { id } = await params;

  const [sheet, options] = await Promise.all([
    prisma.jobStructure.findUnique({
      where: { id },
      include: rectSheetDetailInclude,
    }),
    loadRectSheetFormOptions(),
  ]);

  if (!sheet || sheet.structureTemplate?.shape !== "RECTANGULAR") {
    notFound();
  }

  const defaultValues = buildRectSheetFormValues(sheet);
  const updateAction = updateRectSheet.bind(null, sheet.id);

  return (
    <DashboardShell
      title={`Edit Rect Sheet — ${sheet.structureNumber ?? "Untitled"}`}
      subtitle={sheet.structureTemplate?.name ?? "Rectangular structure"}
    >
      <BackButton href={`/drill-sheets/${sheet.id}`} label="Back to Sheet" />

      <div className="mt-4">
        <RectSheetForm
          action={updateAction}
          templates={options.templateOptions}
          castings={options.castingOptions}
          jobs={options.jobOptions}
          openingSizes={options.openingSizes}
          defaultValues={defaultValues}
          expectedUpdatedAt={sheet.updatedAt.toISOString()}
          submitLabel="Save Changes"
        />
      </div>
    </DashboardShell>
  );
}
