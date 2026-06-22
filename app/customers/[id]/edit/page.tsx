import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { CustomerForm } from "@/components/customers/customer-form";
import { updateCustomer } from "@/app/customers/actions";
import { withDatabaseRetry } from "@/lib/prisma";

type EditCustomerPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
  const { id } = await params;

  const customer = await withDatabaseRetry((prisma) =>
    prisma.customer.findUnique({
      where: { id },
    }),
  );

  if (!customer) {
    notFound();
  }

  return (
    <DashboardShell
      title={`Edit ${customer.name}`}
      subtitle="Update customer account details."
    >
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/customers/${customer.id}`}
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to Customer
        </Link>

        <div className="mt-4">
          <SectionCard
            title="Customer Details"
            description="Required fields are marked with an asterisk."
          >
            <CustomerForm
              action={updateCustomer}
              cancelHref={`/customers/${customer.id}`}
              submitLabel="Save Changes"
              defaultValues={{
                id: customer.id,
                name: customer.name,
                status: customer.status,
                primaryContactName: customer.primaryContactName ?? "",
                phone: customer.phone ?? "",
                email: customer.email ?? "",
                address: customer.address ?? "",
                town: customer.town ?? "",
                state: customer.state ?? "",
                zip: customer.zip ?? "",
                notes: customer.notes ?? "",
              }}
            />
          </SectionCard>
        </div>
      </div>
    </DashboardShell>
  );
}
