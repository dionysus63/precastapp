import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { StructureTemplateForm } from "@/components/structures/structure-template-form";
import {
  createStructureTemplate,
  loadCastingProductOptions,
} from "@/app/structures/actions";

export default async function NewStructureTemplatePage() {
  const castingOptions = await loadCastingProductOptions();

  return (
    <DashboardShell
      title="New Structure Template"
      subtitle="Define thicknesses, casting, connection type, and offered diameters."
    >
      <Link
        href="/structures"
        className="text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        ← Back to Structures
      </Link>

      <div className="mt-4">
        <StructureTemplateForm
          action={createStructureTemplate}
          cancelHref="/structures"
          submitLabel="Create Template"
          castingOptions={castingOptions}
        />
      </div>
    </DashboardShell>
  );
}
