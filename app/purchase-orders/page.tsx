import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PaginationControls } from "@/components/common/pagination-controls";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { mapPurchaseOrderListRow } from "@/lib/purchase-order-mapper";
import {
  purchaseOrderCreatorNames,
  purchaseOrderStatusFormOptions,
  purchaseOrderCategoryFormOptions,
} from "@/lib/purchase-order-utils";
import {
  buildPageInfo,
  parsePageParam,
  parseStringParam,
  type RawSearchParams,
} from "@/lib/list-params";
import { formatUsd } from "@/lib/format";
import { withDatabaseRetry } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import { parsePurchaseOrderStatus } from "@/lib/purchase-order-utils";
import { parseReceivingCategory } from "@/lib/receiving-utils";

import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";

/** The search box and the dropdowns: white boxes, so they stand off the gray page. */
const filterBoxClassName =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm placeholder:text-slate-400";

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const search = parseStringParam(params.q);
  const statusParam = parseStringParam(params.status);
  const vendorParam = parseStringParam(params.vendor);
  const categoryParam = parseStringParam(params.category);
  // Who created it: the "Entered by" name on the order.
  const createdByParam = parseStringParam(params.by)?.trim() || null;
  const requestedPage = parsePageParam(params.page);

  const and: Prisma.PurchaseOrderWhereInput[] = [];

  if (search) {
    and.push({
      OR: [
        { poNumber: { contains: search, mode: "insensitive" } },
        { vendor: { name: { contains: search, mode: "insensitive" } } },
        { notes: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  const status = statusParam ? parsePurchaseOrderStatus(statusParam) : null;
  if (status) {
    and.push({ status });
  }

  if (vendorParam) {
    and.push({ vendorId: vendorParam });
  }

  const category = categoryParam ? parseReceivingCategory(categoryParam) : null;
  if (categoryParam === "one-off") {
    and.push({ category: null });
  } else if (category) {
    and.push({ category });
  }

  if (createdByParam) {
    and.push({ enteredBy: { equals: createdByParam, mode: "insensitive" } });
  }

  const where: Prisma.PurchaseOrderWhereInput = and.length ? { AND: and } : {};

  const total = await withDatabaseRetry((client) =>
    client.purchaseOrder.count({ where }),
  );
  const pageInfo = buildPageInfo(total, requestedPage);

  const [purchaseOrders, vendors, enteredByRows] = await withDatabaseRetry((client) =>
    Promise.all([
      client.purchaseOrder.findMany({
        where,
        orderBy: [{ orderDate: "desc" }, { poNumber: "desc" }],
        skip: pageInfo.skip,
        take: pageInfo.take,
        include: {
          vendor: { select: { name: true } },
          lines: {
            select: { quantityOrdered: true, quantityReceived: true },
          },
        },
      }),
      client.vendor.findMany({
        where: { status: "ACTIVE" },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true },
      }),
      // Everyone named on an order, for the "Created by" dropdown.
      client.purchaseOrder.findMany({
        where: { enteredBy: { not: null } },
        distinct: ["enteredBy"],
        select: { enteredBy: true },
      }),
    ]),
  );
  const creatorNames = purchaseOrderCreatorNames([
    ...enteredByRows.map((row) => row.enteredBy),
    // A name in the address that no order carries (any more) stays pickable,
    // so the dropdown shows what the list is filtered by.
    createdByParam,
  ]);
  const selectedCreator =
    creatorNames.find(
      (name) => name.toLowerCase() === createdByParam?.toLowerCase(),
    ) ?? "";

  const rows = purchaseOrders.map(mapPurchaseOrderListRow);

  return (
    <DashboardShell
      title="Purchase Orders"
    >
      <div className="mb-4 flex flex-wrap justify-between gap-3">
        <form method="get" className="flex flex-wrap gap-2 text-xs">
          <input
            name="q"
            defaultValue={search ?? ""}
            placeholder="Search PO # or vendor…"
            className={filterBoxClassName}
          />
          <select
            name="status"
            defaultValue={statusParam ?? ""}
            className={filterBoxClassName}
          >
            <option value="">All statuses</option>
            {purchaseOrderStatusFormOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            name="vendor"
            defaultValue={vendorParam ?? ""}
            className={filterBoxClassName}
          >
            <option value="">All vendors</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
          <select
            name="category"
            defaultValue={categoryParam ?? ""}
            className={filterBoxClassName}
          >
            <option value="">All categories</option>
            {purchaseOrderCategoryFormOptions.map((option) => (
              <option key={option.value || "one-off"} value={option.value || "one-off"}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            name="by"
            defaultValue={selectedCreator}
            aria-label="Created by"
            className={filterBoxClassName}
          >
            <option value="">Created by anyone</option>
            {creatorNames.map((name) => (
              <option key={name} value={name}>
                Created by {name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg btn-plain px-3 py-2 font-medium"
          >
            Filter
          </button>
        </form>
        <Link
          href="/purchase-orders/new"
          className="rounded-lg btn-main px-4 py-2 text-xs font-semibold"
        >
          New Purchase Order
        </Link>
      </div>

      <SectionCard title="Purchase Orders" noPadding>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            No purchase orders match these filters.
          </p>
        ) : (
          <div className={tableFlushWrapperClassName}>
            <table className={tableClassName}>
              <thead>
                <tr>
                  <th className={tableHeaderCellClassName}>PO #</th>
                  <th className={tableHeaderCellClassName}>Vendor</th>
                  <th className={tableHeaderCellClassName}>Date</th>
                  <th className={tableHeaderCellClassName}>Created By</th>
                  <th className={tableHeaderCellClassName}>Category</th>
                  <th className={tableHeaderCellClassName}>Status</th>
                  <th className={tableHeaderCellClassName}>Received</th>
                  <th className={tableHeaderCellClassName}>Total</th>
                </tr>
              </thead>
              <tbody className={tableBodyClassName}>
                {rows.map((row) => (
                  <tr key={row.id} className={tableRowClassName}>
                    <td className={`${tableCellClassName} font-mono text-2xs font-medium`}>
                      <Link
                        href={`/purchase-orders/${row.id}`}
                        className="text-slate-900 hover:text-slate-700"
                      >
                        {row.poNumber}
                      </Link>
                    </td>
                    <td className={tableCellClassName}>{row.vendorName}</td>
                    <td className={tableCellClassName}>{row.orderDateLabel}</td>
                    <td className={tableCellClassName}>
                      {row.enteredBy ?? <span className="text-slate-500">—</span>}
                    </td>
                    <td className={tableCellClassName}>
                      <StatusBadge label={row.categoryLabel} variant="neutral" />
                    </td>
                    <td className={tableCellClassName}>
                      <StatusBadge
                        label={row.statusLabel}
                        variant={row.statusVariant}
                      />
                    </td>
                    <td className={tableCellClassName}>{row.receivedProgress}</td>
                    <td className={tableCellClassName}>{formatUsd(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls
              page={pageInfo.page}
              totalPages={pageInfo.totalPages}
              fromIndex={pageInfo.fromIndex}
              toIndex={pageInfo.toIndex}
              total={pageInfo.total}
              noun="purchase order"
            />
          </div>
        )}
      </SectionCard>
    </DashboardShell>
  );
}
