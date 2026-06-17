import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ProductsList } from "@/components/products/products-list";

export default function ProductsPage() {
  return (
    <DashboardShell
      title="Products"
      subtitle="Manage precast product catalog, pricing, and inventory tracking."
    >
      <ProductsList />
    </DashboardShell>
  );
}
