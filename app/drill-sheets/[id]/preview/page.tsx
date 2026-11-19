import { loadMoldSheetSettings } from "@/lib/mold-sheet-settings-load";
import { notFound } from "next/navigation";
import { requireAuthForPath } from "@/lib/auth/session";
import { KeptPreviewZooms } from "@/components/common/kept-preview-zooms";
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
  // Outside DashboardShell, so the route's permission is checked here.
  const user = await requireAuthForPath(`/drill-sheets/${id}/preview`);

  const sheet = await prisma.jobStructure.findUnique({
    where: { id },
    include: drillSheetDetailInclude,
  });

  if (!sheet) {
    notFound();
  }

  const detail = buildDrillSheetDetail(sheet, await loadMoldSheetSettings());
  if (!detail) {
    notFound();
  }

  return (
    <KeptPreviewZooms userId={user.id}>
      <DrillSheetPreviewContent
        drillSheetId={sheet.id}
        manholeNumber={detail.meta.manholeNumber}
        templateName={detail.meta.templateName}
        projectName={detail.meta.project}
      />
    </KeptPreviewZooms>
  );
}
