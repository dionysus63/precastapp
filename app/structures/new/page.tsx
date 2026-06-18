import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { StructureForm } from "@/components/structures/structure-form";

export default function NewStructurePage() {
  return (
    <DashboardShell
      title="New Structure"
      subtitle="Enter a job-specific structure for cut sheet and production planning."
    >
      <StructureForm />
    </DashboardShell>
  );
}
