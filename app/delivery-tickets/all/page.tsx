import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DeliveryTicketsList } from "@/components/delivery-tickets/delivery-tickets-list";
import {
  deliveryTicketListSelect,
  mapDbDeliveryTicketToListRow,
} from "@/lib/delivery-ticket-mapper";
import { getAppSettings } from "@/lib/app-settings";
import { withDatabaseRetry } from "@/lib/prisma";
import {
  buildDeliveryFilterOptions,
  deliveryTicketStatusFormOptions,
} from "@/components/delivery-tickets/delivery-ticket-utils";
import {
  buildPageInfo,
  parsePageParam,
  parseStringParam,
  type RawSearchParams,
} from "@/lib/list-params";
import type { Prisma } from "@/app/generated/prisma/client";

const VALID_DELIVERY_STATUSES = new Set<string>(
  deliveryTicketStatusFormOptions.map((option) => option.value),
);

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export default async function AllDeliveryTicketsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const search = parseStringParam(params.q);
  const statusParam = parseStringParam(params.status);
  const driverParam = parseStringParam(params.driver);
  const jobParam = parseStringParam(params.job);
  const dateParam = parseStringParam(params.date);
  const requestedPage = parsePageParam(params.page);

  // Walk-in counter sales live on the walk-ins board, never in the hub.
  const and: Prisma.DeliveryTicketWhereInput[] = [
    { ticketType: { not: "WALK_IN" } },
  ];

  if (search) {
    and.push({
      OR: [
        { ticketNumber: { contains: search, mode: "insensitive" } },
        { jobNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { projectName: { contains: search, mode: "insensitive" } },
        { driver: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  if (statusParam && VALID_DELIVERY_STATUSES.has(statusParam)) {
    and.push({
      status: statusParam as Prisma.DeliveryTicketWhereInput["status"],
    });
  }

  if (driverParam) {
    and.push({ driver: driverParam });
  }
  if (jobParam) {
    and.push({ jobNumber: jobParam });
  }

  if (dateParam && dateParam !== "All") {
    const today = startOfToday();
    if (dateParam === "Past Due") {
      and.push({ deliveryDate: { lt: today } });
    } else if (dateParam === "Today") {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      and.push({ deliveryDate: { gte: today, lt: tomorrow } });
    } else if (dateParam === "This Week" || dateParam === "Next 7 Days") {
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() + 7);
      and.push({ deliveryDate: { gte: today, lte: weekEnd } });
    }
  }

  const where: Prisma.DeliveryTicketWhereInput = and.length ? { AND: and } : {};

  const total = await withDatabaseRetry((prisma) =>
    prisma.deliveryTicket.count({ where }),
  );
  const pageInfo = buildPageInfo(total, requestedPage);

  const [ticketRecords, settings, jobNumberRows] = await withDatabaseRetry(
    (prisma) =>
      Promise.all([
        prisma.deliveryTicket.findMany({
          where,
          orderBy: [{ deliveryDate: "desc" }, { createdAt: "desc" }],
          select: deliveryTicketListSelect,
          skip: pageInfo.skip,
          take: pageInfo.take,
        }),
        getAppSettings(),
        prisma.deliveryTicket.findMany({
          distinct: ["jobNumber"],
          where: { jobNumber: { not: "" } },
          select: { jobNumber: true },
          orderBy: { jobNumber: "desc" },
        }),
      ]),
  );

  const filterOptions = buildDeliveryFilterOptions({
    drivers: settings.drivers,
    jobNumbers: jobNumberRows
      .map((row) => row.jobNumber)
      .filter((jobNumber): jobNumber is string => Boolean(jobNumber)),
  });

  const rows = ticketRecords.map(mapDbDeliveryTicketToListRow);

  return (
    <DashboardShell
      title="All Tickets"
      subtitle="Search, filter, and print any delivery ticket."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href="/delivery-tickets/new"
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
          >
            New Ticket
          </Link>
        </div>

        <DeliveryTicketsList
          tickets={rows}
          pageInfo={pageInfo}
          filterOptions={filterOptions}
          filters={{
            search,
            status: statusParam,
            driver: driverParam,
            job: jobParam,
            date: dateParam,
          }}
        />
      </div>
    </DashboardShell>
  );
}
