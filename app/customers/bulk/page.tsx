import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { BulkPasteForm } from "@/components/customers/bulk-paste-form";

export default function BulkCustomersPage() {
  return (
    <DashboardShell
      title="Bulk Add Customers"
      subtitle="Paste customer rows copied from Excel and preview them before import."
    >
      <div className="mx-auto max-w-6xl">
        <Link
          href="/customers"
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to Customers
        </Link>

        <div className="mt-4">
          <BulkPasteForm />
        </div>
      </div>
    </DashboardShell>
  );
}
