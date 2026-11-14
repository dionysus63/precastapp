import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { InvoicesTabs } from "@/components/invoices/invoices-tabs";
import {
  getInvoiceFilterCounts,
  getInvoiceSearchSuggestions,
  listInvoicesForPage,
  type InvoiceSearchSuggestions,
} from "@/app/invoices/actions";
import { AppPermission } from "@/app/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import {
  hasInvoiceListSearch,
  invoiceListSearchParams,
  parseInvoiceListView,
} from "@/lib/invoice-list-search";
import {
  buildPageInfo,
  parsePageParam,
  parseStringParam,
  type RawSearchParams,
} from "@/lib/list-params";
import { withDatabaseRetry } from "@/lib/prisma";
import { loadScanInView } from "@/lib/ticket-scan/view";
import type { ScanInView } from "@/lib/ticket-scan/view-types";

/**
 * Invoices: the Scan In tab (drop the day's scan of signed tickets, file
 * them, print the invoices) and the one list of invoices.
 *
 * Addresses: /invoices opens Scan In for someone who can file and the list
 * for everyone else; ?tab=invoices is the list (its status chip, its search
 * boxes and its pages keep that in the address, see lib/invoice-list-search);
 * ?scan=<id> shows a scan that was filed.
 */
export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const tabParam = parseStringParam(params.tab);
  const scanParam = parseStringParam(params.scan);
  const statusParam = parseStringParam(params.status);
  const pageParam = parseStringParam(params.page);
  const { filter, search } = parseInvoiceListView(params);
  const searching = hasInvoiceListSearch(search);

  // Old links to the Draft Review and Final tabs land on the list; old links
  // to Reconcile Day land on Scan In, which took its place.
  const asksForList =
    tabParam === "invoices" || tabParam === "drafts" || tabParam === "final";
  const asksForScan =
    tabParam === "scan" || tabParam === "reconcile" || scanParam !== "";
  if (!asksForList && !asksForScan && (statusParam || pageParam || searching)) {
    // A filter or a page number belongs to the list. Say so in the address,
    // so clearing the filter does not jump over to Scan In.
    const query = new URLSearchParams({
      tab: "invoices",
      ...invoiceListSearchParams(search),
    });
    if (statusParam) {
      query.set("status", statusParam);
    }
    if (pageParam) {
      query.set("page", pageParam);
    }
    redirect(`/invoices?${query.toString()}`);
  }

  // The tab always says how many invoices there are in all.
  const [allCounts, user] = await Promise.all([
    getInvoiceFilterCounts(),
    getCurrentUser(),
  ]);
  const [canManage, canDeliver] = await Promise.all([
    user
      ? hasPermission(user, AppPermission.INVOICES_MANAGE)
      : Promise.resolve(false),
    user
      ? hasPermission(user, AppPermission.DELIVERY_MANAGE)
      : Promise.resolve(false),
  ]);
  // Filing a signed ticket marks it delivered and makes its invoice.
  const canFile = canManage && canDeliver;
  const tab: "scan" | "invoices" = asksForList
    ? "invoices"
    : asksForScan || canFile
      ? "scan"
      : "invoices";

  let filterCounts = allCounts;
  let suggestions: InvoiceSearchSuggestions = { customers: [], jobs: [] };
  let invoices: Awaited<ReturnType<typeof listInvoicesForPage>>["invoices"] =
    [];
  let pageInfo = buildPageInfo(0, 1);
  let scanIn: { view: ScanInView; viewing: string | null } | null = null;

  if (tab === "scan") {
    const view = await withDatabaseRetry((client) =>
      loadScanInView(client, { filedScanId: scanParam || null, canFile }),
    );
    // An address naming a scan that is gone just shows Scan In.
    scanIn = { view, viewing: view.filed?.id ?? null };
  } else {
    const [listResult, searchCounts, searchSuggestions] = await Promise.all([
      listInvoicesForPage({
        filter,
        search,
        page: parsePageParam(params.page),
      }),
      // With a search on, the chips count inside it.
      searching ? getInvoiceFilterCounts(search) : Promise.resolve(allCounts),
      getInvoiceSearchSuggestions(search.customer),
    ]);
    invoices = listResult.invoices;
    pageInfo = listResult.pageInfo;
    filterCounts = searchCounts;
    suggestions = searchSuggestions;
  }

  return (
    <DashboardShell
      title="Invoices"
      // Both tabs put a sheet of paper beside their grid.
      width="full"
    >
      <InvoicesTabs
        invoices={invoices}
        pageInfo={pageInfo}
        filterCounts={filterCounts}
        invoiceTotal={allCounts.ALL}
        tab={tab}
        filter={filter}
        search={search}
        suggestions={suggestions}
        canManage={canManage}
        canFile={canFile}
        scanIn={scanIn}
      />
    </DashboardShell>
  );
}
