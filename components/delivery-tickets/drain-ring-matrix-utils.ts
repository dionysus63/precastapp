import type {
  DrainRingOption,
  QuoteLineFulfillment,
} from "@/lib/delivery-fulfillment";
import type { DrainRingStyle } from "@/lib/drain-ring-utils";

const COMPLETED_QUANTITY_EPSILON = 0.001;

const STYLE_SORT_ORDER: Record<DrainRingStyle, number> = {
  DRAIN: 0,
  SANITARY: 1,
  SOLID: 2,
};

export type DrainRingQuantityValue = {
  raw: string;
  numeric: number;
};

export type DrainRingMatrixRow = {
  line: QuoteLineFulfillment;
  quantitiesByProductId: Record<string, DrainRingQuantityValue>;
  selectedCount: number;
  selectedFeet: number;
  /** Feet already on other open (not yet delivered) tickets. */
  scheduledElsewhereFeet: number;
  /** remainingQty net of scheduledElsewhereFeet — what this load can still take. */
  availableFeet: number;
  remainingAfterSelected: number;
  overByFeet: number;
  state: "remaining" | "completed" | "scheduled";
};

export type DrainRingOptionStockStatus =
  | "not_tracked"
  | "available"
  | "out_of_stock"
  | "short"
  | "unknown";

export type DrainRingMatrixOption = {
  option: DrainRingOption;
  selectedCount: number;
  stockStatus: DrainRingOptionStockStatus;
  shortageCount: number;
};

export type DrainRingStyleMatrix = {
  key: string;
  style: DrainRingStyle;
  options: DrainRingMatrixOption[];
  rows: DrainRingMatrixRow[];
  selectedCount: number;
  selectedFeet: number;
  remainingLineCount: number;
  completedLineCount: number;
};

export type DrainRingDiameterGroup = {
  key: string;
  diameterFeet: number | null;
  matrices: DrainRingStyleMatrix[];
  selectedCount: number;
  selectedFeet: number;
  remainingLineCount: number;
  completedLineCount: number;
};

type QuantityLine = {
  readonly quantity: string;
};

type PendingStyleMatrix = {
  style: DrainRingStyle;
  lines: QuoteLineFulfillment[];
};

type PendingDiameterGroup = {
  key: string;
  diameterFeet: number | null;
  matrices: Map<DrainRingStyle, PendingStyleMatrix>;
};

export function drainRingQuantityKey(
  quoteLineItemId: string,
  productId: string,
): string {
  return `${quoteLineItemId}::${productId}`;
}

/**
 * Ring-builder descriptions repeat the diameter/style before a compact,
 * quote-specific suffix. In a diameter matrix only that suffix is useful.
 */
export function getDrainRingQuotedGroupLabel(displayName: string): string {
  const trimmed = displayName.trim();
  const separatorIndex = trimmed.lastIndexOf(" - ");
  if (separatorIndex < 0) {
    return trimmed;
  }

  const suffix = trimmed.slice(separatorIndex + 3).trim();
  return suffix || trimmed;
}

export type DrainRingQuotedGroupParts = {
  fullLabel: string;
  poolCountLabel: string;
  depthLabel: string | null;
};

/** Split `5 Pools @ 29'-0" Deep` into compact labels for the matrix row. */
export function getDrainRingQuotedGroupParts(
  displayName: string,
): DrainRingQuotedGroupParts {
  const fullLabel = getDrainRingQuotedGroupLabel(displayName);
  const match = fullLabel.match(/^(.+?\bPools?)\s*@\s*(.+)$/i);
  if (!match) {
    return {
      fullLabel,
      poolCountLabel: fullLabel,
      depthLabel: null,
    };
  }

  return {
    fullLabel,
    poolCountLabel: match[1].trim(),
    depthLabel: match[2].trim(),
  };
}

