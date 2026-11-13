import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  InvoicesTabs,
  type ReconcileTabData,
} from "@/components/invoices/invoices-tabs";
import {
  getInvoiceFilterCounts,
  listInvoicesForPage,
} from "@/app/invoices/actions";
import {
  listTicketsForReconciliation,
  listTicketsForReconciliationRange,
} from "@/app/operations/actions";
import { AppPermission } from "@/app/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { localTodayInput } from "@/lib/date-only";
import { parseInvoiceListFilter } from "@/lib/invoice-status";
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
  // One list of invoices, plus Reconcile Day. Old links to the Draft Review
  // and Final tabs (?tab=drafts / ?tab=final) land on the list.
  const initialTab: "invoices" | "reconcile" =
    parseStringParam(params.tab) === "reconcile" ? "reconcile" : "invoices";
  const filter = parseInvoiceListFilter(parseStringParam(params.status));
  const requestedPage = parsePageParam(params.page);

  const [filterCounts, user] = await Promise.all([
    getInvoiceFilterCounts(),
    getCurrentUser(),
  ]);

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
  let reconcile: ReconcileTabData | null = null;

  if (initialTab === "reconcile") {
    // Local date, not UTC — an evening visit should still open today's day.
    const today = localTodayInput();
    const viewAll = parseStringParam(params.all) === "1";
    const viewUnreconciled = parseStringParam(params.unreconciled) === "1";
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
    } else if (viewUnreconciled) {
      const { days, truncated } = await listTicketsForReconciliationRange({});
      reconcile = {
        allowed: true,
        mode: "unreconciled",
        from: "",
        to: "",
        days: days
          .filter((day) => !day.reconciliation)
          .map((day) => ({ ...day, deliveredOtherDayTickets: [] })),
        truncated,
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
    const listResult = await listInvoicesForPage({
      filter,
      page: requestedPage,
    });
    invoices = listResult.invoices;
    pageInfo = listResult.pageInfo;
  }

  return (
    <DashboardShell
      title="Invoices"
      subtitle="A ticket gets its invoice the moment it is marked delivered. Check it, fix a price if needed, and print."
    >
      <InvoicesTabs
        invoices={invoices}
        pageInfo={pageInfo}
        filterCounts={filterCounts}
        initialTab={initialTab}
        filter={filter}
        canManage={canManage}
        reconcile={reconcile}
      />
    </DashboardShell>
  );
}
