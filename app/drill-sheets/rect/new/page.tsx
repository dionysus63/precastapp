import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { RectSheetForm } from "@/components/drill-sheets/rect-sheet-form";
import { createRectSheet } from "@/app/drill-sheets/actions";
import { loadRectSheetFormOptions } from "@/lib/drill-sheet-options";

export default async function NewRectSheetPage() {
  const { templateOptions, castingOptions, jobOptions, openingSizes } =
    await loadRectSheetFormOptions();

  return (
    <DashboardShell
      title="New Rect Sheet"
      subtitle="Enter rim, size, and pipe data to compute heights, sections, and pick weights for a rectangular structure."
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
            No active rectangular templates yet. Create one in{" "}
            <Link href="/structures" className="font-semibold underline">
              Structures
            </Link>{" "}
            first.
          </div>
        ) : (
          <RectSheetForm
            action={createRectSheet}
            templates={templateOptions}
            castings={castingOptions}
            jobs={jobOptions}
            openingSizes={openingSizes}
            submitLabel="Create Sheet"
          />
        )}
      </div>
    </DashboardShell>
  );
}
