"use client";

import Link from "next/link";
import { randomId } from "@/lib/random-id";
import { useRouter } from "next/navigation";
import {
  Fragment,
  useCallback,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  savePlannedLoads,
  type DeliveryTicketLineInput,
  type PlannedLoadInput,
  type SavePlannedLoadsInput,
} from "@/app/delivery-tickets/actions";
import { allocateRingsForLoads } from "@/components/delivery-tickets/drain-ring-matrix-utils";
import { formatCastingPieceRoleLabel } from "@/lib/casting-utils";
import type {
  DrainRingOption,
  QuoteLineFulfillment,
} from "@/lib/delivery-fulfillment";
import { formatDrainRingStyleLabel } from "@/lib/drain-ring-utils";
import { formatQuantity, formatWeightLb } from "@/lib/format";
import { useUnsavedChangesWarning } from "@/lib/hooks/use-unsaved-changes-warning";
import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableGridCellClassName,
  tableHeaderCellClassName,
  tableNumericCellClassName,
  tableNumericCellInputClassName,
  tableRowClassName,
  tableWrapperClassName,
} from "@/lib/table-styles";

type ExistingTicketSummary = {
  id: string;
  ticketNumber: string;
  status: string;
  deliveryDate: string | null;
  loadSequence: string | null;
  totalWeight: number | null;
};

/** An existing DRAFT ticket rendered as a pre-filled, editable load column. */
export type DraftLoadColumn = {
  ticketId: string;
  ticketNumber: string;
  expectedUpdatedAt: string;
  /** rowKey → quantity string, as the planner grid keys its cells. */
  cells: Record<string, string>;
};

export type BulkLoadPlannerProps = {
  jobId: string;
  quoteId: string;
  fulfillment: QuoteLineFulfillment[];
  /** Quantities committed on open tickets NOT managed by this grid, per quote line (LF for drain rings). */
  scheduled: Record<string, number>;
  draftColumns: DraftLoadColumn[];
  existingTickets: ExistingTicketSummary[];
  loadCapacityLabel: string;
  loadCapacityLbs: number | null;
};

// Loads are anonymous columns until saved — dates, drivers, and trailers are
// assigned later on the scheduling page. Columns backed by an existing DRAFT
// ticket carry its identity and concurrency token.
type LoadDraft = {
  key: string;
  ticketId?: string;
  ticketNumber?: string;
  expectedUpdatedAt?: string;
};

type DeletedTicket = {
  ticketId: string;
  ticketNumber: string;
  expectedUpdatedAt: string;
  /** rowKey → quantity, captured at removal so undo can restore the column. */
  cells: Record<string, string>;
};

type ItemRow = {
  kind: "item";
  key: string;
  groupKey: string;
  navRow: number;
  indent: boolean;
  itemCode: string;
  displayName: string;
  detail: string | null;
  warning: string | null;
  unit: string;
  weightEach: number | null;
  /** Drain rings assign EA but consume the quote line in LF. */
  feetPerUnit: number | null;
  /** Casting pieces: how many of this piece one complete set needs. */
  perSetQty: number | null;
  quoteLineItemId: string;
  productId: string | null;
  jobStructureId: string | null;
  lineType: DeliveryTicketLineInput["lineType"];
  description: string | null;
};

type GroupHeaderRow = {
  kind: "group";
  key: string;
  groupKey: string;
  itemCode: string;
  displayName: string;
};

type CategoryRow = { kind: "category"; key: string; label: string };

type IneligibleRow = {
  kind: "ineligible";
  key: string;
  itemCode: string;
  displayName: string;
  reason: string;
};

type PlannerRow = ItemRow | GroupHeaderRow | CategoryRow | IneligibleRow;

type Group = {
  key: string;
  available: number;
  unitLabel: string;
  isDrainRing: boolean;
  /** Casting assemblies count complete sets: min across the piece rows. */
  isCastingAssembly: boolean;
  /** Castings only: total pieces in one complete set. */
  piecesPerSet: number | null;
  scheduledQty: number;
  /**
   * Weight per accounting unit (lb/EA, lb/LF for drain rings derived from
   * ring weight ÷ ring height, or lb per complete set for castings). Null
   * when no weight is on file.
   */
  weightPerUnit: number | null;
};

type ExcludedLine = { itemCode: string; displayName: string };

type RingMode = "pool" | "auto";

/**
 * Every drain-ring quote line of one diameter+style, viewed as a single
 * assignable unit for auto mode. The per-pool cells stay the source of
 * truth — auto inputs show sums and every edit re-solves the split across
 * pools (for all load columns, in order) and writes the result back.
 */
type RingStyleGroup = {
  key: string;
  title: string;
  lines: QuoteLineFulfillment[];
  /** Every ring height offered across the group's pool lines, shortest first. */
  options: DrainRingOption[];
  /** LF each pool line can still take (remaining net of open tickets). */
  availableByLineId: Map<string, number>;
  totalAvailableFeet: number;
  /** First planner row belonging to this group — where the section renders. */
  anchorRowKey: string | null;
  /** Keyboard-nav row index reused by the auto input for each ring height. */
  navRowByProductId: Map<string, number>;
  /** Row keys of the group's per-pool item rows (the cells auto mode writes). */
  itemRowKeys: Set<string>;
};

function cellKey(rowKey: string, loadKey: string): string {
  return `${rowKey}|${loadKey}`;
}

