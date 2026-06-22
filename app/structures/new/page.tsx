import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { StructureTemplateForm } from "@/components/structures/structure-template-form";
import { createStructureTemplate } from "@/app/structures/actions";

export default function NewStructureTemplatePage() {
  return (
    <DashboardShell
      title="New Structure Template"
      subtitle="Define the diameters, sections, top slabs, and boot sizes for a structure type."
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
        />
      </div>
    </DashboardShell>
  );
}
