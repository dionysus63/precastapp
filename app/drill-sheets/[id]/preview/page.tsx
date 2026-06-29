import { notFound } from "next/navigation";
import { DrillSheetPreviewContent } from "@/components/drill-sheets/drill-sheet-preview-content";
import {
  buildDrillSheetDetail,
  drillSheetDetailInclude,
} from "@/lib/drill-sheet-detail";
import { prisma } from "@/lib/prisma";

type DrillSheetPreviewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DrillSheetPreviewPage({
  params,
}: DrillSheetPreviewPageProps) {
  const { id } = await params;

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

  return (
    <DrillSheetPreviewContent
      drillSheetId={sheet.id}
      manholeNumber={detail.meta.manholeNumber}
      templateName={detail.meta.templateName}
      projectName={detail.meta.project}
    />
  );
}
