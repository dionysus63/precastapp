import { redirect } from "next/navigation";

/**
 * Old URL. Reconcile Day is gone: the Scan In tab on the Invoices page does
 * its check (the "Still out" list), so old bookmarks land there.
 */
export default function DeliveryTicketsReconcileRedirect() {
  redirect("/invoices?tab=scan");
}
