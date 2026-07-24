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

export type RingAutoAssignment = {
  line: QuoteLineFulfillment;
  option: DrainRingOption;
  count: number;
};

export type RingAutoAssignResult =
  | { ok: true; assignments: RingAutoAssignment[] }
  | { ok: false; reason: string };

/** A pool group that auto-assignment can place rings into. */
export type RingAllocationBin = {
  line: QuoteLineFulfillment;
  /** Feet this pool group can still take (net of anything already placed). */
  capacityFeet: number;
};

/**
 * Distribute ring counts across pool-group bins automatically.
 *
 * Allocation always re-solves from scratch for the full desired counts —
 * never incrementally on top of a previous pick — so an earlier ring that
 * happened to land in one pool can never block a combination that fits when
 * arranged differently. A greedy best-fit-decreasing pass handles the common
 * case instantly; when it dead-ends, an exact backtracking search proves
 * whether ANY arrangement fits before the combination is rejected (greedy
 * alone wrongly fails layouts like pools 8'+6' with rings 4+4+3+3).
 */
export function allocateRingsToBins(
  allocationBins: readonly RingAllocationBin[],
  ringOptions: readonly DrainRingOption[],
  desiredCounts: Record<string, number>,
): RingAutoAssignResult {
  type Bin = {
    line: QuoteLineFulfillment;
    capacity: number;
    used: number;
    optionsById: Map<string, DrainRingOption>;
    counts: Map<string, number>;
  };

  const bins: Bin[] = allocationBins.map((bin) => ({
    line: bin.line,
    capacity: bin.capacityFeet,
    used: 0,
    optionsById: new Map(
      bin.line.drainRingOptions.map((option) => [option.productId, option]),
    ),
    counts: new Map(),
  }));

  const rings: { productId: string; heightFeet: number }[] = [];
  let desiredFeet = 0;
  for (const option of ringOptions) {
    const { productId, heightFeet } = option;
    const count = Math.max(0, Math.floor(desiredCounts[productId] ?? 0));
    for (let i = 0; i < count; i += 1) {
      rings.push({ productId, heightFeet });
      desiredFeet += heightFeet;
    }
  }
  rings.sort((a, b) => b.heightFeet - a.heightFeet);

  const totalCapacity = roundQuantity(
    bins.reduce((sum, bin) => sum + bin.capacity, 0),
  );

  const buildResult = (): RingAutoAssignResult => {
    const assignments: RingAutoAssignment[] = [];
    for (const bin of bins) {
      for (const [productId, count] of bin.counts) {
        assignments.push({
          line: bin.line,
          option: bin.optionsById.get(productId)!,
          count,
        });
      }
    }
    return { ok: true, assignments };
  };

  const failure = (): RingAutoAssignResult => {
    if (desiredFeet > totalCapacity + COMPLETED_QUANTITY_EPSILON) {
      return {
        ok: false,
        reason: `Only ${totalCapacity} LF left across these pools.`,
      };
    }
    const poolFeet = bins
      .map((bin) => roundQuantity(bin.capacity))
      .filter((feet) => feet > 0)
      .sort((a, b) => b - a)
      .join("' + ");
    return {
      ok: false,
      reason: `No arrangement of those ring heights fits the remaining pool feet (${poolFeet}' left per pool) — assign by pool instead.`,
    };
  };

  // Fast path: best-fit decreasing.
  let greedyFailed = false;
  for (const ring of rings) {
    let best: Bin | null = null;
    for (const bin of bins) {
      if (!bin.optionsById.has(ring.productId)) {
        continue;
      }
      const remaining = bin.capacity - bin.used;
      if (remaining + COMPLETED_QUANTITY_EPSILON < ring.heightFeet) {
        continue;
      }
      if (!best || remaining < best.capacity - best.used) {
        best = bin;
      }
    }
    if (!best) {
      greedyFailed = true;
      break;
    }
    best.used += ring.heightFeet;
    best.counts.set(ring.productId, (best.counts.get(ring.productId) ?? 0) + 1);
  }
  if (!greedyFailed) {
    return buildResult();
  }
  if (desiredFeet > totalCapacity + COMPLETED_QUANTITY_EPSILON) {
    return failure();
  }

  // Exact search: greedy dead-ended but the total fits, so backtrack over
  // ring→bin placements. Identical rings only move to same-or-later bins
  // than their predecessor (symmetry breaking) and each ring skips bins
  // whose remaining capacity it already tried (equivalent-state pruning),
  // which keeps real-world sizes (tens of rings, a handful of pools) tiny.
  for (const bin of bins) {
    bin.used = 0;
    bin.counts.clear();
  }
  let nodesLeft = 200_000;
  const placement: number[] = new Array(rings.length).fill(-1);
  // Bins are interchangeable for pruning only when they accept the same
  // ring SKUs — pool lines in one diameter group normally all do.
  const binSignatures = bins.map((bin) =>
    [...bin.optionsById.keys()].sort().join(","),
  );

  const search = (ringIndex: number): boolean => {
    if (ringIndex === rings.length) {
      return true;
    }
    if (nodesLeft-- <= 0) {
      return false;
    }
    const ring = rings[ringIndex];
    const minBinIndex =
      ringIndex > 0 && rings[ringIndex - 1].productId === ring.productId
        ? placement[ringIndex - 1]
        : 0;
    const triedStates = new Set<string>();
    for (let binIndex = minBinIndex; binIndex < bins.length; binIndex += 1) {
      const bin = bins[binIndex];
      if (!bin.optionsById.has(ring.productId)) {
        continue;
      }
      const remaining = roundQuantity(bin.capacity - bin.used);
      if (remaining + COMPLETED_QUANTITY_EPSILON < ring.heightFeet) {
        continue;
      }
      const stateKey = `${remaining}|${binSignatures[binIndex]}`;
      if (triedStates.has(stateKey)) {
        continue;
      }
      triedStates.add(stateKey);
      bin.used += ring.heightFeet;
      placement[ringIndex] = binIndex;
      if (search(ringIndex + 1)) {
        return true;
      }
      bin.used -= ring.heightFeet;
      placement[ringIndex] = -1;
    }
    return false;
  };

  if (!search(0)) {
    return failure();
  }
  for (let ringIndex = 0; ringIndex < rings.length; ringIndex += 1) {
    const bin = bins[placement[ringIndex]];
    const { productId } = rings[ringIndex];
    bin.counts.set(productId, (bin.counts.get(productId) ?? 0) + 1);
  }
  return buildResult();
}

