import { AppPermission } from "@/app/generated/prisma/client";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { OneOffDrillSheets } from "@/components/quotes/one-off/one-off-drill-sheets";
import { requirePermission } from "@/lib/auth/session";
import {
  loadDrillSheetFormOptions,
  loadRectSheetFormOptions,
} from "@/lib/drill-sheet-options";

export default async function OneOffDrillSheetsPage() {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);

  const [circular, rect] = await Promise.all([
    loadDrillSheetFormOptions(),
    loadRectSheetFormOptions(),
  ]);

  return (
    <DashboardShell
      title="One-Off Drill Sheets"
      subtitle="Make a few drill sheets for a job without building a quote first."
    >
      <OneOffDrillSheets
        circularOptions={{
          templates: circular.templateOptions,
          castings: circular.castingOptions,
          pipeOpeningSizes: circular.pipeOpeningSizes,
          diameterConfigs: circular.diameterConfigs,
        }}
        rectOptions={{
          templates: rect.templateOptions,
          castings: rect.castingOptions,
          openingSizes: rect.openingSizes,
        }}
      />
    </DashboardShell>
  );
}
