import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DeliveryTicketsList } from "@/components/delivery-tickets/delivery-tickets-list";
import { mapDbDeliveryTicketToListRow } from "@/lib/delivery-ticket-mapper";
import { withDatabaseRetry } from "@/lib/prisma";
import { deliveryTicketStatusFormOptions } from "@/components/delivery-tickets/delivery-ticket-utils";
import {
  buildPageInfo,
  parsePageParam,
  parseStringParam,
  type RawSearchParams,
} from "@/lib/list-params";
import type { Prisma } from "@/app/generated/prisma/client";

const DELIVERY_LIST_SELECT = {
  id: true,
  ticketNumber: true,
  jobNumber: true,
  projectName: true,
  customerName: true,
  deliveryDate: true,
  deliveryTime: true,
  truck: true,
  driver: true,
  status: true,
  totalItems: true,
  totalWeight: true,
  _count: { select: { lineItems: true } },
} satisfies Prisma.DeliveryTicketSelect;

const VALID_DELIVERY_STATUSES = new Set<string>(
  deliveryTicketStatusFormOptions.map((option) => option.value),
);

// The dispatcher calendar / today panel only need recent + upcoming tickets.
// Bounding by recency keeps these panels fast as historical tickets accumulate.
const SCHEDULE_LOOKBACK_DAYS = 56;

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export default async function DeliveryTicketsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const search = parseStringParam(params.q);
  const statusParam = parseStringParam(params.status);
  const driverParam = parseStringParam(params.driver);
  const truckParam = parseStringParam(params.truck);
  const jobParam = parseStringParam(params.job);
  const dateParam = parseStringParam(params.date);
  const requestedPage = parsePageParam(params.page);

  const and: Prisma.DeliveryTicketWhereInput[] = [];

  if (search) {
    and.push({
      OR: [
        { ticketNumber: { contains: search, mode: "insensitive" } },
        { jobNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { projectName: { contains: search, mode: "insensitive" } },
        { truck: { contains: search, mode: "insensitive" } },
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
  if (truckParam) {
    and.push({ truck: truckParam });
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

  const scheduleCutoff = startOfToday();
  scheduleCutoff.setDate(scheduleCutoff.getDate() - SCHEDULE_LOOKBACK_DAYS);

  const total = await withDatabaseRetry((prisma) =>
    prisma.deliveryTicket.count({ where }),
  );
  const pageInfo = buildPageInfo(total, requestedPage);

  const [ticketRecords, scheduleRecords] = await withDatabaseRetry((prisma) =>
    Promise.all([
      prisma.deliveryTicket.findMany({
        where,
        orderBy: [{ deliveryDate: "desc" }, { createdAt: "desc" }],
        select: DELIVERY_LIST_SELECT,
        skip: pageInfo.skip,
        take: pageInfo.take,
      }),
      prisma.deliveryTicket.findMany({
        where: { deliveryDate: { gte: scheduleCutoff } },
        orderBy: [{ deliveryDate: "asc" }, { createdAt: "asc" }],
        select: DELIVERY_LIST_SELECT,
      }),
    ]),
  );

  const rows = ticketRecords.map(mapDbDeliveryTicketToListRow);
  const scheduleRows = scheduleRecords.map(mapDbDeliveryTicketToListRow);

  return (
    <DashboardShell
      title="Delivery Hub"
      subtitle="Dispatcher hub for scheduling, printing, and tracking deliveries."
    >
      <DeliveryTicketsList
        tickets={rows}
        scheduleTickets={scheduleRows}
        pageInfo={pageInfo}
        filters={{
          search,
          status: statusParam,
          driver: driverParam,
          truck: truckParam,
          job: jobParam,
          date: dateParam,
        }}
      />
    </DashboardShell>
  );
}
