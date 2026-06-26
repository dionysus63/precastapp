import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { WalkInsBoard, type WalkInRow } from "@/components/walk-ins/walk-ins-board";
import { requirePermission } from "@/lib/auth/session";
import { AppPermission } from "@/app/generated/prisma/client";
import { withDatabaseRetry } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";

const WALK_IN_SELECT = {
  id: true,
  ticketNumber: true,
  ticketType: true,
  customerName: true,
  projectName: true,
  jobNumber: true,
  status: true,
  deliveryDate: true,
  deliveryTime: true,
  totalItems: true,
  paymentMethod: true,
  paymentReceived: true,
  pickedUpBy: true,
} satisfies Prisma.DeliveryTicketSelect;

type WalkInRecord = Prisma.DeliveryTicketGetPayload<{
  select: typeof WALK_IN_SELECT;
}>;

const ACTIVE_PICKUP_STATUSES = ["DRAFT", "SCHEDULED"] as const;

function formatDate(value: Date | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function toRow(record: WalkInRecord): WalkInRow {
  return {
    id: record.id,
    ticketNumber: record.ticketNumber,
    ticketType: record.ticketType,
    customerName: record.customerName,
    projectName: record.projectName,
    jobNumber: record.jobNumber,
    status: record.status,
    dateLabel: formatDate(record.deliveryDate),
    timeLabel: record.deliveryTime,
    totalItems: record.totalItems,
    paymentMethod: record.paymentMethod,
    paymentReceived: record.paymentReceived,
    pickedUpBy: record.pickedUpBy,
  };
}

export default async function WalkInsPage() {
  await requirePermission(AppPermission.DELIVERY_VIEW);

  const completedCutoff = new Date();
  completedCutoff.setDate(completedCutoff.getDate() - 30);

  const [calledInRecords, completedRecords] = await withDatabaseRetry((prisma) =>
    Promise.all([
      prisma.deliveryTicket.findMany({
        where: {
          fulfillmentMethod: "PICKUP",
          status: { in: [...ACTIVE_PICKUP_STATUSES] },
        },
        orderBy: [{ deliveryDate: "asc" }, { createdAt: "asc" }],
        select: WALK_IN_SELECT,
      }),
      prisma.deliveryTicket.findMany({
        where: {
          fulfillmentMethod: "PICKUP",
          status: "DELIVERED",
          updatedAt: { gte: completedCutoff },
        },
        orderBy: { updatedAt: "desc" },
        take: 24,
        select: WALK_IN_SELECT,
      }),
    ]),
  );

  return (
    <DashboardShell
      title="Walk-Ins & Pickups"
      subtitle="Front-desk counter sales and pre-arranged customer pickups."
    >
      <WalkInsBoard
        calledIn={calledInRecords.map(toRow)}
        completed={completedRecords.map(toRow)}
      />
    </DashboardShell>
  );
}
