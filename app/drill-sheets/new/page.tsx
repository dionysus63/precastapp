import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DrillSheetForm } from "@/components/drill-sheets/drill-sheet-form";
import { createDrillSheet } from "@/app/drill-sheets/actions";
import { loadDrillSheetFormOptions } from "@/lib/drill-sheet-options";

export default async function NewDrillSheetPage() {
  const {
    templateOptions,
    castingOptions,
    jobOptions,
    pipeOpeningSizes,
    diameterConfigs,
  } = await loadDrillSheetFormOptions();

  return (
    <DashboardShell
      title="New Drill Sheet"
      subtitle="Enter rim and pipe data to compute wall height and build a drill sheet."
    >
      <Link
        href="/drill-sheets"
        className="text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        ← Back to Workbook
      </Link>

      <div className="mt-4">
        {templateOptions.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            No active circular templates yet. Create one in{" "}
            <Link href="/structures" className="font-semibold underline">
              Structures
            </Link>{" "}
            first.
          </div>
        ) : diameterConfigs.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            No diameter configurations yet. Add them in{" "}
            <Link href="/settings/diameters" className="font-semibold underline">
              Settings → Structure Diameters
            </Link>
            .
          </div>
        ) : (
          <DrillSheetForm
            action={createDrillSheet}
            templates={templateOptions}
            castings={castingOptions}
            jobs={jobOptions}
            pipeOpeningSizes={pipeOpeningSizes}
            diameterConfigs={diameterConfigs}
          />
        )}
      </div>
    </DashboardShell>
  );
}
