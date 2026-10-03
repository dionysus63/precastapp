import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { CustomerForm } from "@/components/customers/customer-form";
import { createCustomer } from "../actions";

export default function NewCustomerPage() {
  return (
    <DashboardShell
      title="New Customer"
      subtitle="Create a customer record for quotes, jobs, and invoicing."
    >
      <div className="mx-auto max-w-3xl">
        <Link
          href="/customers"
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to Customers
        </Link>

        <div className="mt-4">
          <SectionCard
            title="Customer Details"
            description="Required fields are marked with an asterisk."
          >
            <CustomerForm
              action={createCustomer}
              enableSimilarNameCheck
              cancelHref="/customers"
              submitLabel="Save Customer"
            />
          </SectionCard>
        </div>
      </div>
    </DashboardShell>
  );
}
