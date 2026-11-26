import { Decimal } from "@/lib/decimal";
import { parsePriceInput } from "@/lib/pricing/price-input";

/**
 * The structure price sheets of the Pricing screen: the numbers a drill
 * sheet uses to work out a structure's price, and a ring's price per foot.
 * Safe to import from both server and client modules.
 */

export const STRUCTURE_PRICE_TABLE_KEYS = [
  "molds",
  "rectTemplates",
  "boots",
  "rectOpenings",
  "rings",
] as const;

export type StructurePriceTableKey = (typeof STRUCTURE_PRICE_TABLE_KEYS)[number];

export function isStructurePriceTableKey(
  value: unknown,
): value is StructurePriceTableKey {
  return (
    typeof value === "string" &&
    (STRUCTURE_PRICE_TABLE_KEYS as readonly string[]).includes(value)
  );
}

export type StructurePriceColumn = {
  key: string;
  label: string;
  /**
   * "price": part of what this price list holds for the row. "feet": a plain
   * number kept on the row itself, the same on every price list.
   */
  kind: "price" | "feet";
};

export type StructurePriceTableDefinition = {
  title: string;
  /** Header of the first column. */
  rowLabel: string;
  columns: StructurePriceColumn[];
  /** Where rows of this table are added and removed. */
  home: { href: string; label: string };
};

export const STRUCTURE_PRICE_TABLES: Record<
  StructurePriceTableKey,
  StructurePriceTableDefinition
> = {
  molds: {
    title: "Round Structures",
    rowLabel: "Mold",
    columns: [
      { key: "wallPricePerFoot", label: "Wall per Foot", kind: "price" },
      { key: "basePrice", label: "Base Price", kind: "price" },
    ],
    home: { href: "/settings/diameters", label: "Structure Molds" },
  },
  rectTemplates: {
    title: "Rectangular Structures",
    rowLabel: "Template",
    columns: [
      { key: "wallPricePerFoot", label: "Wall per Foot", kind: "price" },
      { key: "minPricingHeightFeet", label: "Minimum Feet Billed", kind: "feet" },
      { key: "topSlabPrice", label: "Top Slab", kind: "price" },
      { key: "baseSlabPrice", label: "Base Slab", kind: "price" },
    ],
    home: { href: "/structures", label: "Structure Templates" },
  },
  boots: {
    title: "Round Structure Openings",
    rowLabel: "Pipe",
    columns: [{ key: "pricePerBoot", label: "Price per Boot", kind: "price" }],
    home: { href: "/structures/pipe-openings", label: "Round Structure Openings" },
  },
  rectOpenings: {
    title: "Rectangular Structure Openings",
    rowLabel: "Pipe",
    columns: [{ key: "pricePerOpening", label: "Price per Opening", kind: "price" }],
    home: { href: "/structures/rect-openings", label: "Rect Structure Openings" },
  },
  rings: {
    title: "Rings",
    rowLabel: "Ring",
    columns: [{ key: "pricePerFoot", label: "List Price per Foot", kind: "price" }],
    home: { href: "/settings/rings", label: "Ring Builder" },
  },
};

export type StructurePriceRow = {
  id: string;
  label: string;
  /** A second, smaller line: what tells this row from its neighbours. */
  detail: string | null;
  /**
   * What this price list holds for the row, per column ("185.00"). Every
   * price column is null when the list has no numbers of its own.
   */
  values: Record<string, string | null>;
  /**
   * What the row is priced at while the list has no numbers of its own: the
   * default list's, or a ring's standard price. Null when there is nothing
   * to fall back on.
   */
  inherited: Record<string, string> | null;
  /** Columns that do not apply to this row (the top slab of a template without one). */
  disabledColumns: string[];
};

export type StructurePriceTables = Record<StructurePriceTableKey, StructurePriceRow[]>;

/** True when the list holds its own numbers for the row. */
export function rowHasOwnPrices(
  table: StructurePriceTableKey,
  row: Pick<StructurePriceRow, "values">,
): boolean {
  return STRUCTURE_PRICE_TABLES[table].columns.some(
    (column) => column.kind === "price" && row.values[column.key] != null,
  );
}

