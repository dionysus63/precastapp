import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{ date?: string }>;
};

/** Old URL — reconciliation now lives on the Invoices page's Reconcile Day tab. */
export default async function DeliveryTicketsReconcileRedirect({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const date =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : null;
  redirect(
    date ? `/invoices?tab=reconcile&date=${date}` : "/invoices?tab=reconcile",
  );
}
