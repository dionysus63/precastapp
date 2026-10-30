/**
 * Delivery site resolution shared by delivery ticket PDFs, invoices, the
 * ticket detail page and the job delivery schedule.
 *
 * Where a load goes and who to call on site live on the Job
 * (`deliveryAddress`, `siteContact*`) and are editable from the job page once
 * the job is awarded. Tickets carry their own copies of the same columns:
 *
 * - Address: the ticket's own address wins when set, then the job's delivery
 *   address, then the job's project (postal) address, then the quote's.
 * - Site contact: the job's contact wins when set. A ticket's own contact is
 *   only ever the customer's FIELD/primary contact auto-filled on creation,
 *   so a contact typed on the job is the deliberate one.
 */

export type DeliverySiteContact = {
  name: string | null;
  phone: string | null;
  email: string | null;
};

export type SiteContactFields = {
  siteContactName?: string | null;
  siteContactPhone?: string | null;
  siteContactEmail?: string | null;
};

export type JobDeliverySiteFields = SiteContactFields & {
  deliveryAddress?: string | null;
  projectAddress?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

export function formatPostalAddressLines(
  address: string | null | undefined,
  town: string | null | undefined,
  state: string | null | undefined,
  zip: string | null | undefined,
): string[] {
  const lines: string[] = [];
  if (address?.trim()) {
    lines.push(address.trim());
  }
  const cityStateZip = [town?.trim(), state?.trim()].filter(Boolean).join(", ");
  const cityLine = [cityStateZip, zip?.trim()].filter(Boolean).join(" ");
  if (cityLine) {
    lines.push(cityLine);
  }
  return lines;
}

export function splitMultilineAddress(value: string | null | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function trimmedOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** True when any of name / phone / email is filled in. */
export function hasSiteContact(fields: SiteContactFields | null | undefined): boolean {
  return Boolean(
    fields &&
      (trimmedOrNull(fields.siteContactName) ||
        trimmedOrNull(fields.siteContactPhone) ||
        trimmedOrNull(fields.siteContactEmail)),
  );
}

function toSiteContact(fields: SiteContactFields): DeliverySiteContact {
  return {
    name: trimmedOrNull(fields.siteContactName),
    phone: trimmedOrNull(fields.siteContactPhone),
    email: trimmedOrNull(fields.siteContactEmail),
  };
}

/**
 * Delivery address lines for a ticket: ticket → job delivery address → job
 * project address → quote project address.
 */
export function resolveTicketDeliveryAddressLines(ticket: {
  deliveryAddress: string | null;
  job?: JobDeliverySiteFields | null;
  quote?: { projectAddress: string | null } | null;
}): string[] {
  const ticketAddress = splitMultilineAddress(ticket.deliveryAddress);
  if (ticketAddress.length > 0) {
    return ticketAddress;
  }

  if (ticket.job) {
    const jobDeliveryAddress = splitMultilineAddress(ticket.job.deliveryAddress);
    if (jobDeliveryAddress.length > 0) {
      return jobDeliveryAddress;
    }
    const jobAddress = formatPostalAddressLines(
      ticket.job.projectAddress,
      ticket.job.city,
      ticket.job.state,
      ticket.job.zip,
    );
    if (jobAddress.length > 0) {
      return jobAddress;
    }
  }

  return splitMultilineAddress(ticket.quote?.projectAddress);
}

/** Site contact for a ticket: the job's when set, else the ticket's own. */
export function resolveTicketSiteContact(ticket: {
  siteContactName: string | null;
  siteContactPhone: string | null;
  siteContactEmail?: string | null;
  job?: SiteContactFields | null;
}): DeliverySiteContact {
  if (hasSiteContact(ticket.job)) {
    return toSiteContact(ticket.job!);
  }
  return toSiteContact(ticket);
}

/**
 * Delivery address lines for the job itself (schedule PDF, job page): the
 * job's delivery address, else its project address.
 */
export function resolveJobDeliveryAddressLines(job: JobDeliverySiteFields): string[] {
  const deliveryAddress = splitMultilineAddress(job.deliveryAddress);
  if (deliveryAddress.length > 0) {
    return deliveryAddress;
  }
  return formatPostalAddressLines(job.projectAddress, job.city, job.state, job.zip);
}
