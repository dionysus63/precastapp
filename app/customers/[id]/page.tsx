import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { DeleteCustomerButton } from "@/components/customers/delete-customer-button";
import { mapCustomerToRow, formatCustomerDate } from "@/lib/customer-mapper";
import { prisma } from "@/lib/prisma";

type CustomerDetailPageProps = {
  params: Promise<{ id: string }>;
};

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-900">{value}</dd>
    </div>
  );
}

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
  });

  if (!customer) {
    notFound();
  }

  const row = mapCustomerToRow(customer);

  return (
    <DashboardShell
      title={customer.name}
      subtitle="Customer profile and account details."
    >
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/customers"
            className="text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            ← Back to Customers
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href={`/customers/${customer.id}/edit`}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Edit
            </Link>
            <DeleteCustomerButton
              customerId={customer.id}
              customerName={customer.name}
            />
          </div>
        </div>

        <SectionCard title="Overview">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={row.type} variant={row.typeVariant} />
            <StatusBadge label={row.status} variant={row.statusVariant} />
          </div>

          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            <DetailField label="Customer Name" value={customer.name} />
            <DetailField
              label="Primary Contact"
              value={row.primaryContact}
            />
            <DetailField label="Phone" value={row.phone} />
            <DetailField label="Email" value={row.email} />
            <DetailField label="Open Quotes" value={String(row.openQuotes)} />
            <DetailField label="Balance" value={row.balance} />
            <DetailField label="Last Activity" value={row.lastActivity} />
            <DetailField
              label="Created"
              value={formatCustomerDate(customer.createdAt)}
            />
          </dl>
        </SectionCard>

        <SectionCard title="Billing & Notes">
          <dl className="grid gap-5">
            <DetailField
              label="Billing Address"
              value={customer.billingAddress ?? "—"}
            />
            <DetailField label="Notes" value={customer.notes ?? "—"} />
          </dl>
        </SectionCard>
      </div>
    </DashboardShell>
  );
}
