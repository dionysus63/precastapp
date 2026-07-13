import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  InvoicesTabs,
  type ReconcileTabData,
} from "@/components/invoices/invoices-tabs";
import {
  getInvoiceTabCounts,
  listInvoicesForPage,
  listPaidWalkInInvoices,
} from "@/app/invoices/actions";
import {
  listTicketsForReconciliation,
  listTicketsForReconciliationRange,
} from "@/app/operations/actions";
import { AppPermission } from "@/app/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import {
  buildPageInfo,
  parsePageParam,
  parseStringParam,
  type RawSearchParams,
} from "@/lib/list-params";

const DATE_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDateParam(value: string | string[] | undefined): string {
  const parsed = parseStringParam(value);
  return DATE_PARAM_PATTERN.test(parsed) ? parsed : "";
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const tabParam = parseStringParam(params.tab);
  const statusParam = parseStringParam(params.status) || "ALL";
  const requestedPage = parsePageParam(params.page);
  const draftFrom = parseDateParam(params.from);
  const draftTo = parseDateParam(params.to);

  const [{ draftCount, finalCount, paidWalkInCount }, user] = await Promise.all([
    getInvoiceTabCounts(),
    getCurrentUser(),
  ]);

  const initialTab: "drafts" | "final" | "reconcile" =
    tabParam === "final"
      ? "final"
      : tabParam === "reconcile"
        ? "reconcile"
        : tabParam === "drafts" || draftCount > 0
          ? "drafts"
          : "final";

  const [canManage, canReconcile] = await Promise.all([
    user
      ? hasPermission(user, AppPermission.INVOICES_MANAGE)
      : Promise.resolve(false),
    user
      ? hasPermission(user, AppPermission.DELIVERY_MANAGE)
      : Promise.resolve(false),
  ]);

  let invoices: Awaited<ReturnType<typeof listInvoicesForPage>>["invoices"] = [];
  let pageInfo = buildPageInfo(0, 1);
  let paidWalkIns: Awaited<ReturnType<typeof listPaidWalkInInvoices>> = [];
  let reconcile: ReconcileTabData | null = null;

  if (initialTab === "reconcile") {
    // Local date, not UTC — an evening visit should still open today's day.
    const today = new Date().toLocaleDateString("en-CA");
    const viewAll = parseStringParam(params.all) === "1";
    const dateParam = parseDateParam(params.date);
    const dateToParam = parseDateParam(params.dateTo);

    if (!canReconcile) {
      reconcile = {
        allowed: false,
        mode: "day",
        from: dateParam || today,
        to: "",
        days: [],
        truncated: false,
      };
    } else if (viewAll) {
      const { days, truncated } = await listTicketsForReconciliationRange({});
      reconcile = {
        allowed: true,
        mode: "all",
        from: "",
        to: "",
        days: days.map((day) => ({ ...day, deliveredOtherDayTickets: [] })),
        truncated,
      };
    } else if (dateParam && dateToParam && dateToParam !== dateParam) {
      const { days, truncated } = await listTicketsForReconciliationRange({
        from: dateParam,
        to: dateToParam,
      });
      reconcile = {
        allowed: true,
        mode: "range",
        from: dateParam,
        to: dateToParam,
        days: days.map((day) => ({ ...day, deliveredOtherDayTickets: [] })),
        truncated,
      };
    } else {
      const date = dateParam || today;
      const { scheduledTickets, deliveredOtherDayTickets, reconciliation } =
        await listTicketsForReconciliation(date);
      reconcile = {
        allowed: true,
        mode: "day",
        from: date,
        to: "",
        days: [
          { date, scheduledTickets, deliveredOtherDayTickets, reconciliation },
        ],
        truncated: false,
      };
    }
  } else {
    const [listResult, walkIns] = await Promise.all([
      listInvoicesForPage({
        tab: initialTab,
        status: statusParam,
        page: requestedPage,
        deliveryFrom: draftFrom || null,
        deliveryTo: draftTo || null,
      }),
      initialTab === "drafts" ? listPaidWalkInInvoices() : Promise.resolve([]),
    ]);
    invoices = listResult.invoices;
    pageInfo = listResult.pageInfo;
    paidWalkIns = walkIns;
  }

  return (
    <DashboardShell
      title="Invoices"
      subtitle="Reconcile delivery days, review draft invoices, then finalize and print."
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
        draftFrom={draftFrom}
        draftTo={draftTo}
        reconcile={reconcile}
      />
    </DashboardShell>
  );
}