function roundQuantity(value: number): number {
  const rounded = Math.round(value * 10_000) / 10_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function parsePositiveQuantity(value: string): number {
  if (!value.trim()) {
    return 0;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function normalizedDiameter(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  return Object.is(value, -0) ? 0 : value;
}

function diameterKey(diameterFeet: number | null): string {
  return diameterFeet == null ? "diameter:unknown" : `diameter:${diameterFeet}`;
}

function optionStockState(
  option: DrainRingOption,
  selectedCount: number,
): Pick<DrainRingMatrixOption, "stockStatus" | "shortageCount"> {
  if (!option.trackInventory) {
    return { stockStatus: "not_tracked", shortageCount: 0 };
  }
  if (option.currentStock == null) {
    return { stockStatus: "unknown", shortageCount: 0 };
  }

  const onHand = Math.max(0, option.currentStock);
  if (selectedCount > onHand) {
    return {
      stockStatus: "short",
      shortageCount: roundQuantity(selectedCount - onHand),
    };
  }
  if (onHand <= 0) {
    return { stockStatus: "out_of_stock", shortageCount: 0 };
  }
  return { stockStatus: "available", shortageCount: 0 };
}

function buildStyleMatrix(
  diameterGroupKey: string,
  pending: PendingStyleMatrix,
  linesByKey: ReadonlyMap<string, QuantityLine>,
  onOpenLoads?: Record<string, number>,
): DrainRingStyleMatrix {
  const lines = [...pending.lines].sort(
    (left, right) =>
      left.lineNumber - right.lineNumber ||
      left.quoteLineItemId.localeCompare(right.quoteLineItemId),
  );

  const optionByProductId = new Map<string, DrainRingOption>();
  for (const line of lines) {
    for (const option of line.drainRingOptions) {
      if (
        option.drainRingStyle === pending.style &&
        !optionByProductId.has(option.productId)
      ) {
        optionByProductId.set(option.productId, option);
      }
    }
  }
  const options = [...optionByProductId.values()].sort(
    (left, right) =>
      left.heightFeet - right.heightFeet ||
      left.productCode.localeCompare(right.productCode) ||
      left.productId.localeCompare(right.productId),
  );

  const selectedByProductId = new Map<string, number>();
  const rows = lines.map<DrainRingMatrixRow>((line) => {
    const quantitiesByProductId: Record<string, DrainRingQuantityValue> = {};
    let selectedCount = 0;
    let selectedFeet = 0;

    for (const option of options) {
      const raw =
        linesByKey.get(
          drainRingQuantityKey(line.quoteLineItemId, option.productId),
        )?.quantity ?? "";
      const numeric = parsePositiveQuantity(raw);
      quantitiesByProductId[option.productId] = { raw, numeric };
      selectedCount += numeric;
      selectedFeet += numeric * option.heightFeet;
      selectedByProductId.set(
        option.productId,
        (selectedByProductId.get(option.productId) ?? 0) + numeric,
      );
    }

    selectedCount = roundQuantity(selectedCount);
    selectedFeet = roundQuantity(selectedFeet);
    const scheduledElsewhereFeet = roundQuantity(
      Math.max(0, onOpenLoads?.[line.quoteLineItemId] ?? 0),
    );
    const availableRaw = line.remainingQty - scheduledElsewhereFeet;
    const availableFeet =
      availableRaw <= COMPLETED_QUANTITY_EPSILON ? 0 : roundQuantity(availableRaw);
    const remainingDifference = availableFeet - selectedFeet;
    const remainingAfterSelected =
      Math.abs(remainingDifference) <= COMPLETED_QUANTITY_EPSILON
        ? 0
        : roundQuantity(remainingDifference);
    const overByFeet =
      selectedFeet > availableFeet + COMPLETED_QUANTITY_EPSILON
        ? roundQuantity(selectedFeet - availableFeet)
        : 0;

    return {
      line,
      quantitiesByProductId,
      selectedCount,
      selectedFeet,
      scheduledElsewhereFeet,
      availableFeet,
      remainingAfterSelected,
      overByFeet,
      state:
        line.remainingQty <= COMPLETED_QUANTITY_EPSILON
          ? "completed"
          : availableFeet <= COMPLETED_QUANTITY_EPSILON
            ? "scheduled"
            : "remaining",
    };
  });

  const matrixOptions = options.map<DrainRingMatrixOption>((option) => {
    const selectedCount = roundQuantity(
      selectedByProductId.get(option.productId) ?? 0,
    );
    return {
      option,
      selectedCount,
      ...optionStockState(option, selectedCount),
    };
  });

  return {
    key: `${diameterGroupKey}:${pending.style}`,
    style: pending.style,
    options: matrixOptions,
    rows,
    selectedCount: roundQuantity(
      rows.reduce((sum, row) => sum + row.selectedCount, 0),
    ),
    selectedFeet: roundQuantity(
      rows.reduce((sum, row) => sum + row.selectedFeet, 0),
    ),
    remainingLineCount: rows.filter((row) => row.state === "remaining").length,
    completedLineCount: rows.filter((row) => row.state === "completed").length,
  };
}

export function buildDrainRingDiameterGroups(
  fulfillment: readonly QuoteLineFulfillment[],
  linesByKey: ReadonlyMap<string, QuantityLine>,
  onOpenLoads?: Record<string, number>,
): DrainRingDiameterGroup[] {
  const pendingGroups = new Map<string, PendingDiameterGroup>();

  for (const line of fulfillment) {
    if (!line.isDrainRing) {
      continue;
    }

    const diameterFeet = normalizedDiameter(line.ringDiameterFeet);
    const key = diameterKey(diameterFeet);
    let group = pendingGroups.get(key);
    if (!group) {
      group = {
        key,
        diameterFeet,
        matrices: new Map(),
      };
      pendingGroups.set(key, group);
    }

    let matrix = group.matrices.get(line.drainRingStyle);
    if (!matrix) {
      matrix = { style: line.drainRingStyle, lines: [] };
      group.matrices.set(line.drainRingStyle, matrix);
    }
    matrix.lines.push(line);
  }

  return [...pendingGroups.values()]
    .sort((left, right) => {
      if (left.diameterFeet == null) {
        return right.diameterFeet == null ? 0 : 1;
      }
      if (right.diameterFeet == null) {
        return -1;
      }
      return left.diameterFeet - right.diameterFeet;
    })
    .map<DrainRingDiameterGroup>((pendingGroup) => {
      const matrices = [...pendingGroup.matrices.values()]
        .sort(
          (left, right) =>
            STYLE_SORT_ORDER[left.style] - STYLE_SORT_ORDER[right.style],
        )
        .map((matrix) =>
          buildStyleMatrix(pendingGroup.key, matrix, linesByKey, onOpenLoads),
        );

      return {
        key: pendingGroup.key,
        diameterFeet: pendingGroup.diameterFeet,
        matrices,
        selectedCount: roundQuantity(
          matrices.reduce((sum, matrix) => sum + matrix.selectedCount, 0),
        ),
        selectedFeet: roundQuantity(
          matrices.reduce((sum, matrix) => sum + matrix.selectedFeet, 0),
        ),
        remainingLineCount: matrices.reduce(
          (sum, matrix) => sum + matrix.remainingLineCount,
          0,
        ),
        completedLineCount: matrices.reduce(
          (sum, matrix) => sum + matrix.completedLineCount,
          0,
        ),
      };
    });
}
