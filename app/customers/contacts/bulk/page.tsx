import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { BulkContactPasteForm } from "@/components/customers/bulk-contact-paste-form";

import { BackButton } from "@/components/dashboard/back-button";
export default function BulkContactsPage() {
  return (
    <DashboardShell
      title="Import Contacts"
      subtitle="Paste contact rows copied from Excel; rows match customers by exact name."
    >
      <div className="mx-auto max-w-6xl">
        <BackButton href="/customers" label="Back to Customers" />

        <div className="mt-4">
          <BulkContactPasteForm />
        </div>
      </div>
    </DashboardShell>
  );
}
