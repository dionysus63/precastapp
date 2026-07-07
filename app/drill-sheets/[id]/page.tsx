import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DrillSheetPreview } from "@/components/drill-sheets/drill-sheet-preview";
import { DeleteDrillSheetButton } from "@/components/drill-sheets/delete-drill-sheet-button";
import { DrillSheetPdfButton } from "@/components/drill-sheets/drill-sheet-pdf-button";
import { RectSheetPreview } from "@/components/drill-sheets/rect-sheet-preview";
import {
  buildDrillSheetDetail,
  drillSheetDetailInclude,
} from "@/lib/drill-sheet-detail";
import {
  buildRectSheetFormValues,
  rectPayloadFromFormValues,
  rectSheetDetailInclude,
} from "@/lib/rect-sheet-detail";
import { loadAndComputeRectSheet } from "@/lib/rect-sheet-persistence";
import { prisma } from "@/lib/prisma";

type DrillSheetDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DrillSheetDetailPage({
  params,
}: DrillSheetDetailPageProps) {
  const { id } = await params;

  const shapeRow = await prisma.jobStructure.findUnique({
    where: { id },
    select: { structureTemplate: { select: { shape: true } } },
  });
  if (!shapeRow) {
    notFound();
  }

  if (shapeRow.structureTemplate?.shape === "RECTANGULAR") {
    return <RectSheetDetail id={id} />;
  }

  const sheet = await prisma.jobStructure.findUnique({
    where: { id },
    include: drillSheetDetailInclude,
  });

  if (!sheet) {
    notFound();
  }

  const detail = buildDrillSheetDetail(sheet);
  if (!detail) {
    notFound();
  }

  const { meta, result } = detail;

  return (
    <DashboardShell
      title={`Drill Sheet — ${sheet.structureNumber ?? "Untitled"}`}
      subtitle={sheet.structureTemplate?.name ?? "Circular manhole"}
    >
      <div className="flex items-center justify-between">
        <Link
          href="/drill-sheets"
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to Workbook
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/drill-sheets/${sheet.id}/edit`}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Edit
          </Link>
          <Link
            href={`/drill-sheets/${sheet.id}/preview`}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Preview/Print
          </Link>
          <DrillSheetPdfButton drillSheetId={sheet.id} />
          <DeleteDrillSheetButton drillSheetId={sheet.id} />
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-3 text-xs text-slate-500">
          Live calculation preview below. Open{" "}
          <Link
            href={`/drill-sheets/${sheet.id}/preview`}
            className="font-medium text-slate-700 hover:text-slate-900"
          >
            Preview/Print
          </Link>{" "}
          to see your uploaded fillable PDF template.
        </p>
        <DrillSheetPreview meta={meta} result={result} />
      </div>
    </DashboardShell>
  );
}

async function RectSheetDetail({ id }: { id: string }) {
  const sheet = await prisma.jobStructure.findUnique({
    where: { id },
    include: rectSheetDetailInclude,
  });
  if (!sheet || !sheet.structureTemplateId) {
    notFound();
  }

  // Recompute through the exact pipeline the save actions use so the detail
  // view always matches the stored inputs (and picks up catalog fixes).
  const formValues = buildRectSheetFormValues(sheet);
  const { result, casting } = await loadAndComputeRectSheet(
    rectPayloadFromFormValues(formValues),
  );

  return (
    <DashboardShell
      title={`Rect Sheet — ${sheet.structureNumber ?? "Untitled"}`}
      subtitle={sheet.structureTemplate?.name ?? "Rectangular structure"}
    >
      <div className="flex items-center justify-between">
        <Link
          href="/drill-sheets"
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to Workbook
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/drill-sheets/rect/${sheet.id}/edit`}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Edit
          </Link>
          <DrillSheetPdfButton drillSheetId={sheet.id} />
          <DeleteDrillSheetButton drillSheetId={sheet.id} />
        </div>
      </div>

      <div className="mt-4">
        <RectSheetPreview
          result={result}
          meta={{
            structureNumber: sheet.structureNumber ?? "",
            contractor: sheet.calc?.contractorName ?? "",
            project: sheet.calc?.projectName ?? "",
            templateName: sheet.structureTemplate?.name ?? "",
            castingName: casting?.name ?? null,
          }}
        />
      </div>
    </DashboardShell>
  );
}