/** The largest value a Decimal(6,2) column holds. */
const MAX_FEET = new Decimal("9999.99");

type ParsedFeet = { ok: true; value: string | null } | { ok: false; error: string };

/** A number of feet as typed: "4", "2.5". Blank means none. */
export function parseFeetInput(raw: string): ParsedFeet {
  const trimmed = raw.trim().replace(/'$/, "").trim();
  if (trimmed === "") {
    return { ok: true, value: null };
  }
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(trimmed)) {
    return { ok: false, error: "Type a number of feet such as 4 or 2.5." };
  }
  const value = new Decimal(trimmed);
  if (!value.toDecimalPlaces(2).equals(value)) {
    return { ok: false, error: "Feet take at most two decimal places." };
  }
  if (value.gt(MAX_FEET)) {
    return { ok: false, error: "That number of feet is too large." };
  }
  return { ok: true, value: value.toFixed(2) };
}

export type ResolvedStructurePriceRow =
  | {
      ok: true;
      /**
       * The prices the list is to hold for the row, one per price column;
       * null takes the row's numbers off the list.
       */
      prices: Record<string, string> | null;
      /** The numbers kept on the row itself (null = none). */
      shared: Record<string, string | null>;
    }
  | { ok: false; error: string };

/**
 * What a row is saved as, from what was typed in its boxes.
 *
 * A price list holds a row's prices together, so:
 * - every price box blank takes the row off the list (it falls back to the
 *   default list, or has no price);
 * - a box left blank beside a typed one takes the price the row was falling
 *   back on, when the list had no numbers of its own for it yet, so typing
 *   one price never quietly zeroes the others; otherwise it is 0;
 * - a column that does not apply to the row is always 0.
 */
export function resolveStructurePriceRow(
  table: StructurePriceTableKey,
  typed: Record<string, string | null | undefined>,
  row: Pick<StructurePriceRow, "values" | "inherited" | "disabledColumns">,
): ResolvedStructurePriceRow {
  const { columns } = STRUCTURE_PRICE_TABLES[table];
  const hadOwnPrices = rowHasOwnPrices(table, row);
  const typedPrices: Record<string, string | null> = {};
  const shared: Record<string, string | null> = {};

  for (const column of columns) {
    const raw = String(typed[column.key] ?? "");
    if (column.kind === "feet") {
      const parsed = parseFeetInput(raw);
      if (!parsed.ok) {
        return { ok: false, error: `${column.label}: ${parsed.error}` };
      }
      shared[column.key] = parsed.value;
      continue;
    }
    if (row.disabledColumns.includes(column.key)) {
      typedPrices[column.key] = null;
      continue;
    }
    const parsed = parsePriceInput(raw);
    if (!parsed.ok) {
      return { ok: false, error: `${column.label}: ${parsed.error}` };
    }
    typedPrices[column.key] = parsed.value;
  }

  const priceColumns = columns.filter((column) => column.kind === "price");
  const anyTyped = priceColumns.some((column) => typedPrices[column.key] != null);
  if (!anyTyped) {
    return { ok: true, prices: null, shared };
  }

  const prices: Record<string, string> = {};
  for (const column of priceColumns) {
    const typedPrice = typedPrices[column.key];
    if (typedPrice != null) {
      prices[column.key] = typedPrice;
    } else if (row.disabledColumns.includes(column.key)) {
      prices[column.key] = "0.00";
    } else {
      prices[column.key] =
        (!hadOwnPrices ? row.inherited?.[column.key] : undefined) ?? "0.00";
    }
  }
  return { ok: true, prices, shared };
}

/**
 * Whatever was copied, as rows of cells. Excel puts a tab between columns
 * and a line break between rows, and usually ends with one extra line break.
 */
export function splitPastedBlock(text: string): string[][] {
  const rows = text.replace(/\r\n?/g, "\n").split("\n");
  while (rows.length > 0 && rows[rows.length - 1].trim() === "") {
    rows.pop();
  }
  return rows.map((row) =>
    row.split("\t").map((cell) => cell.trim().replace(/^"(.*)"$/, "$1").trim()),
  );
}
