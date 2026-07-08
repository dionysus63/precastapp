import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { BulkContactPasteForm } from "@/components/customers/bulk-contact-paste-form";

export default function BulkContactsPage() {
  return (
    <DashboardShell
      title="Import Contacts"
      subtitle="Paste contact rows copied from Excel; rows match customers by exact name."
    >
      <div className="mx-auto max-w-6xl">
        <Link
          href="/customers"
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to Customers
        </Link>

        <div className="mt-4">
          <BulkContactPasteForm />
        </div>
      </div>
    </DashboardShell>
  );
}
