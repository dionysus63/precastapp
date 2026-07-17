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
    case "DETAILING":
      return "info";
    case "ON_HOLD":
      return "warning";
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

export function purchaseOrderStatusVariant(status: string): StatusVariant {
  switch (status) {
    case "RECEIVED":
      return "success";
    case "PARTIALLY_RECEIVED":
      return "warning";
    case "ISSUED":
      return "info";
    case "CANCELLED":
      return "neutral";
    default:
      return "default";
  }
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
    case "STOCK_PRECAST":
    case "ACCESSORY":
    case "PRECAST_PIPE":
    case "ADS_PIPE":
      return "success";
    case "CASTING":
      return "info";
    case "CONFIGURABLE":
      return "warning";
    default:
      return "neutral";
  }
}
