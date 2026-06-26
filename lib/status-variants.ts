/** Badge tone used across list and detail views. */
export type StatusVariant =
  | "success"
  | "info"
  | "warning"
  | "neutral"
  | "default"
  | "danger";

export function quoteStatusVariant(status: string): StatusVariant {
  switch (status) {
    case "WON":
      return "success";
    case "SENT":
    case "IN_REVIEW":
      return "info";
    case "REVISED":
      return "warning";
    case "LOST":
    case "LOST_BC":
    case "EXPIRED":
    case "CANCELLED":
      return "neutral";
    default:
      return "default";
  }
}

export function jobStatusVariant(status: string): StatusVariant {
  switch (status) {
    case "ACTIVE":
    case "AWARDED":
    case "COMPLETE":
      return "success";
    case "QUOTING":
    case "SUBMITTED":
    case "LEAD":
      return "info";
    case "ON_HOLD":
      return "warning";
    case "LOST":
    case "CANCELLED":
      return "danger";
    default:
      return "neutral";
  }
}

export function deliveryTicketStatusVariant(status: string): StatusVariant {
  if (status === "DELIVERED") return "success";
  if (status === "IN_TRANSIT" || status === "LOADING") return "warning";
  if (status === "SCHEDULED") return "info";
  if (status === "CANCELLED") return "neutral";
  return "default";
}

export function customerStatusVariant(status: string): StatusVariant {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "PROSPECT":
      return "warning";
    default:
      return "neutral";
  }
}

export function productStatusVariant(status: string): StatusVariant {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "DISCONTINUED":
      return "warning";
    default:
      return "neutral";
  }
}

export function productTypeVariant(productType: string): StatusVariant {
  switch (productType) {
    case "STOCK":
      return "success";
    case "CONFIGURABLE":
      return "info";
    case "CUSTOM_STRUCTURE":
      return "warning";
    default:
      return "neutral";
  }
}
