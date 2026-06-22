import type { DeliveryTicketRow } from "@/components/delivery-tickets/delivery-ticket-utils";

export type WeekdayColumn = {
  date: Date;
  dateIso: string;
  label: string;
  isToday: boolean;
};

const DISPATCH_STATUSES = new Set(["SCHEDULED", "LOADING", "IN_TRANSIT"]);

export function formatDateIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function getCurrentWeekWeekdays(reference = new Date()): WeekdayColumn[] {
  const anchor = startOfDay(reference);
  const day = anchor.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() + mondayOffset);

  const actualTodayIso = formatDateIso(startOfDay(new Date()));
  const weekdays: WeekdayColumn[] = [];

  for (let index = 0; index < 5; index += 1) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const dateIso = formatDateIso(date);
    weekdays.push({
      date,
      dateIso,
      label: date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      isToday: dateIso === actualTodayIso,
    });
  }

  return weekdays;
}

export function formatWeekRangeLabel(weekdays: WeekdayColumn[]): string {
  if (weekdays.length === 0) {
    return "Week";
  }

  const first = weekdays[0].date;
  const last = weekdays[weekdays.length - 1].date;
  const sameYear = first.getFullYear() === last.getFullYear();
  const startFormat: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  };
  const endFormat: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };

  const start = first.toLocaleDateString("en-US", startFormat);
  const end = last.toLocaleDateString("en-US", endFormat);
  return `${start} – ${end}`;
}

export function isDispatchTicket(ticket: DeliveryTicketRow): boolean {
  return (
    DISPATCH_STATUSES.has(ticket.status) &&
    Boolean(ticket.deliveryDateIso)
  );
}

export function groupTicketsByDeliveryDate(
  tickets: DeliveryTicketRow[],
  weekdays: WeekdayColumn[],
): Map<string, DeliveryTicketRow[]> {
  const grouped = new Map<string, DeliveryTicketRow[]>(
    weekdays.map((day) => [day.dateIso, []]),
  );

  for (const ticket of tickets) {
    if (!isDispatchTicket(ticket) || !ticket.deliveryDateIso) {
      continue;
    }
    const bucket = grouped.get(ticket.deliveryDateIso);
    if (bucket) {
      bucket.push(ticket);
    }
  }

  for (const bucket of grouped.values()) {
    bucket.sort((a, b) => {
      const timeA = a.deliveryTime ?? "";
      const timeB = b.deliveryTime ?? "";
      if (timeA && timeB && timeA !== timeB) {
        return timeA.localeCompare(timeB);
      }
      return a.ticketNumber.localeCompare(b.ticketNumber);
    });
  }

  return grouped;
}

export function getTodaysScheduledLoads(
  tickets: DeliveryTicketRow[],
  reference = new Date(),
): DeliveryTicketRow[] {
  const todayIso = formatDateIso(startOfDay(reference));
  return tickets
    .filter(
      (ticket) =>
        isDispatchTicket(ticket) && ticket.deliveryDateIso === todayIso,
    )
    .sort((a, b) => {
      const timeA = a.deliveryTime ?? "";
      const timeB = b.deliveryTime ?? "";
      if (timeA && timeB && timeA !== timeB) {
        return timeA.localeCompare(timeB);
      }
      return a.ticketNumber.localeCompare(b.ticketNumber);
    });
}