/** Auto-assign against a single-ticket style matrix (the ticket editor). */
export function allocateRingsAcrossPools(
  matrix: DrainRingStyleMatrix,
  desiredCounts: Record<string, number>,
): RingAutoAssignResult {
  return allocateRingsToBins(
    matrix.rows
      .filter((row) => row.state !== "completed" && row.line.eligible)
      .map((row) => ({ line: row.line, capacityFeet: row.availableFeet })),
    matrix.options.map((matrixOption) => matrixOption.option),
    desiredCounts,
  );
}

export type RingLoadAllocationResult =
  | {
      ok: true;
      /** Per load (input order): `${quoteLineItemId}::${productId}` → count. */
      countsByLoad: Map<string, number>[];
    }
  | { ok: false; loadIndex: number; reason: string };

/**
 * Auto-assign ring counts for a sequence of loads sharing the same pool
 * groups (the bulk load planner). Every call re-solves all loads from
 * scratch: each load's rings are packed against what the earlier loads in
 * the sequence left behind, so a ring that landed in one pool on load 1 can
 * never block a combination that fits when arranged differently.
 */
export function allocateRingsForLoads(
  lines: readonly QuoteLineFulfillment[],
  availableFeetByLineId: ReadonlyMap<string, number>,
  ringOptions: readonly DrainRingOption[],
  desiredCountsByLoad: readonly Record<string, number>[],
): RingLoadAllocationResult {
  const capacity = new Map(availableFeetByLineId);
  const assignableLines = lines.filter(
    (line) =>
      line.eligible && line.remainingQty > COMPLETED_QUANTITY_EPSILON,
  );
  const countsByLoad: Map<string, number>[] = [];

  for (let loadIndex = 0; loadIndex < desiredCountsByLoad.length; loadIndex += 1) {
    const bins: RingAllocationBin[] = assignableLines.map((line) => ({
      line,
      capacityFeet: capacity.get(line.quoteLineItemId) ?? 0,
    }));
    const result = allocateRingsToBins(
      bins,
      ringOptions,
      desiredCountsByLoad[loadIndex],
    );
    if (!result.ok) {
      return { ok: false, loadIndex, reason: result.reason };
    }
    const loadCounts = new Map<string, number>();
    for (const assignment of result.assignments) {
      const lineId = assignment.line.quoteLineItemId;
      capacity.set(
        lineId,
        roundQuantity(
          (capacity.get(lineId) ?? 0) -
            assignment.count * assignment.option.heightFeet,
        ),
      );
      loadCounts.set(
        drainRingQuantityKey(lineId, assignment.option.productId),
        assignment.count,
      );
    }
    countsByLoad.push(loadCounts);
  }

  return { ok: true, countsByLoad };
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
