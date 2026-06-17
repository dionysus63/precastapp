import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { CustomersList } from "@/components/customers/customers-list";

export default function CustomersPage() {
  return (
    <DashboardShell
      title="Customers"
      subtitle="Manage customer accounts, contacts, and billing relationships."
    >
      <CustomersList />
    </DashboardShell>
  );
}
