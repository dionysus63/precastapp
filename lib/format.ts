type DecimalLike = { toString(): string } | number | null | undefined;

type FormatUsdOptions = {
  /** Shown when value is null, undefined, or non-finite. Default `"—"`. */
  nullDisplay?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

export function formatUsd(
  value: DecimalLike,
  options?: FormatUsdOptions,
): string {
  const nullDisplay = options?.nullDisplay ?? "—";
  if (value == null) {
    return nullDisplay;
  }

  const amount =
    typeof value === "number" ? value : Number.parseFloat(value.toString());
  if (!Number.isFinite(amount)) {
    return nullDisplay;
  }

  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: options?.minimumFractionDigits ?? 2,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  });
}

export function formatWeightLb(value: DecimalLike): string {
  if (value == null) {
    return "—";
  }

  const amount =
    typeof value === "number" ? value : Number.parseFloat(value.toString());
  if (!Number.isFinite(amount) || amount <= 0) {
    return "—";
  }

  return `${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })} lb`;
}

export function formatYards(value: DecimalLike): string {
  if (value == null) {
    return "—";
  }

  const amount =
    typeof value === "number" ? value : Number.parseFloat(value.toString());
  if (!Number.isFinite(amount) || amount <= 0) {
    return "—";
  }

  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function formatQuantity(value: DecimalLike): string {
  if (value == null) {
    return "—";
  }

  const amount =
    typeof value === "number" ? value : Number.parseFloat(value.toString());
  if (!Number.isFinite(amount)) {
    return typeof value === "object" ? value.toString() : "—";
  }

  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

export function formatDateShort(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
