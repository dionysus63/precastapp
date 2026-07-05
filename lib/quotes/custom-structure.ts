import type { CustomStructureCostItem } from "@/lib/quotes/types";

export const CUSTOM_STRUCTURE_CONFIG_KIND = "CUSTOM_STRUCTURE" as const;

export type CustomStructureConfigJson = {
  kind: typeof CUSTOM_STRUCTURE_CONFIG_KIND;
  costBreakdown: Array<{
    id: string;
    label: string;
    qty: number;
    unitCost: number;
  }>;
};

function parseNumber(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function createCostItemId(): string {
  return `cost-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createDefaultCostItem(): CustomStructureCostItem {
  return {
    id: createCostItemId(),
    label: "",
    qty: "1",
    unitCost: "",
  };
}

export function getCostItemExtendedTotal(item: CustomStructureCostItem): number {
  return parseNumber(item.qty) * parseNumber(item.unitCost);
}

export function sumCostBreakdown(items: CustomStructureCostItem[] | null | undefined): number {
  if (!items?.length) {
    return 0;
  }
  return items.reduce((sum, item) => sum + getCostItemExtendedTotal(item), 0);
}

export function hasCostBreakdown(items: CustomStructureCostItem[] | null | undefined): boolean {
  return Boolean(items?.length);
}

export function resolveCustomStructureUnitPrice(
  unitPrice: string,
  costItems: CustomStructureCostItem[] | null | undefined,
): string {
  if (hasCostBreakdown(costItems)) {
    return String(sumCostBreakdown(costItems));
  }
  return unitPrice || "0";
}

export function serializeCustomStructureConfig(
  costBreakdown: CustomStructureCostItem[] | null | undefined,
): CustomStructureConfigJson | null {
  if (!costBreakdown?.length) {
    return null;
  }

  return {
    kind: CUSTOM_STRUCTURE_CONFIG_KIND,
    costBreakdown: costBreakdown.map((item) => ({
      id: item.id,
      label: item.label.trim(),
      qty: parseNumber(item.qty),
      unitCost: parseNumber(item.unitCost),
    })),
  };
}

export function parseCustomStructureConfigJson(
  value: unknown,
): CustomStructureCostItem[] | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as Record<string, unknown>;
  if (data.kind !== CUSTOM_STRUCTURE_CONFIG_KIND) {
    return null;
  }

  if (!Array.isArray(data.costBreakdown)) {
    return null;
  }

  const items: CustomStructureCostItem[] = [];
  for (const entry of data.costBreakdown) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== "string") {
      continue;
    }
    items.push({
      id: row.id,
      label: typeof row.label === "string" ? row.label : "",
      qty:
        typeof row.qty === "number"
          ? String(row.qty)
          : typeof row.qty === "string"
            ? row.qty
            : "1",
      unitCost:
        typeof row.unitCost === "number"
          ? String(row.unitCost)
          : typeof row.unitCost === "string"
            ? row.unitCost
            : "",
    });
  }

  return items.length > 0 ? items : null;
}
