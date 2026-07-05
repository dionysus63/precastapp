import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { InvoicesTabs } from "@/components/invoices/invoices-tabs";
import {
  getInvoiceTabCounts,
  listInvoicesForPage,
  listPaidWalkInInvoices,
} from "@/app/invoices/actions";
import { AppPermission } from "@/app/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import {
  parsePageParam,
  parseStringParam,
  type RawSearchParams,
} from "@/lib/list-params";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const tabParam = parseStringParam(params.tab);
  const statusParam = parseStringParam(params.status) || "ALL";
  const requestedPage = parsePageParam(params.page);

  const [{ draftCount, finalCount, paidWalkInCount }, user] = await Promise.all([
    getInvoiceTabCounts(),
    getCurrentUser(),
  ]);

  const initialTab: "drafts" | "final" =
    tabParam === "final"
      ? "final"
      : tabParam === "drafts" || draftCount > 0
        ? "drafts"
        : "final";

  const [{ invoices, pageInfo }, paidWalkIns] = await Promise.all([
    listInvoicesForPage({
      tab: initialTab,
      status: statusParam,
      page: requestedPage,
    }),
    initialTab === "drafts" ? listPaidWalkInInvoices() : Promise.resolve([]),
  ]);

  const canManage = user
    ? await hasPermission(user, AppPermission.INVOICES_MANAGE)
    : false;

  return (
    <DashboardShell
      title="Invoices"
      subtitle="Review draft invoices, then finalize and print."
    >
      <InvoicesTabs
        invoices={invoices}
        paidWalkIns={paidWalkIns}
        pageInfo={pageInfo}
        tabCounts={{
          drafts: draftCount,
          finals: finalCount,
          paidWalkIns: paidWalkInCount,
        }}
        initialTab={initialTab}
        initialStatus={statusParam}
        canManage={canManage}
      />
    </DashboardShell>
  );
}
