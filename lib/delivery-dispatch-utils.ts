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

/**
 * Rolling dispatch window: the reference day itself (even on a weekend),
 * followed by the next business days (Mon–Fri) until `count` columns exist.
 */
export function getDispatchDays(
  reference = new Date(),
  count = 5,
): WeekdayColumn[] {
  const actualTodayIso = formatDateIso(startOfDay(new Date()));
  const days: WeekdayColumn[] = [];

  const cursor = startOfDay(reference);
  while (days.length < count) {
    const isFirstColumn = days.length === 0;
    const weekday = cursor.getDay();
    if (isFirstColumn || (weekday !== 0 && weekday !== 6)) {
      const date = new Date(cursor);
      const dateIso = formatDateIso(date);
      days.push({
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
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
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

/**
 * Leading integer of a loadSequence label ("3 of 7" → 3). Sequences are
 * compared numerically because a string sort puts "10 of 12" before "2 of 12".
 */
export function parseLoadSequence(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const match = /^\s*(\d+)/.exec(value);
  return match ? Number(match[1]) : null;
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
