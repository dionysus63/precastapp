import type { QuotePipeProductOption } from "@/lib/quotes/types";
import { formatUsd } from "@/lib/format";
import { formatAdsPipeJointTypeLabel } from "@/lib/ads-pipe-utils";

export const PIPE_UNIT_PRICES_TITLE = "Pipe Unit Prices";

export type PipeUnitPriceEntry = {
  label: string;
  pricePerFoot: number;
};

export type PipeQuoteProductType = "ADS_PIPE" | "PRECAST_PIPE";

export function roundPipeFeetToSticks(
  feet: number,
  stickLengthFeet: number,
): number {
  if (!Number.isFinite(feet) || feet <= 0) {
    return 0;
  }
  if (!Number.isFinite(stickLengthFeet) || stickLengthFeet <= 0) {
    return feet;
  }
  return Math.ceil(feet / stickLengthFeet) * stickLengthFeet;
}

export function formatPipeUnitPrice(value: number | string): string {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
}

export function formatPipeDiameterLabel(diameterInches: number): string {
  const rounded =
    Math.abs(diameterInches - Math.round(diameterInches)) < 0.01
      ? String(Math.round(diameterInches))
      : diameterInches.toFixed(1).replace(/\.0$/, "");
  return `${rounded}"`;
}

export function formatPipeQuoteLabel(product: QuotePipeProductOption): string {
  const diameter = formatPipeDiameterLabel(product.pipeDiameterInches);
  if (product.productType === "ADS_PIPE") {
    const jointLabel = formatAdsPipeJointTypeLabel(product.pipeJointType);
    const shortJoint =
      jointLabel === "Watertight (WT)"
        ? "Watertight"
        : jointLabel === "Soiltight (ST)"
          ? "Soiltight"
          : jointLabel;
    return `${diameter} ADS ${shortJoint}`;
  }

  const classPart = product.pipeClass?.trim()
    ? ` Class ${product.pipeClass.trim()}`
    : "";
  return `${diameter} RCP${classPart}`;
}

export function formatPipeStickRoundUpSummary(
  requestedFeet: number,
  stickLengthFeet: number,
): string {
  const roundedFeet = roundPipeFeetToSticks(requestedFeet, stickLengthFeet);
  const pieceCount =
    stickLengthFeet > 0 ? Math.round(roundedFeet / stickLengthFeet) : 0;
  return `${requestedFeet}' → ${roundedFeet}' (${pieceCount} × ${stickLengthFeet}')`;
}

export function formatPipeQuoteLineDescription(
  product: QuotePipeProductOption,
  requestedFeet: number,
  roundedFeet: number,
): string {
  const base = product.description.trim() || product.name.trim() || product.code;
  if (requestedFeet === roundedFeet) {
    return base;
  }
  const pieceCount =
    product.pipeLengthFeet > 0
      ? Math.round(roundedFeet / product.pipeLengthFeet)
      : 0;
  return `${base} — ${requestedFeet}' requested, ${roundedFeet}' billed (${pieceCount} × ${product.pipeLengthFeet}')`;
}

export function formatPipeUnitPriceLine(entry: PipeUnitPriceEntry): string {
  return `${entry.label} — ${formatUsd(entry.pricePerFoot)}/LF`;
}

export function buildPipeUnitPricesDescription(
  entries: PipeUnitPriceEntry[],
): string {
  const lines = entries.map((entry) => formatPipeUnitPriceLine(entry));
  return [PIPE_UNIT_PRICES_TITLE, ...lines].join("\n");
}

export function parsePipeUnitPricesDescription(
  description: string,
): { entries: PipeUnitPriceEntry[] } | null {
  const plain = description.replace(/\r\n/g, "\n").trim();
  if (!plain.startsWith(PIPE_UNIT_PRICES_TITLE)) {
    return null;
  }

  const lines = plain.split("\n").slice(1);
  const entries: PipeUnitPriceEntry[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const match = trimmed.match(/^(.+?)\s+—\s+\$?([\d,]+(?:\.\d+)?)\/LF\s*$/);
    if (!match) {
      continue;
    }

    const label = match[1]!.trim();
    const pricePerFoot = Number.parseFloat(match[2]!.replace(/,/g, ""));
    if (!label || !Number.isFinite(pricePerFoot)) {
      continue;
    }

    entries.push({ label, pricePerFoot });
  }

  return { entries };
}

export function mergePipeUnitPriceEntries(
  existing: PipeUnitPriceEntry[],
  incoming: PipeUnitPriceEntry[],
): PipeUnitPriceEntry[] {
  const merged = new Map<string, PipeUnitPriceEntry>();

  for (const entry of existing) {
    merged.set(entry.label.toLowerCase(), entry);
  }
  for (const entry of incoming) {
    merged.set(entry.label.toLowerCase(), entry);
  }

  return Array.from(merged.values()).sort((left, right) =>
    left.label.localeCompare(right.label, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );
}

export function isPipeUnitPricesLineItem(line: {
  type: string;
  description: string;
}): boolean {
  return (
    line.type === "CATEGORY" &&
    line.description.trim().startsWith(PIPE_UNIT_PRICES_TITLE)
  );
}

export function filterPipeProductsByType(
  products: QuotePipeProductOption[],
  pipeType: PipeQuoteProductType,
): QuotePipeProductOption[] {
  return products
    .filter((product) => product.productType === pipeType)
    .sort((left, right) => {
      if (left.pipeDiameterInches !== right.pipeDiameterInches) {
        return left.pipeDiameterInches - right.pipeDiameterInches;
      }
      return left.code.localeCompare(right.code);
    });
}

export function computePipeLineWeightLb(
  product: QuotePipeProductOption,
  roundedFeet: number,
): number {
  if (product.weightLb <= 0 || product.pipeLengthFeet <= 0 || roundedFeet <= 0) {
    return 0;
  }
  const weightPerFoot = product.weightLb / product.pipeLengthFeet;
  return Math.round(weightPerFoot * roundedFeet);
}