function parseQty(value: string | undefined): number {
  if (!value?.trim()) return 0;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function roundQty(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function makeLoad(): LoadDraft {
  return { key: randomId() };
}

function buildRows(
  fulfillment: QuoteLineFulfillment[],
  scheduled: Record<string, number>,
  // Row keys referenced by existing draft columns. Seeded lines render as
  // editable rows even when ineligible or fully committed — otherwise a
  // draft's quantities would be invisible and silently dropped on save.
  // validateLines remains the final arbiter when the plan is saved.
  seededRowKeys: Set<string>,
) {
  const rows: PlannerRow[] = [];
  const groups = new Map<string, Group>();
  const excludedCastings: ExcludedLine[] = [];
  let navRow = 0;

  for (const meta of fulfillment) {
    if (meta.lineType === "CATEGORY") {
      rows.push({
        kind: "category",
        key: meta.quoteLineItemId,
        label: meta.displayName || meta.itemCode,
      });
      continue;
    }

    if (meta.isCastingAssembly && meta.castingComponentOptions.length === 0) {
      // No BOM pieces to assign — the single-ticket editor is the only home.
      excludedCastings.push({
        itemCode: meta.itemCode,
        displayName: meta.displayName,
      });
      continue;
    }

    const scheduledQty = scheduled[meta.quoteLineItemId] ?? 0;
    const available = Math.max(0, meta.remainingQty - scheduledQty);

    const optionKeys = meta.isDrainRing
      ? meta.drainRingOptions.map(
          (option) => `${meta.quoteLineItemId}::${option.productId}`,
        )
      : meta.isAdsPipe
        ? meta.adsPipeOptions.map(
            (option) => `${meta.quoteLineItemId}::${option.productId}`,
          )
        : meta.isCastingAssembly
          ? meta.castingComponentOptions.map(
              (option) => `${meta.quoteLineItemId}::${option.productId}`,
            )
          : [meta.quoteLineItemId];
    const hasSeededCells = optionKeys.some((key) => seededRowKeys.has(key));

    if ((!meta.eligible || available <= 0) && !hasSeededCells) {
      rows.push({
        kind: "ineligible",
        key: meta.quoteLineItemId,
        itemCode: meta.itemCode,
        displayName: meta.displayName,
        reason: !meta.eligible
          ? (meta.eligibilityReason ?? "Not available")
          : scheduledQty > 0
            ? "Fully committed on open tickets"
            : "Fully shipped",
      });
      continue;
    }

    if (meta.isDrainRing) {
      const rateOption = meta.drainRingOptions.find(
        (option) => option.weightEach != null && option.heightFeet > 0,
      );
      groups.set(meta.quoteLineItemId, {
        key: meta.quoteLineItemId,
        available,
        unitLabel: "LF",
        isDrainRing: true,
        isCastingAssembly: false,
        piecesPerSet: null,
        scheduledQty,
        weightPerUnit:
          rateOption && rateOption.weightEach != null
            ? rateOption.weightEach / rateOption.heightFeet
            : null,
      });
      rows.push({
        kind: "group",
        key: `group-${meta.quoteLineItemId}`,
        groupKey: meta.quoteLineItemId,
        itemCode: meta.itemCode,
        displayName: meta.displayName,
      });
      for (const option of meta.drainRingOptions) {
        rows.push({
          kind: "item",
          key: `${meta.quoteLineItemId}::${option.productId}`,
          groupKey: meta.quoteLineItemId,
          navRow: navRow++,
          indent: true,
          itemCode: option.productCode,
          displayName: option.name,
          detail: `${option.heightFeet}' ring`,
          warning:
            option.trackInventory &&
            option.currentStock != null &&
            option.currentStock <= 0
              ? "No stock"
              : null,
          unit: "EA",
          weightEach: option.weightEach,
          feetPerUnit: option.heightFeet,
          perSetQty: null,
          quoteLineItemId: meta.quoteLineItemId,
          productId: option.productId,
          jobStructureId: null,
          lineType: "STOCK_PRODUCT",
          description: `${option.name} (${option.heightFeet}' ring)`,
        });
      }
      continue;
    }

    if (meta.isAdsPipe) {
      groups.set(meta.quoteLineItemId, {
        key: meta.quoteLineItemId,
        available,
        unitLabel: meta.unit,
        isDrainRing: false,
        isCastingAssembly: false,
        piecesPerSet: null,
        scheduledQty,
        weightPerUnit:
          meta.adsPipeOptions.find((option) => option.weightEach != null)
            ?.weightEach ?? null,
      });
      rows.push({
        kind: "group",
        key: `group-${meta.quoteLineItemId}`,
        groupKey: meta.quoteLineItemId,
        itemCode: meta.itemCode,
        displayName: meta.displayName,
      });
      for (const option of meta.adsPipeOptions) {
        rows.push({
          kind: "item",
          key: `${meta.quoteLineItemId}::${option.productId}`,
          groupKey: meta.quoteLineItemId,
          navRow: navRow++,
          indent: true,
          itemCode: option.productCode,
          displayName: option.name,
          detail: option.isSubstitute
            ? `${option.jointTypeLabel} — substitute`
            : option.jointTypeLabel,
          warning:
            option.currentStock != null && option.currentStock <= 0
              ? "No stock"
              : null,
          unit: meta.unit,
          weightEach: option.weightEach,
          feetPerUnit: null,
          perSetQty: null,
          quoteLineItemId: meta.quoteLineItemId,
          productId: option.productId,
          jobStructureId: null,
          lineType: "STOCK_PRODUCT",
          description: option.isSubstitute
            ? `${option.name} — substitute`
            : option.name,
        });
      }
      continue;
    }

    if (meta.isCastingAssembly) {
      // Assemblies ship as component pieces; a complete set needs every
      // piece. Same product in two roles merges into one row so grid cells
      // and ticket lines stay keyed by product.
      const pieceRows = new Map<
        string,
        { option: (typeof meta.castingComponentOptions)[number]; perSetQty: number; roles: string[] }
      >();
      for (const option of meta.castingComponentOptions) {
        const existing = pieceRows.get(option.productId);
        if (existing) {
          existing.perSetQty += option.quantity;
          existing.roles.push(formatCastingPieceRoleLabel(option.pieceRole));
        } else {
          pieceRows.set(option.productId, {
            option,
            perSetQty: option.quantity,
            roles: [formatCastingPieceRoleLabel(option.pieceRole)],
          });
        }
      }

      let setWeight = 0;
      let setWeightComplete = true;
      for (const piece of pieceRows.values()) {
        if (piece.option.weightEach == null) {
          setWeightComplete = false;
        } else {
          setWeight += piece.option.weightEach * piece.perSetQty;
        }
      }

      groups.set(meta.quoteLineItemId, {
        key: meta.quoteLineItemId,
        available,
        unitLabel: "sets",
        isDrainRing: false,
        isCastingAssembly: true,
        piecesPerSet: [...pieceRows.values()].reduce(
          (sum, piece) => sum + piece.perSetQty,
          0,
        ),
        scheduledQty,
        weightPerUnit: setWeightComplete ? setWeight : null,
      });
      rows.push({
        kind: "group",
        key: `group-${meta.quoteLineItemId}`,
        groupKey: meta.quoteLineItemId,
        itemCode: meta.itemCode,
        displayName: meta.displayName,
      });
      for (const piece of pieceRows.values()) {
        const roleLabel = piece.roles.join(" + ");
        rows.push({
          kind: "item",
          key: `${meta.quoteLineItemId}::${piece.option.productId}`,
          groupKey: meta.quoteLineItemId,
          navRow: navRow++,
          indent: true,
          itemCode: piece.option.productCode,
          displayName: piece.option.name,
          detail:
            piece.perSetQty > 1
              ? `${roleLabel} — ${piece.perSetQty}/set`
              : roleLabel,
          warning:
            piece.option.trackInventory &&
            piece.option.currentStock != null &&
            piece.option.currentStock <= 0
              ? "No stock"
              : null,
          unit: "EA",
          weightEach: piece.option.weightEach,
          feetPerUnit: null,
          perSetQty: piece.perSetQty,
          quoteLineItemId: meta.quoteLineItemId,
          productId: piece.option.productId,
          jobStructureId: null,
          lineType: "STOCK_PRODUCT",
          description: `${piece.option.name} (${roleLabel})`,
        });
      }
      continue;
    }

    groups.set(meta.quoteLineItemId, {
      key: meta.quoteLineItemId,
      available,
      unitLabel: meta.unit,
      isDrainRing: false,
      isCastingAssembly: false,
      piecesPerSet: null,
      scheduledQty,
      weightPerUnit: meta.weightEach,
    });
    rows.push({
      kind: "item",
      key: meta.quoteLineItemId,
      groupKey: meta.quoteLineItemId,
      navRow: navRow++,
      indent: false,
      itemCode: meta.itemCode,
      displayName: meta.displayName,
      detail: null,
      warning: meta.eligibilityReason,
      unit: meta.unit,
      weightEach: meta.weightEach,
      feetPerUnit: null,
      perSetQty: null,
      quoteLineItemId: meta.quoteLineItemId,
      productId: meta.productId,
      jobStructureId: meta.jobStructureId,
      lineType: meta.lineType as DeliveryTicketLineInput["lineType"],
      description: meta.description,
    });
  }

  const editableRows = rows.filter((row): row is ItemRow => row.kind === "item");
  return { rows, groups, editableRows, excludedCastings };
}

// Pinned columns: Item at left 0, Available beside it, Assigned/Left on the
// right edge. Item needs a fixed width so Available's left offset lines up.
const stickyItemCellClassName = `${tableCellClassName} sticky left-0 z-[5] w-64 min-w-[16rem] max-w-[16rem] bg-white`;
const stickyAvailableCellClassName = `${tableNumericCellClassName} sticky left-[16rem] z-[5] bg-white`;
// Inset line stands in for the missing left border while content scrolls under.
const stickyRightEdgeShadow = "shadow-[inset_2px_0_0_0_#cbd5e1]";
const stickyAssignedCellClassName = `${tableNumericCellClassName} sticky right-0 z-[5] bg-white ${stickyRightEdgeShadow}`;

function seedCellsFromDrafts(
  draftColumns: DraftLoadColumn[],
): Record<string, string> {
  const seeded: Record<string, string> = {};
  for (const draft of draftColumns) {
    for (const [rowKey, qty] of Object.entries(draft.cells)) {
      seeded[cellKey(rowKey, draft.ticketId)] = qty;
    }
  }
  return seeded;
}

export function BulkLoadPlanner({
  jobId,
  quoteId,
  fulfillment,
  scheduled,
  draftColumns,
  existingTickets,
  loadCapacityLabel,
  loadCapacityLbs,
}: BulkLoadPlannerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saved, setSaved] = useState(false);

  const seededRowKeys = useMemo(
    () =>
      new Set(draftColumns.flatMap((draft) => Object.keys(draft.cells))),
    [draftColumns],
  );

  const { rows, groups, editableRows, excludedCastings } = useMemo(
    () => buildRows(fulfillment, scheduled, seededRowKeys),
    [fulfillment, scheduled, seededRowKeys],
  );

  // Drain rings grouped by diameter+style for the auto/pool assignment
  // toggle, mirroring the single-ticket editor's ring matrix.
  const ringStyleGroups = useMemo(() => {
    const byKey = new Map<string, RingStyleGroup>();
    const keyByLineId = new Map<string, string>();

    for (const meta of fulfillment) {
      if (!meta.isDrainRing) continue;
      const key = `${meta.ringDiameterFeet ?? "unknown"}:${meta.drainRingStyle}`;
      keyByLineId.set(meta.quoteLineItemId, key);
      let group = byKey.get(key);
      if (!group) {
        group = {
          key,
          title:
            meta.ringDiameterFeet != null
              ? `${meta.ringDiameterFeet}'Ø ${formatDrainRingStyleLabel(meta.drainRingStyle)} Rings`
              : `${formatDrainRingStyleLabel(meta.drainRingStyle)} Rings`,
          lines: [],
          options: [],
          availableByLineId: new Map(),
          totalAvailableFeet: 0,
          anchorRowKey: null,
          navRowByProductId: new Map(),
          itemRowKeys: new Set(),
        };
        byKey.set(key, group);
      }
      group.lines.push(meta);
      const available = Math.max(
        0,
        roundQty(meta.remainingQty - (scheduled[meta.quoteLineItemId] ?? 0)),
      );
      group.availableByLineId.set(meta.quoteLineItemId, available);
      group.totalAvailableFeet = roundQty(group.totalAvailableFeet + available);
    }

    for (const group of byKey.values()) {
      group.lines.sort(
        (left, right) =>
          left.lineNumber - right.lineNumber ||
          left.quoteLineItemId.localeCompare(right.quoteLineItemId),
      );
      const optionById = new Map<string, DrainRingOption>();
      for (const line of group.lines) {
        for (const option of line.drainRingOptions) {
          if (!optionById.has(option.productId)) {
            optionById.set(option.productId, option);
          }
        }
      }
      group.options = [...optionById.values()].sort(
        (left, right) =>
          left.heightFeet - right.heightFeet ||
          left.productCode.localeCompare(right.productCode) ||
          left.productId.localeCompare(right.productId),
      );
    }

    for (const row of rows) {
      const lineId =
        row.kind === "group"
          ? row.groupKey
          : row.kind === "item"
            ? row.quoteLineItemId
            : row.kind === "ineligible"
              ? row.key
              : null;
      if (!lineId) continue;
      const key = keyByLineId.get(lineId);
      if (!key) continue;
      const group = byKey.get(key)!;
      if (group.anchorRowKey == null) {
        group.anchorRowKey = row.key;
      }
      if (row.kind === "item" && row.productId) {
        group.itemRowKeys.add(row.key);
        if (!group.navRowByProductId.has(row.productId)) {
          group.navRowByProductId.set(row.productId, row.navRow);
        }
      }
    }

    return { byKey, keyByLineId };
  }, [fulfillment, scheduled, rows]);

  // Auto-assign is the default, matching the single-ticket editor.
  const [ringModes, setRingModes] = useState<Record<string, RingMode>>({});
  const [autoRingErrors, setAutoRingErrors] = useState<
    Record<string, string | null>
  >({});

  function getRingMode(key: string): RingMode {
    return ringModes[key] ?? "auto";
  }

  function toggleRingMode(key: string) {
    setRingModes((current) => ({
      ...current,
      [key]: (current[key] ?? "auto") === "auto" ? "pool" : "auto",
    }));
    setAutoRingErrors((current) => ({ ...current, [key]: null }));
  }

  /** What the auto input shows: this ring height's count summed across pools. */
  function autoRingCount(
    group: RingStyleGroup,
    productId: string,
    loadKey: string,
  ): number {
    let total = 0;
    for (const line of group.lines) {
      total += parseQty(
        cells[cellKey(`${line.quoteLineItemId}::${productId}`, loadKey)],
      );
    }
    return roundQty(total);
  }

  /**
   * Auto-mode edit: re-solve the pool split from scratch for every load
   * column in order (earlier loads consume pool feet before later ones), so
   * an earlier ring that landed in one pool can never block a combination
   * that fits when arranged differently. On success the per-pool cells for
   * the whole group are rewritten; on failure nothing changes and the error
   * names the load that can't fit.
   */
  function handleAutoRingChange(
    group: RingStyleGroup,
    productId: string,
    loadKey: string,
    rawValue: string,
  ) {
    const numeric = Number(rawValue);
    const editedCount =
      rawValue.trim() !== "" && Number.isFinite(numeric) && numeric > 0
        ? Math.floor(numeric)
        : 0;

    const desiredByLoad = loads.map((load) => {
      const desired: Record<string, number> = {};
      for (const option of group.options) {
        desired[option.productId] =
          load.key === loadKey && option.productId === productId
            ? editedCount
            : autoRingCount(group, option.productId, load.key);
      }
      return desired;
    });

    const result = allocateRingsForLoads(
      group.lines,
      group.availableByLineId,
      group.options,
      desiredByLoad,
    );
    if (!result.ok) {
      const failedLoad = loads[result.loadIndex];
      const label =
        failedLoad?.ticketNumber ?? `Load ${result.loadIndex + 1}`;
      setAutoRingErrors((current) => ({
        ...current,
        [group.key]: `${label}: ${result.reason}`,
      }));
      return;
    }

    setAutoRingErrors((current) => ({ ...current, [group.key]: null }));
    setCells((current) => {
      const next = { ...current };
      loads.forEach((load, index) => {
        for (const rowKey of group.itemRowKeys) {
          const count = result.countsByLoad[index].get(rowKey) ?? 0;
          next[cellKey(rowKey, load.key)] = count > 0 ? String(count) : "";
        }
      });
      return next;
    });
  }

  // Job-level outlook: what's left to deliver and how many loads that is.
  const remaining = useMemo(() => {
    let weight = 0;
    let pieces = 0;
    let hasRingFootage = false;
    let complete = true;
    for (const group of groups.values()) {
      if (group.weightPerUnit != null) {
        weight += group.available * group.weightPerUnit;
      } else {
        complete = false;
      }
      if (group.isDrainRing) {
        if (group.available > 0) hasRingFootage = true;
      } else {
        // A casting set is several physical pieces on the load.
        pieces += group.available * (group.piecesPerSet ?? 1);
      }
    }
    return { weight, pieces: roundQty(pieces), hasRingFootage, complete };
  }, [groups]);

  const expectedLoads =
    loadCapacityLbs && loadCapacityLbs > 0 && remaining.weight > 0
      ? Math.max(1, Math.ceil(remaining.weight / loadCapacityLbs))
      : null;

  // Existing drafts open as pre-filled columns; otherwise start with one
  // column per expected load (capped so an unusually heavy job doesn't
  // open with an unwieldy grid).
  const [loads, setLoads] = useState<LoadDraft[]>(() =>
    draftColumns.length > 0
      ? draftColumns.map((draft) => ({
          key: draft.ticketId,
          ticketId: draft.ticketId,
          ticketNumber: draft.ticketNumber,
          expectedUpdatedAt: draft.expectedUpdatedAt,
        }))
      : Array.from(
          { length: Math.min(15, Math.max(2, expectedLoads ?? 2)) },
          () => makeLoad(),
        ),
  );
  const [cells, setCells] = useState<Record<string, string>>(() =>
    seedCellsFromDrafts(draftColumns),
  );
  const baselineCells = useRef<Record<string, string>>(
    seedCellsFromDrafts(draftColumns),
  );
  const [deletedTickets, setDeletedTickets] = useState<DeletedTicket[]>([]);

  const isDirty = useMemo(() => {
    if (deletedTickets.length > 0) return true;
    const keys = new Set([
      ...Object.keys(cells),
      ...Object.keys(baselineCells.current),
    ]);
    for (const key of keys) {
      if (parseQty(cells[key]) !== parseQty(baselineCells.current[key])) {
        return true;
      }
    }
    return false;
  }, [cells, deletedTickets]);
  useUnsavedChangesWarning(isDirty && !saved);

  // Assigned per quote line across every load, in the group's accounting unit
  // (LF for drain rings, plain quantity otherwise).
  const groupAssigned = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of editableRows) {
      for (const load of loads) {
        const qty = parseQty(cells[cellKey(row.key, load.key)]);
        if (qty <= 0) continue;
        const amount = row.feetPerUnit != null ? qty * row.feetPerUnit : qty;
        map.set(row.groupKey, roundQty((map.get(row.groupKey) ?? 0) + amount));
      }
    }
    return map;
  }, [cells, loads, editableRows]);

  // Per-item-row total across loads (what shows in the trailing column).
  const rowAssigned = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of editableRows) {
      let total = 0;
      for (const load of loads) {
        total += parseQty(cells[cellKey(row.key, load.key)]);
      }
      map.set(row.key, roundQty(total));
    }
    return map;
  }, [cells, loads, editableRows]);

  const loadTotals = useMemo(
    () =>
      loads.map((load) => {
        let weight = 0;
        let pieces = 0;
        let weightComplete = true;
        for (const row of editableRows) {
          const qty = parseQty(cells[cellKey(row.key, load.key)]);
          if (qty <= 0) continue;
          pieces = roundQty(pieces + qty);
          if (row.weightEach != null) {
            weight += qty * row.weightEach;
          } else {
            weightComplete = false;
          }
        }
        return { weight, pieces, weightComplete };
      }),
    [cells, loads, editableRows],
  );

  // Casting sets: complete sets are the min across piece rows; a piece row is
  // over-assigned when it exceeds available sets × pieces-per-set.
  const castingStats = useMemo(() => {
    const map = new Map<
      string,
      { sets: number; over: boolean; incomplete: boolean }
    >();
    for (const group of groups.values()) {
      if (!group.isCastingAssembly) continue;
      let sets = Number.POSITIVE_INFINITY;
      let over = false;
      let incomplete = false;
      for (const row of editableRows) {
        if (row.groupKey !== group.key) continue;
        const perSet = row.perSetQty ?? 1;
        const assigned = rowAssigned.get(row.key) ?? 0;
        if (assigned > group.available * perSet + 0.001) over = true;
        if (assigned < group.available * perSet - 0.001) incomplete = true;
        sets = Math.min(sets, Math.floor((assigned + 0.001) / perSet));
      }
      map.set(group.key, {
        sets: Number.isFinite(sets) ? sets : 0,
        over,
        incomplete,
      });
    }
    return map;
  }, [groups, editableRows, rowAssigned]);

  const overAssignedGroups = useMemo(() => {
    const set = new Set<string>();
    for (const [groupKey, assigned] of groupAssigned) {
      const group = groups.get(groupKey);
      if (group && !group.isCastingAssembly && assigned > group.available + 0.001) {
        set.add(groupKey);
      }
    }
    for (const [groupKey, stats] of castingStats) {
      if (stats.over) {
        set.add(groupKey);
      }
    }
    return set;
  }, [groupAssigned, groups, castingStats]);

  const totalPieces = loadTotals.reduce((sum, load) => sum + load.pieces, 0);
  const totalWeight = loadTotals.reduce((sum, load) => sum + load.weight, 0);
  const unassignedGroupCount = useMemo(() => {
    let count = 0;
    for (const group of groups.values()) {
      if (group.isCastingAssembly) {
        if (castingStats.get(group.key)?.incomplete) count += 1;
        continue;
      }
      const assigned = groupAssigned.get(group.key) ?? 0;
      if (assigned < group.available - 0.001) count += 1;
    }
    return count;
  }, [groups, groupAssigned, castingStats]);

  const nonEmptyLoads = loadTotals.filter((load) => load.pieces > 0).length;
  const hasExistingDrafts = loads.some((load) => load.ticketId);
  // With an empty baseline (create mode) any assignment is a change, so a
  // single dirty check covers both creating and re-planning.
  const canSubmit =
    isDirty && overAssignedGroups.size === 0 && !pending && !saved;

  // Excel-style navigation over the qty cells: same pattern as the other
  // editable grids (quote-line-items-table), scoped with data-plan-* attrs.
  const tableRef = useRef<HTMLTableElement>(null);
  const navRowCountRef = useRef(0);
  navRowCountRef.current = editableRows.length;
  const navColCountRef = useRef(0);
  navColCountRef.current = loads.length;

  const handleCellKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>, rowIndex: number, colIndex: number) => {
      const findCell = (row: number, col: number) =>
        tableRef.current?.querySelector<HTMLElement>(
          `[data-plan-row="${row}"][data-plan-col="${col}"]`,
        ) ?? null;

      const focusCell = (element: HTMLElement) => {
        element.focus();
        element.scrollIntoView({ block: "nearest", inline: "nearest" });
        if (element instanceof HTMLInputElement) {
          element.select();
        }
      };

      const rowCount = navRowCountRef.current;
      const colCount = navColCountRef.current;
      const target = event.currentTarget;

      if (event.key === "Tab" || event.key === "Enter") {
        const direction = event.shiftKey ? -1 : 1;
        let row = rowIndex;
        let col = colIndex;
        for (;;) {
          col += direction;
          if (col >= colCount) {
            col = 0;
            row += 1;
          } else if (col < 0) {
            col = colCount - 1;
            row -= 1;
          }
          if (row < 0 || row >= rowCount) {
            return;
          }
          const element = findCell(row, col);
          if (element) {
            event.preventDefault();
            focusCell(element);
            return;
          }
        }
      }

      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        const direction = event.key === "ArrowUp" ? -1 : 1;
        for (
          let row = rowIndex + direction;
          row >= 0 && row < rowCount;
          row += direction
        ) {
          const element = findCell(row, colIndex);
          if (element) {
            focusCell(element);
            return;
          }
        }
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        const direction = event.key === "ArrowLeft" ? -1 : 1;
        if (target instanceof HTMLInputElement) {
          // Only leave the cell when the caret is at the edge (or the whole
          // value is selected, as it is right after arriving), so left/right
          // still move the caret while editing.
          const length = target.value.length;
          const fullySelected =
            length > 0 &&
            target.selectionStart === 0 &&
            target.selectionEnd === length;
          const atEdge =
            direction < 0
              ? target.selectionStart === 0 && target.selectionEnd === 0
              : target.selectionStart === length &&
                target.selectionEnd === length;
          if (length > 0 && !fullySelected && !atEdge) {
            return;
          }
        }
        for (
          let col = colIndex + direction;
          col >= 0 && col < colCount;
          col += direction
        ) {
          const element = findCell(rowIndex, col);
          if (element) {
            event.preventDefault();
            focusCell(element);
            return;
          }
        }
      }
    },
    [],
  );

  function handlePaste(event: React.ClipboardEvent<HTMLTableElement>) {
    const text = event.clipboardData.getData("text/plain");
    if (!text.includes("\t") && !text.includes("\n")) {
      return;
    }
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.hasAttribute("data-plan-auto")) {
      // Auto ring inputs re-solve the pool split on change — grid paste
      // would bypass that, so let the input take the paste normally.
      return;
    }
    const rowAttr = active instanceof HTMLElement ? active.getAttribute("data-plan-row") : null;
    const colAttr = active instanceof HTMLElement ? active.getAttribute("data-plan-col") : null;
    if (rowAttr == null || colAttr == null) {
      return;
    }
    event.preventDefault();
    const startRow = Number(rowAttr);
    const startCol = Number(colAttr);
    const grid = text
      .replace(/\r/g, "")
      .split("\n")
      .filter((line, index, lines) => index < lines.length - 1 || line !== "")
      .map((line) => line.split("\t"));

    setCells((current) => {
      const next = { ...current };
      grid.forEach((columns, rowOffset) => {
        columns.forEach((rawValue, colOffset) => {
          const row = editableRows[startRow + rowOffset];
          const load = loads[startCol + colOffset];
          if (!row || !load) return;
          next[cellKey(row.key, load.key)] = rawValue.trim();
        });
      });
      return next;
    });
  }

  function setCell(rowKey: string, loadKey: string, value: string) {
    setCells((current) => ({ ...current, [cellKey(rowKey, loadKey)]: value }));
  }

  function addLoad() {
    setLoads((current) => [...current, makeLoad()]);
  }

  /** Match the column count to the expected load count — adding columns, or
   * trimming trailing columns that have nothing assigned yet. */
  function setColumnsToExpected() {
    if (!expectedLoads) return;
    setLoads((current) => {
      if (current.length < expectedLoads) {
        return [
          ...current,
          ...Array.from({ length: expectedLoads - current.length }, () =>
            makeLoad(),
          ),
        ];
      }
      const next = [...current];
      while (next.length > Math.max(1, expectedLoads)) {
        const last = next[next.length - 1];
        // Never trim a column backed by an existing ticket or holding data.
        if (last.ticketId) break;
        const hasData = editableRows.some(
          (row) => parseQty(cells[cellKey(row.key, last.key)]) > 0,
        );
        if (hasData) break;
        next.pop();
      }
      return next;
    });
  }

  function removeLoad(loadKey: string) {
    if (loads.length <= 1) return;
    const load = loads.find((entry) => entry.key === loadKey);
    if (!load) return;

    if (load.ticketId) {
      // Removing an existing draft marks it for deletion (with undo);
      // capture its quantities so undo can restore the column.
      const captured: Record<string, string> = {};
      const suffix = `|${loadKey}`;
      for (const [key, value] of Object.entries(cells)) {
        if (key.endsWith(suffix) && value.trim() !== "") {
          captured[key.slice(0, key.length - suffix.length)] = value;
        }
      }
      setDeletedTickets((current) => [
        ...current,
        {
          ticketId: load.ticketId!,
          ticketNumber: load.ticketNumber ?? "",
          expectedUpdatedAt: load.expectedUpdatedAt ?? "",
          cells: captured,
        },
      ]);
    }

    setLoads((current) => current.filter((entry) => entry.key !== loadKey));
    setCells((current) => {
      const next: Record<string, string> = {};
      for (const [key, value] of Object.entries(current)) {
        if (!key.endsWith(`|${loadKey}`)) {
          next[key] = value;
        }
      }
      return next;
    });
  }

  function undoDelete(ticketId: string) {
    const entry = deletedTickets.find((item) => item.ticketId === ticketId);
    if (!entry) return;
    setDeletedTickets((current) =>
      current.filter((item) => item.ticketId !== ticketId),
    );
    setLoads((current) => [
      ...current,
      {
        key: entry.ticketId,
        ticketId: entry.ticketId,
        ticketNumber: entry.ticketNumber,
        expectedUpdatedAt: entry.expectedUpdatedAt,
      },
    ]);
    setCells((current) => {
      const next = { ...current };
      for (const [rowKey, qty] of Object.entries(entry.cells)) {
        next[cellKey(rowKey, entry.ticketId)] = qty;
      }
      return next;
    });
  }

  /** One-click: put this row's unassigned remainder onto the last load. */
  function fillRemainder(row: ItemRow) {
    const group = groups.get(row.groupKey);
    if (!group || group.isDrainRing || group.isCastingAssembly) return;
    const assigned = groupAssigned.get(row.groupKey) ?? 0;
    const left = roundQty(group.available - assigned);
    if (left <= 0) return;
    const load = loads[loads.length - 1];
    if (!load) return;
    setCells((current) => {
      const key = cellKey(row.key, load.key);
      const existing = parseQty(current[key]);
      return { ...current, [key]: String(roundQty(existing + left)) };
    });
  }

  function buildLoadLines(loadKey: string): DeliveryTicketLineInput[] {
    const lines: DeliveryTicketLineInput[] = [];
    for (const row of editableRows) {
      const qty = parseQty(cells[cellKey(row.key, loadKey)]);
      if (qty <= 0) continue;
      lines.push({
        quoteLineItemId: row.quoteLineItemId,
        productId: row.productId,
        jobStructureId: row.jobStructureId,
        lineType: row.lineType,
        itemCode: row.itemCode,
        description: row.description,
        quantity: qty,
        unit: row.unit,
        weightEach: row.weightEach,
      });
    }
    return lines;
  }

  function buildPayload(): SavePlannedLoadsInput {
    const loadsPayload: PlannedLoadInput[] = [];
    const deletions = deletedTickets.map((entry) => ({
      ticketId: entry.ticketId,
      expectedUpdatedAt: entry.expectedUpdatedAt,
    }));

    for (const load of loads) {
      const lines = buildLoadLines(load.key);
      if (load.ticketId) {
        if (lines.length === 0) {
          // An existing draft emptied of items is a deletion.
          deletions.push({
            ticketId: load.ticketId,
            expectedUpdatedAt: load.expectedUpdatedAt ?? "",
          });
        } else {
          loadsPayload.push({
            ticketId: load.ticketId,
            expectedUpdatedAt: load.expectedUpdatedAt,
            lines,
          });
        }
      } else if (lines.length > 0) {
        loadsPayload.push({ lines });
      }
    }

    return { jobId, quoteId, loads: loadsPayload, deletions };
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await savePlannedLoads(buildPayload());
      if ("error" in result) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      setSaved(true);
      router.push(`/delivery-tickets/schedule?jobId=${jobId}`);
      router.refresh();
    });
  }

  /** Title row with the auto/pool toggle; carries the group totals in auto mode. */
  function renderRingStyleHeader(group: RingStyleGroup, mode: RingMode) {
    const assignedFeet = roundQty(
      group.lines.reduce(
        (sum, line) => sum + (groupAssigned.get(line.quoteLineItemId) ?? 0),
        0,
      ),
    );
    const leftFeet = roundQty(group.totalAvailableFeet - assignedFeet);
    const over = group.lines.some((line) =>
      overAssignedGroups.has(line.quoteLineItemId),
    );
    const error = autoRingErrors[group.key];

    return (
      <tr className="bg-slate-50/70">
        <td className={`${stickyItemCellClassName} !bg-slate-50`}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-800">{group.title}</span>
            <button
              type="button"
              onClick={() => toggleRingMode(group.key)}
              className="shrink-0 rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              {mode === "pool" ? "Auto-assign" : "Assign by pool"}
            </button>
          </div>
        </td>
        <td
          className={`${stickyAvailableCellClassName} !bg-slate-50 font-medium`}
        >
          {mode === "auto" ? (
            <>
              {formatQuantity(group.totalAvailableFeet)}{" "}
              <span className="text-slate-400">LF</span>
            </>
          ) : null}
        </td>
        <td
          colSpan={loads.length}
          className={`${tableCellClassName} text-[11px] ${
            error ? "font-medium text-red-700" : "text-slate-400"
          }`}
        >
          {error ??
            (mode === "auto"
              ? `Ring counts are split across ${group.lines.length} pool group${
                  group.lines.length === 1 ? "" : "s"
                } automatically.`
              : "Assigning rings by pool group below.")}
        </td>
        <td
          className={`${stickyAssignedCellClassName} font-medium ${
            over
              ? "!bg-red-50 text-red-700"
              : mode !== "auto"
                ? "!bg-slate-50"
                : leftFeet > 0.001
                  ? "!bg-slate-50 text-amber-600"
                  : "!bg-slate-50 text-emerald-700"
          }`}
        >
          {mode === "auto" ? (
            <>
              {formatQuantity(assignedFeet)} / {formatQuantity(leftFeet)} LF
            </>
          ) : null}
        </td>
      </tr>
    );
  }

  /** Auto mode: one editable row per ring height, summed across all pools. */
  function renderAutoRingRows(group: RingStyleGroup) {
    return group.options.map((option) => {
      const navRow = group.navRowByProductId.get(option.productId);
      const totalCount = roundQty(
        loads.reduce(
          (sum, load) =>
            sum + autoRingCount(group, option.productId, load.key),
          0,
        ),
      );
      const noStock =
        option.trackInventory &&
        option.currentStock != null &&
        option.currentStock <= 0;
      return (
        <tr
          key={`ring-auto-${group.key}-${option.productId}`}
          className={tableRowClassName}
        >
          <td className={stickyItemCellClassName}>
            <div className="pl-5">
              <span className="font-medium text-slate-800">
                {option.productCode}
              </span>{" "}
              <span className="text-slate-600">{option.name}</span>
              <span className="ml-1 text-[11px] text-slate-400">
                {option.heightFeet}&apos; ring
              </span>
              {noStock ? (
                <span className="ml-1 text-[11px] text-amber-600">
                  (No stock)
                </span>
              ) : null}
            </div>
          </td>
          <td className={stickyAvailableCellClassName}>
            <span className="text-slate-300">·</span>
          </td>
          {loads.map((load, loadIndex) => {
            const count = autoRingCount(group, option.productId, load.key);
            return (
              <td key={load.key} className={tableGridCellClassName}>
                <input
                  type="text"
                  inputMode="numeric"
                  value={count > 0 ? String(count) : ""}
                  data-plan-auto="1"
                  {...(navRow != null
                    ? { "data-plan-row": navRow, "data-plan-col": loadIndex }
                    : {})}
                  onKeyDown={
                    navRow != null
                      ? (event) => handleCellKeyDown(event, navRow, loadIndex)
                      : undefined
                  }
                  onChange={(event) =>
                    handleAutoRingChange(
                      group,
                      option.productId,
                      load.key,
                      event.target.value,
                    )
                  }
                  className={tableNumericCellInputClassName}
                  placeholder=""
                />
              </td>
            );
          })}
          <td className={`${stickyAssignedCellClassName} text-slate-500`}>
            {totalCount > 0 ? formatQuantity(totalCount) : ""}
          </td>
        </tr>
      );
    });
  }

  const capacityPct = (weight: number) =>
    loadCapacityLbs && loadCapacityLbs > 0
      ? (weight / loadCapacityLbs) * 100
      : null;

  const loadColumnHeaderClassName = `${tableHeaderCellClassName} w-24 min-w-[5rem] normal-case tracking-normal`;

  return (
    <div className="space-y-4">
      {editableRows.length > 0 ? (
        <div className="grid gap-x-6 gap-y-3 rounded-lg border border-slate-200 bg-white px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Remaining to Deliver
            </p>
            <p className="mt-0.5 text-lg font-semibold text-slate-900">
              {formatWeightLb(remaining.weight)}
              {!remaining.complete ? (
                <span
                  className="ml-0.5 align-top text-sm text-amber-500"
                  title="Some items have no weight on file — the total is understated."
                >
                  *
                </span>
              ) : null}
            </p>
            <p className="text-[11px] text-slate-500">
              {formatQuantity(remaining.pieces)} pieces
              {remaining.hasRingFootage ? " + ring footage" : ""}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Expected Loads
            </p>
            {expectedLoads ? (
              <>
                <p className="mt-0.5 text-lg font-semibold text-slate-900">
                  {expectedLoads}
                </p>
                <p className="text-[11px] text-slate-500">
                  Capacity {loadCapacityLabel} · ≈{" "}
                  {formatWeightLb(remaining.weight / expectedLoads)} per load
                </p>
              </>
            ) : (
              <p className="mt-0.5 text-lg font-semibold text-slate-400">—</p>
            )}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Planned Columns
            </p>
            <p className="mt-0.5 text-lg font-semibold text-slate-900">
              {loads.length}
            </p>
            {expectedLoads && loads.length !== expectedLoads ? (
              <button
                type="button"
                onClick={setColumnsToExpected}
                className="mt-0.5 rounded border border-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
              >
                Use {expectedLoads} columns
              </button>
            ) : null}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Assigned So Far
            </p>
            <p className="mt-0.5 text-lg font-semibold text-slate-900">
              {totalPieces > 0 ? formatWeightLb(totalWeight) : "—"}
            </p>
            {totalPieces > 0 && remaining.weight > 0 ? (
              <p className="text-[11px] text-slate-500">
                {Math.round((totalWeight / remaining.weight) * 100)}% of
                remaining weight
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {existingTickets.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-700">
            Open tickets already on this job:
          </span>{" "}
          <span className="inline-flex flex-wrap gap-x-3 gap-y-1">
            {existingTickets.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/delivery-tickets/${ticket.id}`}
                className="whitespace-nowrap hover:text-slate-900"
              >
                {ticket.ticketNumber} · {ticket.status}
                {ticket.deliveryDate ? ` · ${ticket.deliveryDate}` : ""}
                {ticket.totalWeight != null
                  ? ` · ${formatWeightLb(ticket.totalWeight)}`
                  : ""}
              </Link>
            ))}
          </span>
          <p className="mt-1 text-[11px] text-slate-400">
            Other open tickets — their quantities are already subtracted from
            the Available column. Draft loads for this quote appear as editable
            columns in the grid instead.
          </p>
        </div>
      ) : null}

      {deletedTickets.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span className="font-semibold">Will be deleted on save:</span>{" "}
          <span className="inline-flex flex-wrap gap-x-3 gap-y-1">
            {deletedTickets.map((entry) => (
              <span key={entry.ticketId} className="whitespace-nowrap">
                {entry.ticketNumber}
                <button
                  type="button"
                  onClick={() => undoDelete(entry.ticketId)}
                  className="ml-1 rounded border border-amber-300 px-1 text-[10px] font-medium hover:bg-amber-100"
                >
                  undo
                </button>
              </span>
            ))}
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      {editableRows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Nothing on this quote is available to plan — every line is either
          fully shipped, committed on open tickets, or needs the single-ticket
          editor.
        </div>
      ) : (
        <div className={tableWrapperClassName}>
          <table ref={tableRef} className={tableClassName} onPaste={handlePaste}>
            <thead>
              <tr>
                <th
                  className={`${tableHeaderCellClassName} sticky left-0 z-20 w-64 min-w-[16rem] max-w-[16rem] align-top`}
                >
                  Item
                </th>
                <th
                  className={`${tableHeaderCellClassName} sticky left-[16rem] z-20 text-right align-top`}
                >
                  Available
                </th>
                {loads.map((load, loadIndex) => {
                  const totals = loadTotals[loadIndex];
                  return (
                    <th key={load.key} className={`${loadColumnHeaderClassName} align-top`}>
                      <div className="flex items-center justify-between gap-2">
                        {load.ticketId ? (
                          <span className="min-w-0">
                            <Link
                              href={`/delivery-tickets/${load.ticketId}`}
                              className="text-[11px] font-semibold text-sky-700 hover:text-sky-900"
                              title={`Open ${load.ticketNumber}`}
                            >
                              {load.ticketNumber}
                            </Link>
                            <span className="ml-1 rounded border border-slate-300 px-1 text-[9px] font-medium uppercase text-slate-400">
                              draft
                            </span>
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold uppercase tracking-wide">
                            Load {loadIndex + 1}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeLoad(load.key)}
                          disabled={loads.length <= 1}
                          className="text-slate-400 hover:text-red-600 disabled:opacity-30"
                          title={load.ticketId ? `Delete ${load.ticketNumber}` : "Remove load"}
                          aria-label={
                            load.ticketId
                              ? `Delete ${load.ticketNumber}`
                              : `Remove load ${loadIndex + 1}`
                          }
                        >
                          ✕
                        </button>
                      </div>
                      <div className="mt-0.5 text-right text-[10px] font-semibold normal-case tabular-nums text-slate-700">
                        {totals && totals.pieces > 0 ? (
                          <>
                            {formatWeightLb(totals.weight)}
                            {!totals.weightComplete ? (
                              <span
                                className="ml-0.5 text-amber-500"
                                title="Some items on this load have no weight on file."
                              >
                                *
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="font-normal text-slate-400">—</span>
                        )}
                      </div>
                    </th>
                  );
                })}
                <th
                  className={`${tableHeaderCellClassName} sticky right-0 z-20 text-right align-top ${stickyRightEdgeShadow}`}
                >
                  <div>Assigned / Left</div>
                  <div className="mt-0.5 text-[10px] font-semibold normal-case tabular-nums text-slate-700">
                    {totalPieces > 0 ? (
                      formatWeightLb(totalWeight)
                    ) : (
                      <span className="font-normal text-slate-400">—</span>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className={tableBodyClassName}>
              {rows.map((row) => {
                const renderPlannerRow = () => {
                if (row.kind === "category") {
                  return (
                    <tr key={row.key}>
                      <td
                        colSpan={loads.length + 3}
                        className={`${tableCellClassName} sticky left-0 bg-slate-100/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500`}
                      >
                        {row.label}
                      </td>
                    </tr>
                  );
                }

                if (row.kind === "ineligible") {
                  return (
                    <tr key={row.key} className="text-slate-400">
                      <td className={stickyItemCellClassName}>
                        <span className="font-medium">{row.itemCode}</span>{" "}
                        <span>{row.displayName}</span>
                      </td>
                      <td className={`${stickyAvailableCellClassName} text-slate-300`}>—</td>
                      <td
                        colSpan={loads.length}
                        className={`${tableCellClassName} italic`}
                      >
                        {row.reason}
                      </td>
                      <td className={`${stickyAssignedCellClassName} text-slate-300`}>—</td>
                    </tr>
                  );
                }

                if (row.kind === "group") {
                  const group = groups.get(row.groupKey);
                  if (!group) return null;
                  // Casting groups track complete sets (min across pieces),
                  // not a sum of sub-row quantities.
                  const assigned = group.isCastingAssembly
                    ? (castingStats.get(row.groupKey)?.sets ?? 0)
                    : (groupAssigned.get(row.groupKey) ?? 0);
                  const left = roundQty(group.available - assigned);
                  const over = overAssignedGroups.has(row.groupKey);
                  return (
                    <tr key={row.key} className="bg-slate-50/70">
                      <td className={`${stickyItemCellClassName} !bg-slate-50`}>
                        <span className="font-semibold text-slate-800">
                          {row.itemCode}
                        </span>{" "}
                        <span className="text-slate-600">{row.displayName}</span>
                      </td>
                      <td className={`${stickyAvailableCellClassName} !bg-slate-50 font-medium`}>
                        {formatQuantity(group.available)} {group.unitLabel}
                      </td>
                      <td colSpan={loads.length} className={`${tableCellClassName} text-[11px] text-slate-400`}>
                        {group.isCastingAssembly
                          ? "Assign piece counts below — a set is complete only when every piece ships."
                          : group.isDrainRing
                            ? "Assign ring counts below — feet are tallied against the quote line."
                            : "Assign quantities below — options share this line's total."}
                      </td>
                      <td
                        className={`${stickyAssignedCellClassName} font-medium ${
                          over
                            ? "!bg-red-50 text-red-700"
                            : left > 0.001
                              ? "!bg-slate-50 text-amber-600"
                              : "!bg-slate-50 text-emerald-700"
                        }`}
                      >
                        {formatQuantity(assigned)} / {formatQuantity(left)}{" "}
                        {group.unitLabel}
                      </td>
                    </tr>
                  );
                }

                const group = groups.get(row.groupKey);
                const grouped = row.indent;
                const assignedForRow = rowAssigned.get(row.key) ?? 0;
                const over = overAssignedGroups.has(row.groupKey);
                const groupAssignedTotal = groupAssigned.get(row.groupKey) ?? 0;
                const leftForGroup = group
                  ? roundQty(group.available - groupAssignedTotal)
                  : 0;

                return (
                  <tr key={row.key} className={tableRowClassName}>
                    <td className={stickyItemCellClassName}>
                      <div className={grouped ? "pl-5" : undefined}>
                        <span className="font-medium text-slate-800">
                          {row.itemCode}
                        </span>{" "}
                        <span className="text-slate-600">{row.displayName}</span>
                        {row.detail ? (
                          <span className="ml-1 text-[11px] text-slate-400">
                            {row.detail}
                          </span>
                        ) : null}
                        {row.warning ? (
                          <span className="ml-1 text-[11px] text-amber-600">
                            ({row.warning})
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className={stickyAvailableCellClassName}>
                      {grouped ? (
                        <span className="text-slate-300">·</span>
                      ) : (
                        <>
                          {formatQuantity(group?.available ?? 0)}{" "}
                          <span className="text-slate-400">{row.unit}</span>
                        </>
                      )}
                    </td>
                    {loads.map((load, loadIndex) => {
                      const value = cells[cellKey(row.key, load.key)] ?? "";
                      const invalid =
                        value.trim() !== "" &&
                        (!Number.isFinite(Number(value)) || Number(value) < 0);
                      return (
                        <td
                          key={load.key}
                          className={`${tableGridCellClassName} ${
                            over && parseQty(value) > 0 ? "bg-red-50" : ""
                          }`}
                        >
                          <input
                            type="text"
                            inputMode="decimal"
                            value={value}
                            data-plan-row={row.navRow}
                            data-plan-col={loadIndex}
                            onKeyDown={(event) =>
                              handleCellKeyDown(event, row.navRow, loadIndex)
                            }
                            onChange={(event) =>
                              setCell(row.key, load.key, event.target.value)
                            }
                            className={`${tableNumericCellInputClassName} ${
                              invalid ? "text-red-600" : ""
                            }`}
                            placeholder=""
                          />
                        </td>
                      );
                    })}
                    <td
                      className={`${stickyAssignedCellClassName} ${
                        over
                          ? "!bg-red-50 font-medium text-red-700"
                          : grouped
                            ? "text-slate-500"
                            : leftForGroup > 0.001
                              ? "text-amber-600"
                              : assignedForRow > 0
                                ? "text-emerald-700"
                                : "text-slate-400"
                      }`}
                    >
                      {grouped ? (
                        formatQuantity(assignedForRow)
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <span>
                            {formatQuantity(assignedForRow)} /{" "}
                            {formatQuantity(leftForGroup)}
                          </span>
                          {leftForGroup > 0.001 && !over ? (
                            <button
                              type="button"
                              onClick={() => fillRemainder(row)}
                              className="rounded border border-slate-200 px-1 text-[10px] text-slate-500 hover:bg-slate-100"
                              title={`Put the remaining ${formatQuantity(leftForGroup)} on Load ${loads.length}`}
                            >
                              fill
                            </button>
                          ) : null}
                        </span>
                      )}
                    </td>
                  </tr>
                );
                };

                // Drain rings render as one combined section in auto mode
                // (all pools, one row per ring height) or with a toggle row
                // above the per-pool groups in pool mode.
                const ringLineId =
                  row.kind === "group" || row.kind === "item"
                    ? row.groupKey
                    : row.kind === "ineligible"
                      ? row.key
                      : null;
                const ringKey =
                  ringLineId != null
                    ? ringStyleGroups.keyByLineId.get(ringLineId)
                    : undefined;
                const ringGroup =
                  ringKey != null
                    ? ringStyleGroups.byKey.get(ringKey)
                    : undefined;
                if (ringGroup) {
                  const mode = getRingMode(ringGroup.key);
                  if (row.key !== ringGroup.anchorRowKey) {
                    return mode === "auto" ? null : renderPlannerRow();
                  }
                  return (
                    <Fragment key={`ring-style-${ringGroup.key}`}>
                      {renderRingStyleHeader(ringGroup, mode)}
                      {mode === "auto"
                        ? renderAutoRingRows(ringGroup)
                        : renderPlannerRow()}
                    </Fragment>
                  );
                }
                return renderPlannerRow();
              })}
            </tbody>
            <tfoot>
              {/* Per-load weight lives pinned in the header with the load numbers. */}
              <tr className="border-t-2 border-slate-300">
                <td className={`${tableCellClassName} sticky left-0 z-[5] w-64 min-w-[16rem] max-w-[16rem] bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500`}>
                  Pieces
                </td>
                <td className={`${stickyAvailableCellClassName} !bg-slate-50`} />
                {loadTotals.map((totals, index) => (
                  <td
                    key={loads[index].key}
                    className={`${tableNumericCellClassName} bg-slate-50 font-medium`}
                  >
                    {totals.pieces > 0 ? formatQuantity(totals.pieces) : "—"}
                  </td>
                ))}
                <td className={`${stickyAssignedCellClassName} !bg-slate-50 font-medium`}>
                  {totalPieces > 0 ? formatQuantity(totalPieces) : "—"}
                </td>
              </tr>
              {loadCapacityLbs ? (
                <tr>
                  <td className={`${tableCellClassName} sticky left-0 z-[5] w-64 min-w-[16rem] max-w-[16rem] bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500`}>
                    Capacity
                  </td>
                  <td className={`${stickyAvailableCellClassName} !bg-slate-50`} />
                  {loadTotals.map((totals, index) => {
                    const pct = capacityPct(totals.weight) ?? 0;
                    const barColor =
                      pct > 100
                        ? "bg-red-500"
                        : pct >= 85
                          ? "bg-amber-400"
                          : "bg-emerald-500";
                    return (
                      <td
                        key={loads[index].key}
                        className={`${tableCellClassName} bg-slate-50 align-middle`}
                      >
                        {totals.pieces > 0 ? (
                          <div title={`${Math.round(pct)}% of ${loadCapacityLabel}`}>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                              <div
                                className={`h-full rounded-full ${barColor}`}
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </div>
                            <div
                              className={`mt-0.5 text-right text-[10px] tabular-nums ${
                                pct > 100 ? "font-semibold text-red-600" : "text-slate-500"
                              }`}
                            >
                              {Math.round(pct)}%
                            </div>
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                  <td className={`${stickyAssignedCellClassName} !bg-slate-50`} />
                </tr>
              ) : null}
            </tfoot>
          </table>
        </div>
      )}

      {excludedCastings.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          <p className="font-semibold text-slate-700">
            Needs the single-ticket editor
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            These casting assemblies have no component pieces defined, so there
            is nothing to plan piece-by-piece here.
          </p>
          <ul className="mt-1 space-y-0.5">
            {excludedCastings.map((line) => (
              <li key={line.itemCode}>
                <span className="font-medium">{line.itemCode}</span>{" "}
                {line.displayName}
              </li>
            ))}
          </ul>
          <Link
            href={`/delivery-tickets/new?jobId=${jobId}`}
            className="mt-1.5 inline-block text-xs font-medium text-sky-700 hover:text-sky-900"
          >
            Open the single-ticket editor →
          </Link>
        </div>
      ) : null}

      {editableRows.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
          <div className="text-xs text-slate-600">
            {totalPieces > 0 ? (
              <>
                <span className="font-semibold text-slate-800">
                  {nonEmptyLoads} load{nonEmptyLoads === 1 ? "" : "s"}
                </span>{" "}
                · {formatQuantity(totalPieces)} pieces ·{" "}
                {formatWeightLb(totalWeight)}
                {unassignedGroupCount > 0 ? (
                  <span className="ml-2 text-amber-600">
                    {unassignedGroupCount} item
                    {unassignedGroupCount === 1 ? "" : "s"} with quantity still
                    unassigned
                  </span>
                ) : null}
                {overAssignedGroups.size > 0 ? (
                  <span className="ml-2 font-medium text-red-600">
                    {overAssignedGroups.size} item
                    {overAssignedGroups.size === 1 ? "" : "s"} over-assigned —
                    fix before creating tickets
                  </span>
                ) : null}
              </>
            ) : (
              "Type quantities into the load columns to start planning."
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addLoad}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              + Add Load
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={!canSubmit}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {hasExistingDrafts || deletedTickets.length > 0
                ? "Review & Save Plan"
                : `Review & Create ${nonEmptyLoads > 0 ? nonEmptyLoads : ""} Ticket${nonEmptyLoads === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      ) : null}

      {confirming ? (
        <div className="rounded-lg border border-slate-300 bg-white p-4">
          <p className="text-sm font-semibold text-slate-800">
            Save this load plan?
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {loads.map((load, index) => {
              const totals = loadTotals[index];
              const emptiedExisting = load.ticketId && totals.pieces === 0;
              return (
                <div
                  key={load.key}
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    emptiedExisting
                      ? "border-red-200 bg-red-50/60 text-red-700"
                      : totals.pieces > 0
                        ? "border-slate-200"
                        : "border-dashed border-slate-200 text-slate-400"
                  }`}
                >
                  <p className="font-semibold">
                    {load.ticketId ? load.ticketNumber : `Load ${index + 1}`}
                    {load.ticketId
                      ? emptiedExisting
                        ? " — no items left, will be deleted"
                        : " — update"
                      : totals.pieces === 0
                        ? " — empty, skipped"
                        : " — new ticket"}
                  </p>
                  {totals.pieces > 0 ? (
                    <p className="mt-0.5 text-slate-600">
                      {formatQuantity(totals.pieces)} pieces ·{" "}
                      {formatWeightLb(totals.weight)}
                    </p>
                  ) : null}
                </div>
              );
            })}
            {deletedTickets.map((entry) => (
              <div
                key={entry.ticketId}
                className="rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 text-xs text-red-700"
              >
                <p className="font-semibold">
                  {entry.ticketNumber} — will be deleted
                </p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Saved loads stay drafts — assign dates, drivers, and trailers on
            the scheduling page. Existing tickets keep their schedule details.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending || saved}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Confirm & Save Plan"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Keep Editing
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
