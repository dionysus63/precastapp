import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { CustomersList } from "@/components/customers/customers-list";
import { mapCustomerToRow } from "@/lib/customer-mapper";
import { prisma } from "@/lib/prisma";

export default async function CustomersPage() {
  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
  });

  const rows = customers.map(mapCustomerToRow);

  return (
    <DashboardShell
      title="Customers"
      subtitle="Manage customer accounts, contacts, and billing relationships."
    >
      <CustomersList customers={rows} />
    </DashboardShell>
  );
}
