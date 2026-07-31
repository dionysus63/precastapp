"use client";

import Link from "next/link";
import { randomId } from "@/lib/random-id";
import { useRouter } from "next/navigation";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  createDeliveryTicket,
  searchCustomersForWalkInTicket,
  searchJobsForDeliveryTicket,
  splitStructureForShipping,
  unsplitStructure,
  updateDeliveryTicket,
  type DeliveryTicketLineInput,
  type DeliveryTicketJobSearchOption,
  type SaveDeliveryTicketInput,
} from "@/app/delivery-tickets/actions";
import { getQuoteFulfillmentWithOpenLoads } from "@/app/operations/actions";
import { FormTypeahead } from "@/components/common/form-typeahead";
import { BackButton } from "@/components/dashboard/back-button";
import { SectionCard } from "@/components/dashboard/section-card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useUnsavedChangesWarning } from "@/lib/hooks/use-unsaved-changes-warning";
import { RichTextContent } from "@/components/ui/rich-text-content";
import type { QuoteLineFulfillment } from "@/lib/delivery-fulfillment";
import { formatUsd, formatWeightLb } from "@/lib/format";
import {
  getDeliveryLinePrimaryLabel,
  getDeliveryLineSecondaryLabel,
  isPositiveDeliveryQuantity,
  shouldShowDeliveryLineDescription,
} from "@/components/delivery-tickets/delivery-ticket-utils";
import {
  allocateRingsAcrossPools,
  buildDrainRingDiameterGroups,
  drainRingQuantityKey,
  type DrainRingStyleMatrix,
} from "@/components/delivery-tickets/drain-ring-matrix-utils";
import { DrainRingMatrixRows } from "@/components/delivery-tickets/drain-ring-matrix";
import {
  castingAssemblyEditorKey,
  formatCastingPieceRoleLabel,
  type CastingPieceRole,
} from "@/lib/casting-utils";
import { collapseCastingTicketLines } from "@/lib/casting-ticket-lines";
import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableHeaderCellClassName,
  tableInlineInputClassName,
} from "@/lib/table-styles";
type JobOption = DeliveryTicketJobSearchOption;

type ProductOption = {
  id: string;
  productCode: string;
  name: string;
  unit: string;
  weight: number | null;
  unitPrice?: number | null;
  currentStock?: number | null;
  trackInventory?: boolean;
  categoryId: string;
  categoryName: string;
  categorySortOrder: number;
  subcategoryId: string | null;
  subcategoryName: string | null;
  subcategorySortOrder: number | null;
};

type EditorLine = {
  key: string;
  quoteLineItemId: string | null;
  productId: string | null;
  jobStructureId: string | null;
  jobStructurePieceId?: string | null;
  lineType: SaveDeliveryTicketInput["lines"][number]["lineType"];
  itemCode: string;
  description: string;
  quantity: string;
  unit: string;
  weightEach: string;
  /** JOB-ticket extras only: the price agreed when the item was added. */
  unitPrice?: string;
  yardLocation: string;
};

export type DeliveryTicketEditorProps = {
  mode: "create" | "edit";
  ticketId?: string;
  // ISO updatedAt of the ticket as loaded for editing; sent back with the
  // save so the server can reject stale writes (optimistic concurrency).
  expectedUpdatedAt?: string;
  jobs: JobOption[];
  products?: ProductOption[];
  fleetOptions?: {
    drivers: string[];
    trailers: string[];
    loadCapacityLabel: string;
  };
  defaultValues?: Partial<
    Omit<SaveDeliveryTicketInput, "lines">
  > & {
    lines?: EditorLine[];
  };
  /** Renders the page's back pill inside the editor so leaving with unsaved
   * changes asks to save first (plain Links can't be intercepted). */
  backHref?: string;
  backLabel?: string;
};

const inputClass =
  "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm";

const compactInputClass =
  "block h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100";

const compactLabelClass =
  "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500";

const loadQuantityInputClass =
  "h-8 rounded-md border border-slate-400 bg-white px-2 text-right text-xs font-semibold text-slate-900 shadow-sm outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400";

const inlineTableInputClass = tableInlineInputClassName;

const WALK_IN_RESULT_LIMIT = 50;
const DASHBOARD_HEADER_HEIGHT = 74;

function todayDateInputValue(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function initialFleetSelect(value: string | null | undefined, options: string[]) {
  if (!value) {
    return { selected: "", other: "" };
  }
  if (options.includes(value)) {
    return { selected: value, other: "" };
  }
  return { selected: "__other__", other: value };
}

function formatLineTypeLabel(lineType: string): string {
  return lineType.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatWeight(value: number): string {
  return formatWeightLb(value);
}

function parseEditorWeight(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function getEffectiveWeightEach(
  editorLine: EditorLine | undefined,
  fulfillmentLine: QuoteLineFulfillment,
): number | null {
  const fromEditor = editorLine ? parseEditorWeight(editorLine.weightEach) : null;
  if (fromEditor != null) {
    return fromEditor;
  }
  // Composite lines (casting pieces, drain ring SKUs, structure pieces) point
  // to the parent line's fulfillment; don't fall back to the parent's weight
  // for an individual sub-line.
  if (editorLine && isCompositeEditorKey(editorLine.key)) {
    return null;
  }
  return fulfillmentLine.weightEach;
}

function generateLineKey(): string {
  return randomId();
}

function mergeFulfillmentIntoLine(
  existing: EditorLine,
  meta: QuoteLineFulfillment,
): EditorLine {
  return {
    ...existing,
    productId: meta.productId,
    jobStructureId: meta.jobStructureId,
    lineType: meta.lineType as EditorLine["lineType"],
    itemCode: meta.itemCode,
    description: meta.description ?? "",
    unit: existing.unit.trim() ? existing.unit : meta.unit,
    weightEach: existing.weightEach.trim()
      ? existing.weightEach
      : meta.weightEach != null
        ? String(meta.weightEach)
        : "",
  };
}

function mapFulfillmentToLine(
  meta: QuoteLineFulfillment,
  availableQty: number = meta.remainingQty,
  usePickupPrice = false,
): EditorLine {
  return {
    key: meta.quoteLineItemId,
    quoteLineItemId: meta.quoteLineItemId,
    productId: meta.productId,
    jobStructureId: meta.jobStructureId,
    lineType: meta.lineType as EditorLine["lineType"],
    itemCode: meta.itemCode,
    description: meta.description ?? "",
    quantity: meta.eligible && availableQty > 0 ? String(availableQty) : "0",
    unit: meta.unit,
    weightEach: meta.weightEach != null ? String(meta.weightEach) : "",
    // Pickup tickets bill the price list's pickup price when one exists;
    // the override lands in DeliveryTicketLineItem.unitPrice at save.
    unitPrice:
      usePickupPrice && meta.pickupUnitPrice != null
        ? String(meta.pickupUnitPrice)
        : undefined,
    yardLocation: "",
  };
}

function isCompositeEditorKey(key: string): boolean {
  return key.includes("::");
}

function fulfillmentMetaForEditorLine(
  line: EditorLine,
  fulfillmentById: Map<string, QuoteLineFulfillment>,
): QuoteLineFulfillment | undefined {
  if (isCompositeEditorKey(line.key)) {
    return line.quoteLineItemId
      ? fulfillmentById.get(line.quoteLineItemId)
      : undefined;
  }
  return fulfillmentById.get(line.key);
}

function initialQuoteId(
  jobId: string,
  defaultQuoteId: string | null | undefined,
  jobs: JobOption[],
): string {
  const job = jobs.find((entry) => entry.id === jobId);
  if (!job || job.quotes.length === 0) {
    return "";
  }
  if (defaultQuoteId && job.quotes.some((entry) => entry.id === defaultQuoteId)) {
    return defaultQuoteId;
  }
  return job.quotes[0].id;
}

export function DeliveryTicketEditor({
  mode,
  ticketId,
  expectedUpdatedAt,
  jobs,
  products = [],
  fleetOptions,
  defaultValues,
  backHref,
  backLabel,
}: DeliveryTicketEditorProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [stickyRegionHeight, setStickyRegionHeight] = useState(0);
  const stickyRegionRef = useRef<HTMLDivElement>(null);
  useUnsavedChangesWarning(isDirty);

  function markDirty() {
    setIsDirty(true);
  }
  // Back-pill / Cancel guard: client-side navigation skips beforeunload, so
  // dirty leaves open a save dialog targeting the clicked destination.
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);

  function guardLeave(event: React.MouseEvent, href: string) {
    if (isDirty) {
      event.preventDefault();
      setLeaveTarget(href);
    }
  }
  const [ticketType, setTicketType] = useState<"JOB" | "WALK_IN">(
    defaultValues?.ticketType ?? "JOB",
  );
  const [fulfillmentMethod, setFulfillmentMethod] = useState<
    "DELIVERY" | "PICKUP"
  >(defaultValues?.fulfillmentMethod ?? "DELIVERY");
  const [paymentMethod, setPaymentMethod] = useState<
    "PAY_NOW" | "ON_ACCOUNT" | ""
  >(defaultValues?.paymentMethod ?? "");
  const [paymentReceived, setPaymentReceived] = useState(
    defaultValues?.paymentReceived ?? false,
  );
  const [pickedUpBy, setPickedUpBy] = useState(defaultValues?.pickedUpBy ?? "");
  const [walkInCustomer, setWalkInCustomer] = useState(
    defaultValues?.customerName ?? "",
  );
  const [walkInCustomerId, setWalkInCustomerId] = useState<string | null>(
    defaultValues?.customerId ?? null,
  );
  const [walkInOneOff, setWalkInOneOff] = useState(
    () => !defaultValues?.customerId && Boolean(defaultValues?.customerName),
  );
  const [walkInReference, setWalkInReference] = useState(
    defaultValues?.projectName ?? "",
  );
  const [walkInSearch, setWalkInSearch] = useState("");
  // JOB tickets: product search for items added outside the quote.
  const [extraSearch, setExtraSearch] = useState("");
  const [walkInCategoryId, setWalkInCategoryId] = useState("all");
  const [walkInSubcategoryId, setWalkInSubcategoryId] = useState<string | null>(
    null,
  );
  const [jobId, setJobId] = useState(defaultValues?.jobId ?? "");
  const [searchedJob, setSearchedJob] = useState<JobOption | null>(null);
  const [quoteId, setQuoteId] = useState(() =>
    initialQuoteId(defaultValues?.jobId ?? "", defaultValues?.quoteId, jobs),
  );
  const [deliveryDate, setDeliveryDate] = useState(
    defaultValues?.deliveryDate ?? todayDateInputValue(),
  );
  const [fulfillment, setFulfillment] = useState<QuoteLineFulfillment[]>([]);
  // Quantity per quote line sitting on OTHER open tickets (scheduled/draft,
  // not yet delivered). Same units as remainingQty: LF for rings, sets for
  // castings, EA otherwise.
  const [onOpenLoads, setOnOpenLoads] = useState<Record<string, number>>({});
  const [lines, setLines] = useState<EditorLine[]>(defaultValues?.lines ?? []);
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(
    () => new Set(defaultValues?.lines?.map((l) => l.key) ?? []),
  );
  const drivers = fleetOptions?.drivers ?? [];
  const trailers = fleetOptions?.trailers ?? [];
  const loadCapacityLabel = fleetOptions?.loadCapacityLabel ?? "80,000 lb";

  const initialDriver = initialFleetSelect(defaultValues?.driver, drivers);
  const initialTrailer = initialFleetSelect(defaultValues?.trailer, trailers);

  const [driver, setDriver] = useState(initialDriver.selected);
  const [trailer, setTrailer] = useState(initialTrailer.selected);
  const [driverOther, setDriverOther] = useState(initialDriver.other);
  const [trailerOther, setTrailerOther] = useState(initialTrailer.other);

  function resolveFleetValue(selected: string, other: string) {
    if (selected === "__other__") {
      return other.trim() || null;
    }
    return selected.trim() || null;
  }

  // Server refreshes hand down new defaultValues (e.g. after a save); adopt
  // them during the render they change rather than one render later.
  const [prevDefaultLines, setPrevDefaultLines] = useState(defaultValues?.lines);
  if (defaultValues?.lines !== prevDefaultLines) {
    setPrevDefaultLines(defaultValues?.lines);
    if (defaultValues?.lines?.length) {
      setLines(defaultValues.lines);
      setSelectedLineIds(new Set(defaultValues.lines.map((l) => l.key)));
    }
  }

  const [prevDefaultDeliveryDate, setPrevDefaultDeliveryDate] = useState(
    defaultValues?.deliveryDate,
  );
  if (defaultValues?.deliveryDate !== prevDefaultDeliveryDate) {
    setPrevDefaultDeliveryDate(defaultValues?.deliveryDate);
    if (defaultValues?.deliveryDate) {
      setDeliveryDate(defaultValues.deliveryDate);
    }
  }

  function handleTicketTypeChange(next: "JOB" | "WALK_IN") {
    markDirty();
    setTicketType(next);
    if (next !== "JOB") {
      setFulfillment([]);
      setOnOpenLoads({});
    }
  }

  function handleJobChange(nextJob: JobOption | null) {
    const nextJobId = nextJob?.id ?? "";
    setSearchedJob(nextJob);

    if (nextJobId === jobId) {
      if (nextJob) {
        setQuoteId((current) => {
          if (nextJob.quotes.some((entry) => entry.id === current)) {
            return current;
          }
          if (
            defaultValues?.quoteId &&
            nextJob.quotes.some(
              (entry) => entry.id === defaultValues.quoteId,
            )
          ) {
            return defaultValues.quoteId;
          }
          return nextJob.quotes[0]?.id ?? "";
        });
      }
      return;
    }

    markDirty();
    setJobId(nextJobId);
    setQuoteId(nextJob?.quotes[0]?.id ?? "");
    setLines([]);
    setSelectedLineIds(new Set());
    setFulfillment([]);
    setOnOpenLoads({});
    setError(null);
  }

  function handleQuoteChange(nextQuoteId: string) {
    if (nextQuoteId === quoteId) {
      return;
    }
    markDirty();
    setQuoteId(nextQuoteId);
    setLines([]);
    setSelectedLineIds(new Set());
    setFulfillment([]);
    setOnOpenLoads({});
    setError(null);
  }

  const selectedJob =
    jobs.find((job) => job.id === jobId) ??
    (searchedJob?.id === jobId ? searchedJob : undefined);
  const quote =
    selectedJob?.quotes.find((entry) => entry.id === quoteId) ??
    selectedJob?.quotes[0];

  useEffect(() => {
    const element = stickyRegionRef.current;
    if (!element || ticketType !== "JOB") {
      return;
    }

    const updateHeight = () => {
      setStickyRegionHeight(Math.ceil(element.getBoundingClientRect().height));
    };
    const frame = window.requestAnimationFrame(updateHeight);
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [ticketType, quote]);

  useEffect(() => {
    if (ticketType !== "JOB" || !quoteId) {
      return;
    }
    void getQuoteFulfillmentWithOpenLoads(quoteId, ticketId).then((result) => {
      const fetched = result.fulfillment;
      setFulfillment(fetched);
      setOnOpenLoads(result.onOpenLoads);
      // Backfill fetched weights into lines restored from a saved ticket.
      // Lines selected after this point go through toggleLine, which merges
      // the fulfillment meta itself.
      const byId = new Map(fetched.map((line) => [line.quoteLineItemId, line]));
      setLines((current) => {
        let changed = false;
        const next = current.map((line) => {
          if (isCompositeEditorKey(line.key)) {
            return line;
          }
          const meta = byId.get(line.key);
          if (!meta || line.weightEach.trim() || meta.weightEach == null) {
            return line;
          }
          changed = true;
          return {
            ...line,
            weightEach: String(meta.weightEach),
            unit: line.unit.trim() ? line.unit : meta.unit,
          };
        });
        return changed ? next : current;
      });
    });
  }, [ticketType, quoteId, ticketId]);

  const fulfillmentById = useMemo(
    () => new Map(fulfillment.map((line) => [line.quoteLineItemId, line])),
    [fulfillment],
  );

  function getOnOpenLoadsQty(line: QuoteLineFulfillment): number {
    const qty = onOpenLoads[line.quoteLineItemId] ?? 0;
    return qty > 0 ? Math.round(qty * 100) / 100 : 0;
  }

  /** remainingQty net of what other open tickets already claim. */
  function getAvailableQty(line: QuoteLineFulfillment): number {
    const available = line.remainingQty - getOnOpenLoadsQty(line);
    return available > 0 ? Math.round(available * 100) / 100 : 0;
  }

  const linesByKey = useMemo(
    () => new Map(lines.map((line) => [line.key, line])),
    [lines],
  );

  const drainRingDiameterGroups = useMemo(
    () => buildDrainRingDiameterGroups(fulfillment, linesByKey, onOpenLoads),
    [fulfillment, linesByKey, onOpenLoads],
  );

  const totalWeight = useMemo(() => {
    return lines
      .filter((line) => selectedLineIds.has(line.key))
      .reduce((sum, line) => {
        const qty = Number(line.quantity) || 0;
        const meta = fulfillmentMetaForEditorLine(line, fulfillmentById);
        const each =
          meta != null
            ? getEffectiveWeightEach(line, meta) ?? 0
            : parseEditorWeight(line.weightEach) ?? 0;
        return sum + qty * each;
      }, 0);
  }, [lines, selectedLineIds, fulfillmentById]);

  function toggleLine(meta: QuoteLineFulfillment, checked: boolean) {
    if (meta.isDrainRing || meta.isCastingAssembly || meta.isAdsPipe) {
      return;
    }
    if (checked) {
      setSelectedLineIds((current) => new Set([...current, meta.quoteLineItemId]));
      setLines((current) => {
        const existing = current.find((line) => line.key === meta.quoteLineItemId);
        if (existing) {
          return current.map((line) =>
            line.key === meta.quoteLineItemId
              ? {
                  ...mergeFulfillmentIntoLine(line, meta),
                  quantity: isPositiveDeliveryQuantity(line.quantity)
                    ? line.quantity
                    : String(getAvailableQty(meta)),
                }
              : line,
          );
        }
        return [
          ...current,
          mapFulfillmentToLine(meta, getAvailableQty(meta), isPickup),
        ];
      });
    } else {
      setSelectedLineIds((current) => {
        const next = new Set(current);
        next.delete(meta.quoteLineItemId);
        return next;
      });
      // Exact key match only — drain ring SKU lines use quoteLineItemId::productId keys.
      setLines((current) =>
        current.filter((line) => line.key !== meta.quoteLineItemId),
      );
    }
  }

  function setStandardLineQuantity(
    meta: QuoteLineFulfillment,
    value: string,
  ) {
    const hasValue = value.trim() !== "";
    const active = isPositiveDeliveryQuantity(value);

    setLines((current) => {
      const existing = current.find((line) => line.key === meta.quoteLineItemId);
      if (!hasValue) {
        return current.filter((line) => line.key !== meta.quoteLineItemId);
      }

      if (existing) {
        return current.map((line) =>
          line.key === meta.quoteLineItemId
            ? {
                ...mergeFulfillmentIntoLine(line, meta),
                quantity: value,
              }
            : line,
        );
      }

      return [
        ...current,
        {
          ...mapFulfillmentToLine(meta, meta.remainingQty, isPickup),
          quantity: value,
        },
      ];
    });

    setSelectedLineIds((current) => {
      const next = new Set(current);
      if (active) {
        next.add(meta.quoteLineItemId);
      } else {
        next.delete(meta.quoteLineItemId);
      }
      return next;
    });
  }

  function setDrainRingCount(
    meta: QuoteLineFulfillment,
    option: QuoteLineFulfillment["drainRingOptions"][number],
    value: string,
  ) {
    const key = drainRingQuantityKey(meta.quoteLineItemId, option.productId);
    const numeric = Number(value);
    const active = value.trim() !== "" && Number.isFinite(numeric) && numeric > 0;

    setLines((current) => {
      const existing = current.find((line) => line.key === key);
      if (!active) {
        return current.filter((line) => line.key !== key);
      }
      if (existing) {
        return current.map((line) =>
          line.key === key ? { ...line, quantity: value } : line,
        );
      }
      return [
        ...current,
        {
          key,
          quoteLineItemId: meta.quoteLineItemId,
          productId: option.productId,
          jobStructureId: null,
          lineType: "STOCK_PRODUCT",
          itemCode: option.productCode,
          description: `${option.name} (${option.heightFeet}' ring)`,
          quantity: value,
          unit: "EA",
          weightEach: option.weightEach != null ? String(option.weightEach) : "",
          yardLocation: "",
        },
      ];
    });

    setSelectedLineIds((current) => {
      const next = new Set(current);
      if (active) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  /**
   * Auto-assign mode: replace every ring line in the matrix with a fresh
   * allocation of the desired totals. When no exact per-pool arrangement
   * exists but the group total fits (recorded pool splits lagging reality at
   * the end of a job), the allocation applies with overflow and an amber
   * warning — the over-quote confirm covers it at save time.
   */
  function applyAutoRingAssignment(
    matrix: DrainRingStyleMatrix,
    desiredCounts: Record<string, number>,
  ): { error: string | null; warning: string | null } {
    let warning: string | null = null;
    let result = allocateRingsAcrossPools(matrix, desiredCounts);
    if (!result.ok && result.kind === "arrangement") {
      const relaxed = allocateRingsAcrossPools(matrix, desiredCounts, {
        allowOverflow: true,
      });
      if (relaxed.ok) {
        result = relaxed;
        warning =
          "Recorded pool feet don't fit this split — some pools will run over. You'll confirm when saving.";
      }
    }
    if (!result.ok) {
      return { error: result.reason, warning: null };
    }

    const matrixLineIds = new Set(
      matrix.rows.map((row) => row.line.quoteLineItemId),
    );
    const nextLines = result.assignments.map(({ line, option, count }) => ({
      key: drainRingQuantityKey(line.quoteLineItemId, option.productId),
      quoteLineItemId: line.quoteLineItemId,
      productId: option.productId,
      jobStructureId: null,
      lineType: "STOCK_PRODUCT" as const,
      itemCode: option.productCode,
      description: `${option.name} (${option.heightFeet}' ring)`,
      quantity: String(count),
      unit: "EA",
      weightEach: option.weightEach != null ? String(option.weightEach) : "",
      yardLocation: "",
    }));

    const isMatrixRingKey = (line: EditorLine) =>
      isCompositeEditorKey(line.key) &&
      line.quoteLineItemId != null &&
      matrixLineIds.has(line.quoteLineItemId);

    setLines((current) => [
      ...current.filter((line) => !isMatrixRingKey(line)),
      ...nextLines,
    ]);
    setSelectedLineIds((current) => {
      const next = new Set(
        [...current].filter((key) => {
          const line = linesByKey.get(key);
          return !(line && isMatrixRingKey(line));
        }),
      );
      for (const line of nextLines) {
        next.add(line.key);
      }
      return next;
    });
    return { error: null, warning };
  }

  function getAdsPipeCount(quoteLineItemId: string, productId: string): string {
    const key = drainRingQuantityKey(quoteLineItemId, productId);
    return linesByKey.get(key)?.quantity ?? "";
  }

  function getAdsPipeQtyUsed(meta: QuoteLineFulfillment): number {
    return meta.adsPipeOptions.reduce((sum, option) => {
      const count =
        Number(getAdsPipeCount(meta.quoteLineItemId, option.productId)) || 0;
      return sum + count;
    }, 0);
  }

  function setAdsPipeCount(
    meta: QuoteLineFulfillment,
    option: QuoteLineFulfillment["adsPipeOptions"][number],
    value: string,
  ) {
    const key = drainRingQuantityKey(meta.quoteLineItemId, option.productId);
    const numeric = Number(value);
    const active = value.trim() !== "" && Number.isFinite(numeric) && numeric > 0;

    setLines((current) => {
      const existing = current.find((line) => line.key === key);
      if (!active) {
        return current.filter((line) => line.key !== key);
      }
      if (existing) {
        return current.map((line) =>
          line.key === key ? { ...line, quantity: value } : line,
        );
      }
      return [
        ...current,
        {
          key,
          quoteLineItemId: meta.quoteLineItemId,
          productId: option.productId,
          jobStructureId: null,
          lineType: "STOCK_PRODUCT",
          itemCode: option.productCode,
          description: option.isSubstitute
            ? `${option.name} — substitute`
            : option.name,
          quantity: value,
          unit: meta.unit,
          weightEach: option.weightEach != null ? String(option.weightEach) : "",
          yardLocation: "",
        },
      ];
    });

    setSelectedLineIds((current) => {
      const next = new Set(current);
      if (active) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  function getCastingPieceCount(
    quoteLineItemId: string,
    pieceRole: CastingPieceRole,
  ): string {
    const key = castingAssemblyEditorKey(quoteLineItemId, pieceRole);
    return linesByKey.get(key)?.quantity ?? "";
  }

  function getCastingSetsUsed(meta: QuoteLineFulfillment): number {
    let sets = Number.POSITIVE_INFINITY;
    for (const option of meta.castingComponentOptions) {
      const count =
        Number(getCastingPieceCount(meta.quoteLineItemId, option.pieceRole)) || 0;
      sets = Math.min(sets, Math.floor(count / option.quantity));
    }
    return Number.isFinite(sets) ? sets : 0;
  }

  function setCastingPieceCount(
    meta: QuoteLineFulfillment,
    option: QuoteLineFulfillment["castingComponentOptions"][number],
    value: string,
  ) {
    const key = castingAssemblyEditorKey(meta.quoteLineItemId, option.pieceRole);
    const numeric = Number(value);
    const active = value.trim() !== "" && Number.isFinite(numeric) && numeric > 0;

    setLines((current) => {
      const existing = current.find((line) => line.key === key);
      if (!active) {
        return current.filter((line) => line.key !== key);
      }
      if (existing) {
        return current.map((line) =>
          line.key === key ? { ...line, quantity: value } : line,
        );
      }
      return [
        ...current,
        {
          key,
          quoteLineItemId: meta.quoteLineItemId,
          productId: option.productId,
          jobStructureId: null,
          lineType: "STOCK_PRODUCT",
          itemCode: option.productCode,
          description: `${option.name} (${formatCastingPieceRoleLabel(option.pieceRole)})`,
          quantity: value,
          unit: "EA",
          weightEach: option.weightEach != null ? String(option.weightEach) : "",
          yardLocation: "",
        },
      ];
    });

    setSelectedLineIds((current) => {
      const next = new Set(current);
      if (active) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  /** Whole sets: every component gets N × its per-set quantity. */
  function setCastingSets(meta: QuoteLineFulfillment, value: string) {
    const numeric = Number(value);
    const sets =
      value.trim() !== "" && Number.isFinite(numeric) && numeric > 0
        ? Math.floor(numeric)
        : 0;
    for (const option of meta.castingComponentOptions) {
      setCastingPieceCount(
        meta,
        option,
        sets > 0 ? String(sets * option.quantity) : "",
      );
    }
  }

  /** True when the piece counts form whole sets (nothing partial). */
  function castingPiecesAreEvenSets(meta: QuoteLineFulfillment): boolean {
    const sets = getCastingSetsUsed(meta);
    return meta.castingComponentOptions.every((option) => {
      const count =
        Number(getCastingPieceCount(meta.quoteLineItemId, option.pieceRole)) ||
        0;
      return count === sets * option.quantity;
    });
  }

  // Casting rows pick whole sets by default; this opt-in reveals per-piece
  // counts for partial loads (auto-open when counts are already uneven).
  const [expandedCastingIds, setExpandedCastingIds] = useState<Set<string>>(
    new Set(),
  );

  // --- Split-structure pieces ---------------------------------------------

  const [splitFormStructureId, setSplitFormStructureId] = useState<string | null>(
    null,
  );
  const [splitDraft, setSplitDraft] = useState<{ name: string; weight: string }[]>(
    [],
  );
  const [splitPending, setSplitPending] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);

  function refreshFulfillment() {
    if (ticketType === "JOB" && quoteId) {
      void getQuoteFulfillmentWithOpenLoads(quoteId, ticketId).then((result) => {
        setFulfillment(result.fulfillment);
        setOnOpenLoads(result.onOpenLoads);
      });
    }
  }

  function buildSplitDraft(meta: QuoteLineFulfillment, count: number) {
    const even =
      meta.weightEach != null && count > 0
        ? String(Math.round(meta.weightEach / count))
        : "";
    return Array.from({ length: count }, (_, index) => ({
      name: `Piece ${index + 1}`,
      weight: even,
    }));
  }

  function openSplitForm(meta: QuoteLineFulfillment) {
    if (!meta.jobStructureId) {
      return;
    }
    setSplitError(null);
    setSplitFormStructureId(meta.jobStructureId);
    setSplitDraft(buildSplitDraft(meta, 4));
  }

  function setSplitPieceCount(meta: QuoteLineFulfillment, count: number) {
    const clamped = Math.max(2, Math.min(12, count));
    setSplitDraft((current) => {
      const next = buildSplitDraft(meta, clamped);
      // Keep names the user already typed; weights re-spread evenly.
      for (let index = 0; index < Math.min(current.length, clamped); index += 1) {
        next[index] = { ...next[index], name: current[index].name };
      }
      return next;
    });
  }

  function updateSplitDraft(index: number, field: "name" | "weight", value: string) {
    setSplitDraft((current) =>
      current.map((piece, i) =>
        i === index ? { ...piece, [field]: value } : piece,
      ),
    );
  }

  async function saveSplit(meta: QuoteLineFulfillment) {
    if (!meta.jobStructureId) {
      return;
    }
    setSplitError(null);
    setSplitPending(true);
    try {
      const result = await splitStructureForShipping(
        meta.jobStructureId,
        splitDraft.map((piece) => {
          const parsed = Number(piece.weight);
          return {
            name: piece.name,
            weightLbs:
              piece.weight.trim() && Number.isFinite(parsed) && parsed > 0
                ? parsed
                : null,
          };
        }),
      );
      if ("error" in result) {
        setSplitError(result.error);
        return;
      }
      setSplitFormStructureId(null);
      refreshFulfillment();
    } finally {
      setSplitPending(false);
    }
  }

  async function removeSplit(meta: QuoteLineFulfillment) {
    if (!meta.jobStructureId) {
      return;
    }
    setSplitError(null);
    setSplitPending(true);
    try {
      const result = await unsplitStructure(meta.jobStructureId);
      if ("error" in result) {
        setSplitError(result.error);
        return;
      }
      refreshFulfillment();
    } finally {
      setSplitPending(false);
    }
  }

  function structurePieceLineKey(quoteLineItemId: string, pieceId: string) {
    return `${quoteLineItemId}::${pieceId}`;
  }

  function toggleStructurePiece(
    meta: QuoteLineFulfillment,
    option: QuoteLineFulfillment["structurePieceOptions"][number],
    checked: boolean,
  ) {
    const key = structurePieceLineKey(meta.quoteLineItemId, option.pieceId);
    if (checked) {
      setLines((current) => {
        if (current.some((line) => line.key === key)) {
          return current;
        }
        return [
          ...current,
          {
            key,
            quoteLineItemId: meta.quoteLineItemId,
            productId: null,
            jobStructureId: meta.jobStructureId,
            jobStructurePieceId: option.pieceId,
            lineType: meta.lineType as EditorLine["lineType"],
            itemCode: meta.itemCode,
            description: `${meta.displayName} — ${option.name}`,
            quantity: "1",
            unit: "EA",
            weightEach: option.weightLbs != null ? String(option.weightLbs) : "",
            yardLocation: "",
          },
        ];
      });
      setSelectedLineIds((current) => new Set([...current, key]));
    } else {
      setLines((current) => current.filter((line) => line.key !== key));
      setSelectedLineIds((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
    markDirty();
  }

  const isPickup = ticketType === "WALK_IN" || fulfillmentMethod === "PICKUP";

  const walkInCategories = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; sortOrder: number; count: number }
    >();
    for (const product of products) {
      const existing = map.get(product.categoryId);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(product.categoryId, {
          id: product.categoryId,
          name: product.categoryName,
          sortOrder: product.categorySortOrder,
          count: 1,
        });
      }
    }
    return [...map.values()].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
  }, [products]);

  const walkInSubcategories = useMemo(() => {
    if (walkInCategoryId === "all") {
      return [];
    }
    const map = new Map<
      string,
      { id: string; name: string; sortOrder: number; count: number }
    >();
    let withoutSubcategory = 0;
    for (const product of products) {
      if (product.categoryId !== walkInCategoryId) {
        continue;
      }
      if (!product.subcategoryId) {
        withoutSubcategory += 1;
        continue;
      }
      const existing = map.get(product.subcategoryId);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(product.subcategoryId, {
          id: product.subcategoryId,
          name: product.subcategoryName ?? "Other",
          sortOrder: product.subcategorySortOrder ?? 0,
          count: 1,
        });
      }
    }
    const list = [...map.values()].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
    if (list.length > 0 && withoutSubcategory > 0) {
      list.push({
        id: "__none__",
        name: "Other",
        sortOrder: Number.MAX_SAFE_INTEGER,
        count: withoutSubcategory,
      });
    }
    return list;
  }, [products, walkInCategoryId]);

  const walkInFiltered = useMemo(() => {
    const q = walkInSearch.trim().toLowerCase();
    return products.filter((product) => {
      if (walkInCategoryId !== "all" && product.categoryId !== walkInCategoryId) {
        return false;
      }
      if (walkInSubcategoryId) {
        const matches =
          walkInSubcategoryId === "__none__"
            ? product.subcategoryId == null
            : product.subcategoryId === walkInSubcategoryId;
        if (!matches) {
          return false;
        }
      }
      if (q && !`${product.productCode} ${product.name}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [products, walkInSearch, walkInCategoryId, walkInSubcategoryId]);

  const walkInResults = walkInFiltered.slice(0, WALK_IN_RESULT_LIMIT);

  const walkInQtyByProductId = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of lines) {
      if (line.quoteLineItemId != null || !line.productId) {
        continue;
      }
      map.set(
        line.productId,
        (map.get(line.productId) ?? 0) + (Number(line.quantity) || 0),
      );
    }
    return map;
  }, [lines]);

  function selectWalkInCategory(categoryId: string) {
    setWalkInCategoryId(categoryId);
    setWalkInSubcategoryId(null);
  }

  function addWalkInLine(productId: string) {
    const product = products.find((entry) => entry.id === productId);
    if (!product) {
      return;
    }
    const existing = lines.find(
      (line) => line.quoteLineItemId == null && line.productId === productId,
    );
    const newKey = generateLineKey();
    // Look up again inside the updater so rapid clicks increment one line
    // instead of appending duplicates.
    setLines((current) => {
      const match = current.find(
        (line) => line.quoteLineItemId == null && line.productId === productId,
      );
      if (match) {
        return current.map((line) =>
          line.key === match.key
            ? { ...line, quantity: String((Number(line.quantity) || 0) + 1) }
            : line,
        );
      }
      return [
        ...current,
        {
          key: newKey,
          quoteLineItemId: null,
          productId: product.id,
          jobStructureId: null,
          lineType: "STOCK_PRODUCT",
          itemCode: product.productCode,
          description: product.name,
          quantity: "1",
          unit: product.unit || "EA",
          weightEach: product.weight != null ? String(product.weight) : "",
          yardLocation: "",
        },
      ];
    });
    setSelectedLineIds(
      (current) => new Set([...current, existing ? existing.key : newKey]),
    );
    markDirty();
    setError(null);
  }

  // --- JOB-ticket extras: items the customer added after the quote --------

  const extraLines =
    ticketType === "JOB"
      ? lines.filter((line) => line.quoteLineItemId == null)
      : [];

  const extraResults = useMemo(() => {
    const q = extraSearch.trim().toLowerCase();
    if (!q) {
      return [];
    }
    return products
      .filter((product) =>
        `${product.productCode} ${product.name}`.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [products, extraSearch]);

  function addExtraProduct(product: ProductOption) {
    const key = generateLineKey();
    setLines((current) => [
      ...current,
      {
        key,
        quoteLineItemId: null,
        productId: product.id,
        jobStructureId: null,
        lineType: "STOCK_PRODUCT",
        itemCode: product.productCode,
        description: product.name,
        quantity: "1",
        unit: product.unit || "EA",
        weightEach: product.weight != null ? String(product.weight) : "",
        unitPrice: product.unitPrice != null ? String(product.unitPrice) : "",
        yardLocation: "",
      },
    ]);
    setSelectedLineIds((current) => new Set([...current, key]));
    setExtraSearch("");
    markDirty();
    setError(null);
  }

  function addExtraCustomLine() {
    const key = generateLineKey();
    setLines((current) => [
      ...current,
      {
        key,
        quoteLineItemId: null,
        productId: null,
        jobStructureId: null,
        lineType: "MISC",
        itemCode: "",
        description: "",
        quantity: "1",
        unit: "EA",
        weightEach: "",
        unitPrice: "",
        yardLocation: "",
      },
    ]);
    setSelectedLineIds((current) => new Set([...current, key]));
    markDirty();
  }

  function updateWalkInLine(key: string, field: keyof EditorLine, value: string) {
    setLines((current) =>
      current.map((line) =>
        line.key === key ? { ...line, [field]: value } : line,
      ),
    );
  }

  /** Fill every quote-sourced line's override from the price list's pickup
   * price. Composite lines (ring SKUs, casting pieces) stay manual. */
  function applyPickupListPrices() {
    setLines((current) =>
      current.map((line) => {
        if (!line.quoteLineItemId || isCompositeEditorKey(line.key)) {
          return line;
        }
        const meta = fulfillmentById.get(line.quoteLineItemId);
        if (!meta || meta.pickupUnitPrice == null) {
          return line;
        }
        return { ...line, unitPrice: String(meta.pickupUnitPrice) };
      }),
    );
    markDirty();
  }

  function removeLine(key: string) {
    setLines((current) => current.filter((line) => line.key !== key));
    setSelectedLineIds((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }

  function buildPayload(status: SaveDeliveryTicketInput["status"]): SaveDeliveryTicketInput {
    const activeLines = lines.filter((line) => selectedLineIds.has(line.key));
    const linePayload: DeliveryTicketLineInput[] = activeLines
      .filter((line) => Number(line.quantity) > 0)
      // A stale selection could still hold a freight line after the ticket
      // was switched to pickup; the picker hides them, drop them here too.
      .filter(
        (line) =>
          !(
            isPickup &&
            fulfillmentMetaForEditorLine(line, fulfillmentById)
              ?.isDeliveryService
          ),
      )
      .map((line) => {
        const meta = fulfillmentMetaForEditorLine(line, fulfillmentById);
        const weightEach =
          meta != null
            ? getEffectiveWeightEach(line, meta)
            : parseEditorWeight(line.weightEach);

        return {
          quoteLineItemId: line.quoteLineItemId,
          productId: line.productId,
          jobStructureId: line.jobStructureId,
          jobStructurePieceId: line.jobStructurePieceId ?? null,
          lineType: line.lineType,
          itemCode: line.itemCode,
          description: line.description || null,
          quantity: Number(line.quantity),
          unit: line.unit,
          weightEach,
          // Quote-sourced lines carry a price override only on pickup
          // tickets (pickup repricing); switching back to delivery reverts
          // them to quote pricing. Extras always carry their agreed price.
          unitPrice:
            line.unitPrice?.trim() && (line.quoteLineItemId == null || isPickup)
              ? Number(line.unitPrice)
              : null,
          yardLocation: line.yardLocation || null,
        };
      });

    const isWalkIn = ticketType === "WALK_IN";

    return {
      ticketType,
      fulfillmentMethod: isWalkIn ? "PICKUP" : fulfillmentMethod,
      status,
      paymentMethod: isPickup ? (paymentMethod || null) : null,
      paymentReceived: isPickup ? paymentReceived : false,
      pickedUpBy: isPickup ? pickedUpBy.trim() || null : null,
      jobId: ticketType === "JOB" ? jobId || null : null,
      quoteId: ticketType === "JOB" ? quote?.id ?? null : null,
      quoteNumber: ticketType === "JOB" ? quote?.quoteNumber ?? null : null,
      jobNumber: selectedJob?.jobNumber ?? null,
      customerId: isWalkIn
        ? walkInOneOff
          ? null
          : walkInCustomerId
        : selectedJob?.customerId ?? defaultValues?.customerId ?? null,
      customerName: isWalkIn
        ? walkInCustomer.trim()
        : selectedJob?.customerName ?? defaultValues?.customerName ?? "",
      projectName: isWalkIn
        ? walkInReference.trim() || "Walk-in sale"
        : selectedJob?.projectName ?? defaultValues?.projectName ?? "",
      deliveryAddress: defaultValues?.deliveryAddress ?? null,
      deliveryDate: deliveryDate.trim() || null,
      deliveryTime: null,
      driver: resolveFleetValue(driver, driverOther),
      trailer: resolveFleetValue(trailer, trailerOther),
      // Only meaningful in edit mode; lets the server reject stale saves.
      expectedUpdatedAt,
      // Whole casting sets ship as one assembly line; partial-set leftovers
      // stay as piece lines.
      lines:
        ticketType === "JOB"
          ? collapseCastingTicketLines(
              linePayload,
              fulfillment.filter((meta) => meta.isCastingAssembly),
            )
          : linePayload,
    };
  }

  /**
   * Lines on this load that exceed the quote's remaining quantity, mirroring
   * the checks validateLines runs on save. Structures are omitted — they stay
   * hard-capped server-side (a quoted structure is one physical piece).
   */
  function computeOverQuoteEntries(
    payloadLines: DeliveryTicketLineInput[],
  ): { label: string; unit: string; onLoad: number; available: number }[] {
    const round2 = (value: number) => Math.round(value * 100) / 100;
    const standardByLine = new Map<string, number>();
    const ringFeetByLine = new Map<string, number>();
    const adsQtyByLine = new Map<string, number>();
    const castingPiecesByLine = new Map<string, Map<string, number>>();

    for (const line of payloadLines) {
      if (!line.quoteLineItemId) continue;
      const meta = fulfillmentById.get(line.quoteLineItemId);
      if (!meta || meta.isSplitStructure) continue;
      if (
        line.lineType === "CONFIGURABLE_STRUCTURE" ||
        line.lineType === "CUSTOM_STRUCTURE"
      ) {
        continue;
      }
      if (meta.isDrainRing) {
        const option = meta.drainRingOptions.find(
          (entry) => entry.productId === line.productId,
        );
        if (!option) continue;
        ringFeetByLine.set(
          meta.quoteLineItemId,
          (ringFeetByLine.get(meta.quoteLineItemId) ?? 0) +
            option.heightFeet * line.quantity,
        );
      } else if (meta.isAdsPipe) {
        adsQtyByLine.set(
          meta.quoteLineItemId,
          (adsQtyByLine.get(meta.quoteLineItemId) ?? 0) + line.quantity,
        );
      } else if (meta.isCastingAssembly) {
        if (!line.productId) continue;
        const pieces =
          castingPiecesByLine.get(meta.quoteLineItemId) ??
          new Map<string, number>();
        pieces.set(
          line.productId,
          (pieces.get(line.productId) ?? 0) + line.quantity,
        );
        castingPiecesByLine.set(meta.quoteLineItemId, pieces);
      } else {
        standardByLine.set(
          meta.quoteLineItemId,
          (standardByLine.get(meta.quoteLineItemId) ?? 0) + line.quantity,
        );
      }
    }

    const entries: {
      label: string;
      unit: string;
      onLoad: number;
      available: number;
    }[] = [];
    const push = (
      meta: QuoteLineFulfillment,
      unit: string,
      onLoad: number,
    ) => {
      entries.push({
        label: meta.displayName || meta.itemCode,
        unit,
        onLoad: round2(onLoad),
        available: getAvailableQty(meta),
      });
    };

    for (const [id, qty] of standardByLine) {
      const meta = fulfillmentById.get(id);
      if (meta && qty > getAvailableQty(meta)) push(meta, meta.unit, qty);
    }
    for (const [id, feet] of ringFeetByLine) {
      const meta = fulfillmentById.get(id);
      if (meta && feet > getAvailableQty(meta) + 0.001) push(meta, "LF", feet);
    }
    for (const [id, qty] of adsQtyByLine) {
      const meta = fulfillmentById.get(id);
      if (meta && qty > getAvailableQty(meta)) push(meta, meta.unit, qty);
    }
    for (const [id, pieces] of castingPiecesByLine) {
      const meta = fulfillmentById.get(id);
      if (!meta || meta.castingComponentOptions.length === 0) continue;
      let sets = Number.POSITIVE_INFINITY;
      for (const option of meta.castingComponentOptions) {
        const count = pieces.get(option.productId) ?? 0;
        sets = Math.min(sets, Math.floor(count / option.quantity));
      }
      // Collapsed whole-set lines carry the assembly product directly.
      const directSets = meta.productId
        ? Math.floor(pieces.get(meta.productId) ?? 0)
        : 0;
      const setsUsed = (Number.isFinite(sets) ? sets : 0) + directSets;
      if (setsUsed > getAvailableQty(meta)) push(meta, "sets", setsUsed);
    }
    return entries;
  }

  async function submit(
    status: SaveDeliveryTicketInput["status"],
    destination: "detail" | "walkIns" | "preview" = "detail",
  ) {
    setError(null);
    const payload = buildPayload(status);

    if (payload.ticketType === "JOB") {
      // Extras ship without a new quote, but the agreed price (and a name)
      // must be on the line now — invoicing bills exactly what's entered.
      const extras = payload.lines.filter((line) => !line.quoteLineItemId);
      const unnamed = extras.filter((line) => !line.itemCode.trim());
      if (unnamed.length > 0) {
        setError("Give each extra item a name / item code.");
        return;
      }
      const unpriced = extras.filter(
        (line) =>
          line.unitPrice == null ||
          !Number.isFinite(line.unitPrice) ||
          line.unitPrice < 0,
      );
      if (unpriced.length > 0) {
        setError(
          `Enter a unit price for the extra item${unpriced.length === 1 ? "" : "s"}: ${unpriced
            .map((line) => line.itemCode)
            .join(", ")}.`,
        );
        return;
      }
    }

    if (payload.ticketType === "JOB" && payload.quoteId) {
      const overages = computeOverQuoteEntries(payload.lines);
      if (overages.length > 0) {
        const details = overages
          .map((entry) => {
            const over = Math.round((entry.onLoad - entry.available) * 100) / 100;
            return `${entry.label}: ${entry.onLoad} ${entry.unit} on this load, ${entry.available} ${entry.unit} left on the quote (+${over} over)`;
          })
          .join("\n");
        const accepted = await confirm({
          title: "Ship more than quoted?",
          message: `${details}\n\nThe extra quantity will be billed at the quoted unit price.`,
          confirmLabel: "Ship anyway",
          cancelLabel: "Go back",
        });
        if (!accepted) {
          return;
        }
        payload.allowOverQuote = true;
      }
    }

    startTransition(async () => {
      const result =
        mode === "edit" && ticketId
          ? await updateDeliveryTicket(ticketId, payload)
          : await createDeliveryTicket(payload);
      if ("error" in result && result.error) {
        setError(result.error);
      } else if ("success" in result && result.success) {
        const href =
          destination === "preview"
            ? `/delivery-tickets/${result.ticketId}/preview?from=walk-ins`
            : destination === "walkIns"
              ? "/walk-ins"
              : `/delivery-tickets/${result.ticketId}`;
        router.push(href);
        router.refresh();
      }
    });
  }

  const selectedLineCount = lines.filter((line) =>
    selectedLineIds.has(line.key),
  ).length;
  const cancelHref =
    mode === "edit" && ticketId
      ? `/delivery-tickets/${ticketId}`
      : ticketType === "WALK_IN"
        ? "/walk-ins"
        : "/delivery-tickets";
  const ticketTypeButtons = (
    <div
      role="group"
      aria-label="Ticket type"
      className="inline-flex shrink-0 overflow-hidden rounded-md border border-slate-300 bg-white text-xs font-medium shadow-sm"
    >
      <button
        type="button"
        aria-pressed={ticketType === "JOB"}
        onClick={() => handleTicketTypeChange("JOB")}
        className={
          ticketType === "JOB"
            ? "bg-slate-900 px-3 py-1.5 text-white"
            : "px-3 py-1.5 text-slate-600 hover:bg-slate-50"
        }
      >
        Job ticket
      </button>
      <button
        type="button"
        aria-pressed={ticketType === "WALK_IN"}
        onClick={() => handleTicketTypeChange("WALK_IN")}
        className={
          ticketType === "WALK_IN"
            ? "bg-slate-900 px-3 py-1.5 text-white"
            : "border-l border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50"
        }
      >
        Walk-in
      </button>
    </div>
  );
  const actionButtons = (
    <div className="flex flex-wrap justify-end gap-1.5">
      <Link
        href={cancelHref}
        onClick={(event) => guardLeave(event, cancelHref)}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
      >
        Cancel
      </Link>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          submit("DRAFT", ticketType === "WALK_IN" ? "walkIns" : "detail")
        }
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save Draft"}
      </button>
      {ticketType === "WALK_IN" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("DRAFT", "preview")}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save & Preview"}
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("SCHEDULED")}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
        >
          {pending
            ? "Saving..."
            : isPickup
              ? "Schedule Pickup"
              : "Schedule Delivery"}
        </button>
      )}
    </div>
  );
  const quoteTableHeaderCellClassName = `${tableHeaderCellClassName} !z-[8] !px-1.5 !whitespace-normal`;
  const quoteLineTableCellClassName = `${tableCellClassName} !px-1.5`;
  const quoteTableHeaderStyle = {
    top: `${DASHBOARD_HEADER_HEIGHT + stickyRegionHeight}px`,
  };

  return (
    <div className="space-y-4" onChange={markDirty}>
      {backHref ? (
        <BackButton
          href={backHref}
          label={backLabel ?? "Back"}
          onClick={(event) => guardLeave(event, backHref)}
        />
      ) : null}

      {leaveTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <h3 className="text-sm font-semibold text-slate-900">
              Save your changes?
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              This ticket has unsaved changes. Save them before leaving, or
              discard them?
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setLeaveTarget(null)}
                disabled={pending}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = leaveTarget;
                  setIsDirty(false);
                  setLeaveTarget(null);
                  router.push(target);
                }}
                disabled={pending}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                Discard Changes
              </button>
              <button
                type="button"
                onClick={() => {
                  setLeaveTarget(null);
                  void submit(
                    mode === "edit"
                      ? (defaultValues?.status ?? "DRAFT")
                      : "DRAFT",
                    ticketType === "WALK_IN" ? "walkIns" : "detail",
                  );
                }}
                disabled={pending}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {ticketType === "WALK_IN" ? (
        <div className="flex flex-wrap items-center gap-3">
          {ticketTypeButtons}
          <span className="text-xs text-slate-500">
            Walk-in tickets are always customer pickups.
          </span>
        </div>
      ) : null}

      {ticketType === "JOB" ? (
        <div
          ref={stickyRegionRef}
          className={`sticky top-[74px] z-[9] border border-slate-300 bg-white/95 shadow-lg shadow-slate-900/5 backdrop-blur ${
            quote ? "rounded-t-xl" : "rounded-xl"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-1.5">
            <div className="flex flex-wrap items-center gap-3">
              {ticketTypeButtons}
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="rounded-full bg-slate-900 px-2 py-0.5 font-semibold text-white">
                  {selectedLineCount} {selectedLineCount === 1 ? "line" : "lines"}
                </span>
                <span>
                  {totalWeight > 0
                    ? formatWeight(totalWeight)
                    : "No load weight yet"}
                </span>
                {!isPickup ? (
                  <span className="text-slate-400">
                    Capacity {loadCapacityLabel}
                  </span>
                ) : null}
              </div>
            </div>
            {actionButtons}
          </div>

          <div className="flex flex-wrap items-end gap-x-2 gap-y-1.5 px-3 py-1.5">
            <div className="w-64 max-w-full min-w-0 shrink-0">
              <label htmlFor="deliveryJobId" className={compactLabelClass}>
                Job
              </label>
              <FormTypeahead<JobOption>
                inputId="deliveryJobId"
                selectedLabel={
                  selectedJob
                    ? `${selectedJob.jobNumber} - ${selectedJob.projectName}`
                    : ""
                }
                placeholder="Search job number, project, or customer..."
                initialItems={selectedJob ? [selectedJob] : []}
                searchItems={searchJobsForDeliveryTicket}
                itemKey={(job) => job.id}
                itemLabel={(job) => `${job.jobNumber} - ${job.projectName}`}
                clearLabel="Clear job selection"
                onSelect={handleJobChange}
                inputClassName={`${compactInputClass} min-w-0`}
                preventEnterSubmit={false}
              />
            </div>

            <div className="w-44 max-w-full shrink-0">
              <span className={compactLabelClass}>Contractor</span>
              <div
                title={selectedJob?.customerName}
                className="flex h-8 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-700"
              >
                <span className="truncate">
                  {selectedJob?.customerName ?? "—"}
                </span>
              </div>
            </div>

            <div className="w-32 max-w-full shrink-0">
              <label htmlFor="quoteId" className={compactLabelClass}>
                Won quote
              </label>
              <select
                id="quoteId"
                value={quoteId}
                disabled={!selectedJob || selectedJob.quotes.length === 0}
                onChange={(event) => handleQuoteChange(event.target.value)}
                className={`${compactInputClass} disabled:bg-slate-100 disabled:text-slate-400`}
              >
                {!selectedJob || selectedJob.quotes.length === 0 ? (
                  <option value="">No won quote</option>
                ) : null}
                {selectedJob?.quotes.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.quoteNumber}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-44 max-w-full shrink-0">
              <span className={compactLabelClass}>Fulfillment</span>
              <div
                role="group"
                aria-label="Fulfillment method"
                className="grid h-8 grid-cols-2 overflow-hidden rounded-md border border-slate-300 bg-white text-xs shadow-sm"
              >
                <button
                  type="button"
                  aria-pressed={fulfillmentMethod === "DELIVERY"}
                  onClick={() => {
                    setFulfillmentMethod("DELIVERY");
                    markDirty();
                  }}
                  className={
                    fulfillmentMethod === "DELIVERY"
                      ? "bg-slate-900 px-2 font-semibold text-white"
                      : "px-2 text-slate-600 hover:bg-slate-50"
                  }
                >
                  Delivery
                </button>
                <button
                  type="button"
                  aria-pressed={fulfillmentMethod === "PICKUP"}
                  onClick={() => {
                    setFulfillmentMethod("PICKUP");
                    markDirty();
                  }}
                  className={
                    fulfillmentMethod === "PICKUP"
                      ? "bg-slate-900 px-2 font-semibold text-white"
                      : "border-l border-slate-200 px-2 text-slate-600 hover:bg-slate-50"
                  }
                >
                  Pickup
                </button>
              </div>
            </div>

            <div className="w-32 max-w-full shrink-0">
              <label htmlFor="deliveryDate" className={compactLabelClass}>
                {isPickup ? "Pickup date" : "Delivery date"}
              </label>
              <input
                id="deliveryDate"
                type="date"
                value={deliveryDate}
                onChange={(event) => setDeliveryDate(event.target.value)}
                className={compactInputClass}
              />
            </div>

            {!isPickup && drivers.length > 0 ? (
              <div
                className={`max-w-full shrink-0 ${
                  driver === "__other__" ? "w-72" : "w-36"
                }`}
              >
                <label htmlFor="deliveryDriver" className={compactLabelClass}>
                  Driver
                </label>
                <div className="flex gap-1.5">
                  <select
                    id="deliveryDriver"
                    value={driver}
                    onChange={(event) => setDriver(event.target.value)}
                    className={`${compactInputClass} min-w-0 flex-1`}
                  >
                    <option value="">Driver...</option>
                    {drivers.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                    <option value="__other__">Other...</option>
                  </select>
                  {driver === "__other__" ? (
                    <input
                      aria-label="Other driver name"
                      value={driverOther}
                      onChange={(event) => setDriverOther(event.target.value)}
                      placeholder="Driver name"
                      className={`${compactInputClass} min-w-0 flex-1`}
                    />
                  ) : null}
                </div>
              </div>
            ) : null}

            {!isPickup && trailers.length > 0 ? (
              <div
                className={`max-w-full shrink-0 ${
                  trailer === "__other__" ? "w-72" : "w-36"
                }`}
              >
                <label htmlFor="deliveryTrailer" className={compactLabelClass}>
                  Trailer
                </label>
                <div className="flex gap-1.5">
                  <select
                    id="deliveryTrailer"
                    value={trailer}
                    onChange={(event) => setTrailer(event.target.value)}
                    className={`${compactInputClass} min-w-0 flex-1`}
                  >
                    <option value="">Trailer...</option>
                    {trailers.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                    <option value="__other__">Other...</option>
                  </select>
                  {trailer === "__other__" ? (
                    <input
                      aria-label="Other trailer name"
                      value={trailerOther}
                      onChange={(event) => setTrailerOther(event.target.value)}
                      placeholder="Trailer type"
                      className={`${compactInputClass} min-w-0 flex-1`}
                    />
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          {error ? (
            <p
              role="alert"
              className="border-t border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700"
            >
              {error}
            </p>
          ) : null}

          {quote ? (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-t border-slate-200 bg-white px-3 py-1.5">
              <h3 className="text-sm font-semibold text-slate-900">
                Quote lines for this load
              </h3>
              <p className="text-[11px] text-slate-500">
                Enter a load quantity to select an item. All quote lines stay visible as
                you scroll the page.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {ticketType === "JOB" && quote ? (
        <section
          style={{ marginTop: 0 }}
          className="w-full max-w-full rounded-b-xl border-x border-b border-slate-200/80 bg-white shadow-sm xl:w-fit"
        >
          {drainRingDiameterGroups.length > 0 ? (
            <table className={tableClassName}>
              <tbody className={tableBodyClassName}>
                <DrainRingMatrixRows
                  groups={drainRingDiameterGroups}
                  onQuantityChange={setDrainRingCount}
                  onAutoAssign={applyAutoRingAssignment}
                />
              </tbody>
            </table>
          ) : null}

          <table className="w-full table-fixed border-separate border-spacing-0 text-left text-xs xl:max-w-[1500px]">
              <colgroup>
                <col style={{ width: "3.5%" }} />
                <col style={{ width: "31%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "6.5%" }} />
                <col style={{ width: "6.5%" }} />
                <col style={{ width: "6.5%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "8.5%" }} />
                <col style={{ width: "6%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th
                    className={`${quoteTableHeaderCellClassName} text-center`}
                    style={quoteTableHeaderStyle}
                  >
                    Pick
                  </th>
                  <th
                    className={quoteTableHeaderCellClassName}
                    style={quoteTableHeaderStyle}
                  >
                    Item
                  </th>
                  {[
                    "Remaining",
                    "Qty on load",
                    "Scheduled",
                    "Shipped",
                    "Awarded",
                    "Weight each",
                    "Line weight",
                    "Status",
                    "On hand",
                  ].map((label) => (
                    <th
                      key={label}
                      className={`${quoteTableHeaderCellClassName} text-center`}
                      style={quoteTableHeaderStyle}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={tableBodyClassName}>
                {fulfillment
                  .filter((line) => !line.isDrainRing)
                  // Freight lines never ride on a customer-pickup ticket.
                  .filter((line) => !(isPickup && line.isDeliveryService))
                  .map((line) => {
                  const isConfigurableStructure =
                    line.lineType === "CONFIGURABLE_STRUCTURE";
                  const linePrimaryLabel = getDeliveryLinePrimaryLabel(line);
                  const lineSecondaryLabel = getDeliveryLineSecondaryLabel(line);

                  if (line.isCastingAssembly) {
                    const setsUsed = getCastingSetsUsed(line);
                    const setsAvailable = getAvailableQty(line);
                    const setsRemainingAfter = setsAvailable - setsUsed;
                    const overLimit = setsUsed > setsAvailable + 0.001;
                    const piecesEven = castingPiecesAreEvenSets(line);
                    const piecesExpanded =
                      !piecesEven ||
                      expandedCastingIds.has(line.quoteLineItemId);
                    return (
                      <tr key={line.quoteLineItemId} className="bg-slate-50/40">
                        <td className={`${quoteLineTableCellClassName} align-top`} colSpan={11}>
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <div>
                              <span className="font-medium text-slate-900">
                                {line.displayName}
                              </span>
                              <span className="ml-2 text-slate-500">
                                {line.itemCode}
                              </span>
                              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                                Casting
                              </span>
                            </div>
                            <div className="text-slate-600">
                              {setsAvailable} of {line.quotedQty} EA remaining ·{" "}
                              {getOnOpenLoadsQty(line)} scheduled ·{" "}
                              {line.shippedQty} shipped
                            </div>
                          </div>
                          {shouldShowDeliveryLineDescription(line) ? (
                            <div className="mt-0.5 text-slate-500">
                              <RichTextContent value={line.description ?? ""} />
                            </div>
                          ) : null}

                          {line.castingComponentOptions.length === 0 ? (
                            <p className="mt-2 text-slate-500">
                              {line.eligibilityReason ??
                                "No BOM components linked to this casting."}
                            </p>
                          ) : (
                            <>
                              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                <label className="flex items-center gap-2 text-[11px] font-medium text-slate-700">
                                  Sets on load
                                  <input
                                    aria-label={`${line.displayName} sets on load`}
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={piecesEven ? setsUsed || "" : ""}
                                    placeholder={piecesEven ? "0" : "mixed"}
                                    className={`w-20 ${loadQuantityInputClass}`}
                                    onChange={(event) =>
                                      setCastingSets(line, event.target.value)
                                    }
                                  />
                                </label>
                                <span className="text-[10px] text-slate-400">
                                  1 set ={" "}
                                  {line.castingComponentOptions
                                    .map(
                                      (option) =>
                                        `${option.quantity > 1 ? `${option.quantity}× ` : ""}${formatCastingPieceRoleLabel(option.pieceRole)}`,
                                    )
                                    .join(" + ")}
                                </span>
                                {piecesEven ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedCastingIds((current) => {
                                        const next = new Set(current);
                                        if (next.has(line.quoteLineItemId)) {
                                          next.delete(line.quoteLineItemId);
                                        } else {
                                          next.add(line.quoteLineItemId);
                                        }
                                        return next;
                                      })
                                    }
                                    className="rounded border border-slate-200 bg-white px-1.5 py-px text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                                  >
                                    {piecesExpanded
                                      ? "Hide pieces"
                                      : "Adjust pieces"}
                                  </button>
                                ) : (
                                  <span className="text-[10px] font-medium text-amber-600">
                                    Partial set — piece counts differ
                                  </span>
                                )}
                              </div>
                              {piecesExpanded ? (
                            <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                              {line.castingComponentOptions.map((option) => (
                                <div
                                  key={`${option.pieceRole}-${option.productId}`}
                                  className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5"
                                >
                                  <div className="min-w-0">
                                    <div className="truncate font-medium text-slate-800">
                                      {formatCastingPieceRoleLabel(option.pieceRole)} ·{" "}
                                      {option.name}
                                    </div>
                                    <div className="truncate text-[10px] text-slate-500">
                                      {option.productCode} ·{" "}
                                      {option.currentStock != null
                                        ? `${option.currentStock} on hand`
                                        : "Not tracked"}
                                      {option.quantity > 1
                                        ? ` · ${option.quantity} per set`
                                        : ""}
                                    </div>
                                  </div>
                                  <input
                                    aria-label={`${formatCastingPieceRoleLabel(option.pieceRole)} quantity on load`}
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={getCastingPieceCount(
                                      line.quoteLineItemId,
                                      option.pieceRole,
                                    )}
                                    placeholder="0"
                                    className={`w-full ${loadQuantityInputClass}`}
                                    onChange={(event) =>
                                      setCastingPieceCount(
                                        line,
                                        option,
                                        event.target.value,
                                      )
                                    }
                                  />
                                </div>
                              ))}
                            </div>
                              ) : null}
                            </>
                          )}

                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
                            <span>
                              On load:{" "}
                              <span className="font-semibold text-slate-900">
                                {setsUsed} full set{setsUsed === 1 ? "" : "s"}
                              </span>
                            </span>
                            <span
                              className={
                                overLimit
                                  ? "font-semibold text-red-600"
                                  : "text-slate-600"
                              }
                            >
                              Remaining after load: {setsRemainingAfter} EA
                            </span>
                            {overLimit ? (
                              <span className="font-semibold text-red-600">
                                Exceeds remaining quantity
                              </span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  if (line.isAdsPipe) {
                    const qtyUsed = getAdsPipeQtyUsed(line);
                    const qtyAvailable = getAvailableQty(line);
                    const qtyRemainingAfter =
                      Math.round((qtyAvailable - qtyUsed) * 100) / 100;
                    const overLimit = qtyUsed > qtyAvailable + 0.001;
                    return (
                      <tr key={line.quoteLineItemId} className="bg-slate-50/40">
                        <td className={`${quoteLineTableCellClassName} align-top`} colSpan={11}>
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <div>
                              <span className="font-medium text-slate-900">
                                {line.displayName}
                              </span>
                              <span className="ml-2 text-slate-500">
                                {line.itemCode}
                              </span>
                              <span className="ml-2 text-slate-500">
                                ADS pipe · Soiltight quoted
                              </span>
                            </div>
                            <div className="text-slate-600">
                              {qtyAvailable} of {line.quotedQty}{" "}
                              {line.unit} remaining ·{" "}
                              {getOnOpenLoadsQty(line)} scheduled ·{" "}
                              {line.shippedQty} shipped
                            </div>
                          </div>
                          {shouldShowDeliveryLineDescription(line) ? (
                            <div className="mt-0.5 text-slate-500">
                              <RichTextContent value={line.description ?? ""} />
                            </div>
                          ) : null}

                          {line.adsPipeOptions.length === 0 ? (
                            <p className="mt-2 text-slate-500">
                              {line.eligibilityReason ??
                                "No matching ADS pipe SKUs in catalog."}
                            </p>
                          ) : (
                            <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                              {line.adsPipeOptions.map((option) => (
                                <div
                                  key={option.productId}
                                  className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5"
                                >
                                  <div className="min-w-0">
                                    <div className="truncate font-medium text-slate-800">
                                      {option.jointTypeLabel}
                                      <span className="ml-1 font-normal text-slate-400">
                                        {option.productCode}
                                      </span>
                                    </div>
                                    <div
                                      className={`truncate text-[10px] ${
                                        option.isSubstitute
                                          ? "text-amber-700"
                                          : "text-slate-500"
                                      }`}
                                    >
                                      {option.currentStock != null
                                        ? `${option.currentStock} on hand`
                                        : "Not tracked"}
                                      {option.isSubstitute
                                        ? " · Substitute at quoted ST price"
                                        : ""}
                                    </div>
                                  </div>
                                  <input
                                    aria-label={`${option.jointTypeLabel} pipe quantity on load`}
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={getAdsPipeCount(
                                      line.quoteLineItemId,
                                      option.productId,
                                    )}
                                    placeholder="0"
                                    className={`w-full ${loadQuantityInputClass}`}
                                    onChange={(event) =>
                                      setAdsPipeCount(
                                        line,
                                        option,
                                        event.target.value,
                                      )
                                    }
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
                            <span>
                              On load:{" "}
                              <span className="font-semibold text-slate-900">
                                {qtyUsed} {line.unit}
                              </span>
                            </span>
                            <span
                              className={
                                overLimit
                                  ? "font-semibold text-red-600"
                                  : "text-slate-600"
                              }
                            >
                              Remaining after load: {qtyRemainingAfter} {line.unit}
                            </span>
                            {overLimit ? (
                              <span className="font-semibold text-red-600">
                                Exceeds remaining quantity
                              </span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  if (line.isSplitStructure) {
                    const claimedElsewhere = line.structurePieceOptions.filter(
                      (option) =>
                        option.deliveredTicketNumber || option.openTicketNumber,
                    ).length;
                    const selectedHere = line.structurePieceOptions.filter(
                      (option) =>
                        selectedLineIds.has(
                          structurePieceLineKey(line.quoteLineItemId, option.pieceId),
                        ),
                    ).length;
                    const canUnsplit =
                      claimedElsewhere === 0 && selectedHere === 0;
                    return (
                      <tr key={line.quoteLineItemId} className="bg-slate-50/40">
                        <td className={`${quoteLineTableCellClassName} align-top`} colSpan={11}>
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <div>
                              <span
                                className={
                                  isConfigurableStructure
                                    ? "text-sm font-bold text-slate-950"
                                    : "font-medium text-slate-900"
                                }
                              >
                                {linePrimaryLabel}
                              </span>
                              {isConfigurableStructure ? (
                                lineSecondaryLabel ? (
                                  <span className="ml-2 text-slate-500">
                                    {lineSecondaryLabel}
                                  </span>
                                ) : null
                              ) : (
                                <span className="ml-2 text-slate-500">
                                  {line.itemCode}
                                </span>
                              )}
                              <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-800">
                                Split · {line.structurePieceOptions.length} pieces
                              </span>
                            </div>
                            <div className="text-slate-600">
                              {line.structurePieceOptions.filter((o) => o.deliveredTicketNumber).length}{" "}
                              shipped · {claimedElsewhere} claimed ·{" "}
                              {line.structurePieceOptions.length - claimedElsewhere - selectedHere}{" "}
                              available
                            </div>
                          </div>
                          {shouldShowDeliveryLineDescription(line) ? (
                            <div className="mt-0.5 text-slate-500">
                              <RichTextContent value={line.description ?? ""} />
                            </div>
                          ) : null}

                          {!line.eligible && line.eligibilityReason ? (
                            <p className="mt-2 text-slate-500">{line.eligibilityReason}</p>
                          ) : null}

                          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {line.structurePieceOptions.map((option) => {
                              const key = structurePieceLineKey(
                                line.quoteLineItemId,
                                option.pieceId,
                              );
                              const claimedBy =
                                option.deliveredTicketNumber ?? option.openTicketNumber;
                              const checked = selectedLineIds.has(key);
                              return (
                                <div
                                  key={option.pieceId}
                                  className={`rounded-lg border px-3 py-2 ${
                                    claimedBy
                                      ? "border-slate-100 bg-slate-50"
                                      : "border-slate-200 bg-white"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-slate-800">
                                      {option.name}
                                    </span>
                                    <span className="text-slate-400">
                                      {option.weightLbs != null
                                        ? formatWeight(option.weightLbs)
                                        : "—"}
                                    </span>
                                  </div>
                                  {claimedBy ? (
                                    <p
                                      className={`mt-1 text-[11px] font-medium ${
                                        option.deliveredTicketNumber
                                          ? "text-green-700"
                                          : "text-sky-700"
                                      }`}
                                    >
                                      {option.deliveredTicketNumber
                                        ? `Delivered · ${option.deliveredTicketNumber}`
                                        : `On ${option.openTicketNumber}`}
                                    </p>
                                  ) : (
                                    <label className="mt-1 flex items-center gap-2 text-xs text-slate-700">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={
                                          !line.eligible && !checked
                                        }
                                        onChange={(event) =>
                                          toggleStructurePiece(
                                            line,
                                            option,
                                            event.target.checked,
                                          )
                                        }
                                      />
                                      On this load
                                    </label>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            {canUnsplit ? (
                              <button
                                type="button"
                                disabled={splitPending}
                                onClick={() => void removeSplit(line)}
                                className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline disabled:opacity-50"
                              >
                                Remove split (ship whole)
                              </button>
                            ) : null}
                            {splitError && splitFormStructureId === null ? (
                              <span className="text-[11px] text-red-600">{splitError}</span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  const editorLine = linesByKey.get(line.quoteLineItemId);
                  const checked = selectedLineIds.has(line.quoteLineItemId);
                  const qty = editorLine ? Number(editorLine.quantity) || 0 : 0;
                  const effectiveWeightEach = getEffectiveWeightEach(editorLine, line);
                  const lineWeight = qty * (effectiveWeightEach ?? 0);
                  const weightInputValue = editorLine
                    ? editorLine.weightEach.trim() ||
                      (line.weightEach != null ? String(line.weightEach) : "")
                    : "";
                  return (
                    <tr
                      key={line.quoteLineItemId}
                      className={checked ? "bg-sky-50/70" : "hover:bg-slate-50/70"}
                    >
                      <td className={`${quoteLineTableCellClassName} align-top text-center`}>
                        <input
                          aria-label={`Select ${linePrimaryLabel}`}
                          type="checkbox"
                          checked={checked}
                          disabled={!line.eligible}
                          onChange={(event) => toggleLine(line, event.target.checked)}
                        />
                      </td>
                      <td className={`${quoteLineTableCellClassName} align-top`}>
                        {(() => {
                          const canSplit =
                            (line.lineType === "CONFIGURABLE_STRUCTURE" ||
                              line.lineType === "CUSTOM_STRUCTURE") &&
                            line.jobStructureId != null &&
                            line.quotedQty === 1 &&
                            line.jobStructureStatus === "MADE" &&
                            line.remainingQty > 0;
                          const splitFormOpen =
                            canSplit &&
                            splitFormStructureId === line.jobStructureId;
                          return (
                            <>
                              <div
                                className={
                                  isConfigurableStructure
                                    ? "text-sm font-bold leading-snug text-slate-950"
                                    : "font-medium leading-snug text-slate-900"
                                }
                              >
                                {linePrimaryLabel}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-500">
                                {isConfigurableStructure ? (
                                  lineSecondaryLabel ? (
                                    <span>{lineSecondaryLabel}</span>
                                  ) : null
                                ) : (
                                  <span>{line.itemCode}</span>
                                )}
                                {line.lineType !== "STOCK_PRODUCT" ? (
                                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                    {formatLineTypeLabel(line.lineType)}
                                  </span>
                                ) : null}
                                {canSplit && !splitFormOpen ? (
                                  <button
                                    type="button"
                                    onClick={() => openSplitForm(line)}
                                    className="rounded border border-slate-200 bg-white px-1.5 py-px text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                                  >
                                    Split for shipping
                                  </button>
                                ) : null}
                              </div>
                              {shouldShowDeliveryLineDescription(line) ? (
                                <div className="mt-0.5 text-slate-500">
                                  <RichTextContent
                                    value={line.description ?? ""}
                                  />
                                </div>
                              ) : null}
                              {splitFormOpen ? (
                            <div className="mt-2 max-w-md rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <div className="flex items-center gap-2">
                                <label className="text-[11px] font-medium text-slate-700">
                                  Pieces
                                </label>
                                <input
                                  type="number"
                                  min="2"
                                  max="12"
                                  value={splitDraft.length}
                                  onChange={(event) =>
                                    setSplitPieceCount(
                                      line,
                                      Number(event.target.value) || 2,
                                    )
                                  }
                                  className={`w-16 ${inlineTableInputClass}`}
                                />
                                <span className="text-[10px] text-slate-400">
                                  Names + optional weight each (lb)
                                </span>
                              </div>
                              <div className="mt-2 grid grid-cols-[1fr_6rem] gap-1.5">
                                {splitDraft.map((piece, index) => (
                                  <Fragment key={index}>
                                    <input
                                      value={piece.name}
                                      onChange={(event) =>
                                        updateSplitDraft(index, "name", event.target.value)
                                      }
                                      placeholder={`Piece ${index + 1}`}
                                      className={inlineTableInputClass}
                                    />
                                    <input
                                      type="number"
                                      min="0"
                                      step="any"
                                      value={piece.weight}
                                      onChange={(event) =>
                                        updateSplitDraft(index, "weight", event.target.value)
                                      }
                                      placeholder="lb"
                                      className={inlineTableInputClass}
                                    />
                                  </Fragment>
                                ))}
                              </div>
                              {splitError ? (
                                <p className="mt-2 text-[11px] text-red-600">{splitError}</p>
                              ) : null}
                              <div className="mt-2 flex gap-2">
                                <button
                                  type="button"
                                  disabled={splitPending}
                                  onClick={() => void saveSplit(line)}
                                  className="rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                                >
                                  {splitPending
                                    ? "Splitting…"
                                    : `Create ${splitDraft.length} pieces`}
                                </button>
                                <button
                                  type="button"
                                  disabled={splitPending}
                                  onClick={() => setSplitFormStructureId(null)}
                                  className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-white disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                              ) : null}
                            </>
                          );
                        })()}
                      </td>
                      <td className={`${quoteLineTableCellClassName} align-top text-center font-medium text-slate-900`}>
                        {getAvailableQty(line)}
                      </td>
                      <td className={`${quoteLineTableCellClassName} align-top text-center`}>
                        <input
                          aria-label={`${linePrimaryLabel} quantity on load`}
                          type="number"
                          min="0"
                          max={getAvailableQty(line)}
                          step="any"
                          value={editorLine?.quantity ?? ""}
                          placeholder="0"
                          disabled={!line.eligible}
                          className={`mx-auto w-full max-w-20 ${loadQuantityInputClass}`}
                          onChange={(event) =>
                            setStandardLineQuantity(line, event.target.value)
                          }
                        />
                      </td>
                      <td className={`${quoteLineTableCellClassName} align-top text-center text-slate-600`}>
                        {getOnOpenLoadsQty(line)}
                      </td>
                      <td className={`${quoteLineTableCellClassName} align-top text-center text-slate-600`}>
                        {line.shippedQty}
                      </td>
                      <td className={`${quoteLineTableCellClassName} align-top text-center text-slate-600`}>
                        {line.quotedQty}
                      </td>
                      <td className={`${quoteLineTableCellClassName} align-top text-center text-slate-700`}>
                        {checked && editorLine ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={weightInputValue}
                            placeholder="—"
                            className={`mx-auto w-full max-w-24 ${inlineTableInputClass}`}
                            onChange={(event) =>
                              setLines((current) =>
                                current.map((row) =>
                                  row.key === line.quoteLineItemId
                                    ? { ...row, weightEach: event.target.value }
                                    : row,
                                ),
                              )
                            }
                          />
                        ) : line.weightEach != null ? (
                          formatWeight(line.weightEach)
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={`${quoteLineTableCellClassName} align-top text-center font-medium text-slate-900`}>
                        {checked && lineWeight > 0 ? formatWeight(lineWeight) : "—"}
                      </td>
                      <td className={`${quoteLineTableCellClassName} align-top text-center text-slate-600`}>
                        {line.eligible
                          ? (line.eligibilityReason ?? "Ready")
                          : (line.eligibilityReason ?? "Not ready")}
                      </td>
                      <td
                        className={`${quoteLineTableCellClassName} align-top text-center text-slate-700`}
                      >
                        {line.currentStock != null ? (
                          <>
                            <span className="font-semibold text-slate-900">
                              {line.currentStock}
                            </span>{" "}
                            {line.unit}
                          </>
                        ) : line.lineType === "STOCK_PRODUCT" ? (
                          <span className="text-slate-400">Not tracked</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50/80">
                <tr>
                  <td colSpan={8} className={`${quoteLineTableCellClassName} text-right font-medium text-slate-700`}>
                    Total load weight
                  </td>
                  <td className={`${quoteLineTableCellClassName} font-semibold text-slate-900`}>
                    {totalWeight > 0 ? formatWeight(totalWeight) : "—"}
                  </td>
                  <td
                    colSpan={2}
                    className={`${quoteLineTableCellClassName} text-slate-500`}
                  >
                    Capacity: {loadCapacityLabel}
                  </td>
                </tr>
              </tfoot>
          </table>
        </section>
      ) : null}

      {ticketType === "JOB" && quote && isPickup ? (
        <SectionCard
          title="Pickup pricing"
          description="Customer pickup — the quote's delivery charges stay off this ticket. Lines bill at the pickup price entered here; leave a price blank to bill as quoted."
        >
          {(() => {
            const pricedLines = lines.filter(
              (line) =>
                selectedLineIds.has(line.key) &&
                Number(line.quantity) > 0 &&
                line.quoteLineItemId,
            );
            if (pricedLines.length === 0) {
              return (
                <p className="text-xs text-slate-500">
                  Pick lines above to price this pickup.
                </p>
              );
            }
            const rows = pricedLines.map((line) => {
              const meta = fulfillmentMetaForEditorLine(line, fulfillmentById);
              const composite = isCompositeEditorKey(line.key);
              const quotedEach =
                meta && !composite ? meta.quotedUnitPrice : null;
              const qty = Number(line.quantity) || 0;
              const overrideRaw = line.unitPrice?.trim() ?? "";
              const overrideEach =
                overrideRaw && Number.isFinite(Number(overrideRaw))
                  ? Number(overrideRaw)
                  : null;
              const effectiveEach = overrideEach ?? quotedEach;
              return {
                line,
                label: meta?.displayName ?? line.itemCode,
                itemCode: line.itemCode,
                quotedEach,
                pickupListEach:
                  meta && !composite ? meta.pickupUnitPrice : null,
                qty,
                effectiveEach,
              };
            });
            const total = rows.reduce(
              (sum, row) =>
                row.effectiveEach != null
                  ? sum + row.qty * row.effectiveEach
                  : sum,
              0,
            );
            const savings = rows.reduce(
              (sum, row) =>
                row.quotedEach != null && row.effectiveEach != null
                  ? sum + row.qty * (row.quotedEach - row.effectiveEach)
                  : sum,
              0,
            );
            const hasListPrices = rows.some(
              (row) => row.pickupListEach != null,
            );
            return (
              <>
                {hasListPrices ? (
                  <div className="mb-3">
                    <button
                      type="button"
                      onClick={applyPickupListPrices}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Apply price-list pickup prices
                    </button>
                  </div>
                ) : null}
                <div className="overflow-x-auto">
                  <table className={tableClassName}>
                    <thead>
                      <tr>
                        <th className={tableHeaderCellClassName}>Item</th>
                        <th className={`${tableHeaderCellClassName} text-center`}>
                          Qty
                        </th>
                        <th className={`${tableHeaderCellClassName} text-center`}>
                          Quoted each
                        </th>
                        <th className={`${tableHeaderCellClassName} text-center`}>
                          Pickup price each ($)
                        </th>
                        <th className={`${tableHeaderCellClassName} text-right`}>
                          Line total
                        </th>
                      </tr>
                    </thead>
                    <tbody className={tableBodyClassName}>
                      {rows.map((row) => (
                        <tr key={row.line.key}>
                          <td className={tableCellClassName}>
                            <div className="font-medium text-slate-900">
                              {row.label}
                            </div>
                            <div className="text-slate-500">{row.itemCode}</div>
                          </td>
                          <td className={`${tableCellClassName} text-center`}>
                            {row.qty} {row.line.unit}
                          </td>
                          <td
                            className={`${tableCellClassName} text-center ${
                              row.effectiveEach != null &&
                              row.quotedEach != null &&
                              row.effectiveEach < row.quotedEach
                                ? "text-slate-400 line-through"
                                : "text-slate-600"
                            }`}
                          >
                            {row.quotedEach != null
                              ? formatUsd(row.quotedEach)
                              : "—"}
                          </td>
                          <td className={`${tableCellClassName} text-center`}>
                            <input
                              aria-label={`${row.label} pickup price each`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.line.unitPrice ?? ""}
                              placeholder={
                                row.quotedEach != null
                                  ? row.quotedEach.toFixed(2)
                                  : "as quoted"
                              }
                              onChange={(event) => {
                                updateWalkInLine(
                                  row.line.key,
                                  "unitPrice",
                                  event.target.value,
                                );
                                markDirty();
                              }}
                              className={`mx-auto w-28 ${tableInlineInputClassName} text-center`}
                            />
                          </td>
                          <td className={`${tableCellClassName} text-right font-medium text-slate-900`}>
                            {row.effectiveEach != null && row.qty > 0
                              ? formatUsd(row.qty * row.effectiveEach)
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200 bg-slate-50/80">
                        <td
                          colSpan={4}
                          className={`${tableCellClassName} text-right font-medium text-slate-700`}
                        >
                          {savings > 0.004 ? (
                            <span className="mr-3 font-normal text-green-700">
                              {formatUsd(savings)} below quoted — invoice will
                              note the pickup adjustment
                            </span>
                          ) : null}
                          Ticket total
                        </td>
                        <td className={`${tableCellClassName} text-right font-semibold text-slate-900`}>
                          {formatUsd(total)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            );
          })()}
        </SectionCard>
      ) : null}

      {ticketType === "JOB" && quote ? (
        <SectionCard
          title="Extra items"
          description="Items the customer added after the quote — no new quote needed; they bill on the invoice at the price you enter here."
        >
          <div className="flex flex-wrap items-start gap-2">
            <div className="relative w-full max-w-sm">
              <input
                type="text"
                value={extraSearch}
                onChange={(event) => setExtraSearch(event.target.value)}
                placeholder="Search products by code or name…"
                className={compactInputClass}
              />
              {extraResults.length > 0 ? (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                  {extraResults.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addExtraProduct(product)}
                      className="flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-slate-50"
                    >
                      <span className="min-w-0">
                        <span className="font-medium text-slate-900">
                          {product.productCode}
                        </span>{" "}
                        <span className="text-slate-600">{product.name}</span>
                      </span>
                      <span className="shrink-0 text-slate-500">
                        {product.unitPrice != null
                          ? formatUsd(product.unitPrice)
                          : "no list price"}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={addExtraCustomLine}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              + Custom item
            </button>
          </div>

          {extraLines.length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <table className={tableClassName}>
                <thead>
                  <tr>
                    <th className={tableHeaderCellClassName}>Item</th>
                    <th className={tableHeaderCellClassName}>Description</th>
                    <th className={`${tableHeaderCellClassName} text-center`}>Qty</th>
                    <th className={`${tableHeaderCellClassName} text-center`}>Unit</th>
                    <th className={`${tableHeaderCellClassName} text-center`}>
                      Price Each ($) *
                    </th>
                    <th className={`${tableHeaderCellClassName} text-center`}>
                      Weight Each (lb)
                    </th>
                    <th className={`${tableHeaderCellClassName} text-right`}>
                      Line Total
                    </th>
                    <th className={tableHeaderCellClassName} />
                  </tr>
                </thead>
                <tbody className={tableBodyClassName}>
                  {extraLines.map((line) => {
                    const qty = Number(line.quantity) || 0;
                    const price = Number(line.unitPrice ?? "");
                    const priceMissing =
                      !line.unitPrice?.trim() ||
                      !Number.isFinite(price) ||
                      price < 0;
                    return (
                      <tr key={line.key}>
                        <td className={tableCellClassName}>
                          {line.productId ? (
                            <span className="font-medium text-slate-900">
                              {line.itemCode}
                            </span>
                          ) : (
                            <input
                              type="text"
                              value={line.itemCode}
                              placeholder="Item code / name"
                              onChange={(event) =>
                                updateWalkInLine(
                                  line.key,
                                  "itemCode",
                                  event.target.value,
                                )
                              }
                              className={`w-32 ${tableInlineInputClassName}`}
                            />
                          )}
                        </td>
                        <td className={tableCellClassName}>
                          <input
                            type="text"
                            value={line.description}
                            onChange={(event) =>
                              updateWalkInLine(
                                line.key,
                                "description",
                                event.target.value,
                              )
                            }
                            className={`w-full min-w-40 ${tableInlineInputClassName}`}
                          />
                        </td>
                        <td className={`${tableCellClassName} text-center`}>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={line.quantity}
                            onChange={(event) =>
                              updateWalkInLine(
                                line.key,
                                "quantity",
                                event.target.value,
                              )
                            }
                            className={`mx-auto w-16 ${tableInlineInputClassName} text-center`}
                          />
                        </td>
                        <td className={`${tableCellClassName} text-center text-slate-600`}>
                          {line.unit}
                        </td>
                        <td className={`${tableCellClassName} text-center`}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unitPrice ?? ""}
                            placeholder="required"
                            onChange={(event) =>
                              updateWalkInLine(
                                line.key,
                                "unitPrice",
                                event.target.value,
                              )
                            }
                            className={`mx-auto w-24 ${tableInlineInputClassName} text-center ${
                              priceMissing
                                ? "border-amber-400 bg-amber-50/60"
                                : ""
                            }`}
                          />
                        </td>
                        <td className={`${tableCellClassName} text-center`}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.weightEach}
                            onChange={(event) =>
                              updateWalkInLine(
                                line.key,
                                "weightEach",
                                event.target.value,
                              )
                            }
                            className={`mx-auto w-20 ${tableInlineInputClassName} text-center`}
                          />
                        </td>
                        <td className={`${tableCellClassName} text-right font-medium text-slate-900`}>
                          {!priceMissing && qty > 0
                            ? formatUsd(qty * price)
                            : "—"}
                        </td>
                        <td className={`${tableCellClassName} text-right`}>
                          <button
                            type="button"
                            onClick={() => removeLine(line.key)}
                            className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-red-600 hover:bg-red-50"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-400">
              Nothing extra on this load — search the catalog or add a custom
              item when a customer phones something in.
            </p>
          )}
        </SectionCard>
      ) : null}

      {ticketType === "WALK_IN" ? (
        <SectionCard
          title="Walk-in details"
          description="Customer, pickup date, and payment for this counter sale."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label
                htmlFor="walkInCustomer"
                className="block text-xs font-medium text-slate-700"
              >
                Customer
              </label>
              {walkInOneOff ? (
                <input
                  id="walkInCustomer"
                  value={walkInCustomer}
                  onChange={(event) => setWalkInCustomer(event.target.value)}
                  placeholder="Cash sale / customer name"
                  className={inputClass}
                />
              ) : (
                <FormTypeahead
                  inputId="walkInCustomer"
                  selectedLabel={walkInCustomerId ? walkInCustomer : ""}
                  placeholder="Search customers…"
                  searchItems={searchCustomersForWalkInTicket}
                  itemKey={(customer) => customer.id}
                  itemLabel={(customer) => customer.name}
                  clearLabel="Clear customer"
                  onSelect={(customer) => {
                    setWalkInCustomerId(customer?.id ?? null);
                    setWalkInCustomer(customer?.name ?? "");
                    markDirty();
                  }}
                  inputClassName={inputClass}
                />
              )}
              <button
                type="button"
                onClick={() => {
                  setWalkInOneOff((current) => !current);
                  setWalkInCustomerId(null);
                  setWalkInCustomer("");
                }}
                className="mt-1 text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline"
              >
                {walkInOneOff
                  ? "Search existing customers"
                  : "Cash / one-off customer instead"}
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Reference / PO (optional)
              </label>
              <input
                value={walkInReference}
                onChange={(event) => setWalkInReference(event.target.value)}
                placeholder="Walk-in sale"
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="deliveryDate"
                className="block text-xs font-medium text-slate-700"
              >
                Pickup date
              </label>
              <input
                id="deliveryDate"
                type="date"
                value={deliveryDate}
                onChange={(event) => setDeliveryDate(event.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Payment method
              </label>
              <select
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(
                    event.target.value as "PAY_NOW" | "ON_ACCOUNT" | "",
                  )
                }
                className={inputClass}
              >
                <option value="">Not specified</option>
                <option value="PAY_NOW">Pay now</option>
                <option value="ON_ACCOUNT">Charge to account</option>
              </select>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3">
            <div className="w-full max-w-xs">
              <label className="block text-xs font-medium text-slate-700">
                Picked up by (optional)
              </label>
              <input
                value={pickedUpBy}
                onChange={(event) => setPickedUpBy(event.target.value)}
                placeholder="Name on pickup"
                className={inputClass}
              />
            </div>
            <label className="flex items-center gap-2 pb-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={paymentReceived}
                onChange={(event) => setPaymentReceived(event.target.checked)}
              />
              Payment received
            </label>
          </div>
        </SectionCard>
      ) : null}

      {ticketType === "WALK_IN" ? (
        <SectionCard
          title="Products on this ticket"
          description="Pick a category, then click products to add them. Click again to add another."
        >
          {products.length === 0 ? (
            <p className="text-xs text-slate-500">
              No active products are available to add.
            </p>
          ) : (
            <div className="space-y-3">
              <input
                type="search"
                value={walkInSearch}
                onChange={(event) => setWalkInSearch(event.target.value)}
                placeholder={
                  walkInCategoryId === "all"
                    ? "Search all products by code or name…"
                    : "Search within this category…"
                }
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm placeholder:text-slate-400"
              />
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => selectWalkInCategory("all")}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                    walkInCategoryId === "all"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  All{" "}
                  <span
                    className={
                      walkInCategoryId === "all"
                        ? "text-slate-300"
                        : "text-slate-400"
                    }
                  >
                    {products.length}
                  </span>
                </button>
                {walkInCategories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => selectWalkInCategory(category.id)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                      walkInCategoryId === category.id
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {category.name}{" "}
                    <span
                      className={
                        walkInCategoryId === category.id
                          ? "text-slate-300"
                          : "text-slate-400"
                      }
                    >
                      {category.count}
                    </span>
                  </button>
                ))}
              </div>
              {walkInSubcategories.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">
                    Subcategory:
                  </span>
                  <button
                    type="button"
                    onClick={() => setWalkInSubcategoryId(null)}
                    className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                      walkInSubcategoryId == null
                        ? "border-slate-300 bg-slate-100 text-slate-900"
                        : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    All
                  </button>
                  {walkInSubcategories.map((subcategory) => (
                    <button
                      key={subcategory.id}
                      type="button"
                      onClick={() => setWalkInSubcategoryId(subcategory.id)}
                      className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                        walkInSubcategoryId === subcategory.id
                          ? "border-slate-300 bg-slate-100 text-slate-900"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {subcategory.name}{" "}
                      <span className="text-slate-400">{subcategory.count}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {walkInResults.length > 0 ? (
                <>
                  <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                    {walkInResults.map((product) => {
                      const onTicket =
                        walkInQtyByProductId.get(product.id) ?? 0;
                      return (
                        <li key={product.id}>
                          <button
                            type="button"
                            onClick={() => addWalkInLine(product.id)}
                            className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs ${
                              onTicket > 0
                                ? "bg-emerald-50/60 hover:bg-emerald-50"
                                : "hover:bg-slate-50"
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="font-medium text-slate-900">
                                {product.productCode}
                              </span>
                              <span className="ml-2 text-slate-600">
                                {product.name}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-3 text-slate-500">
                              {product.unitPrice != null ? (
                                <span className="font-medium text-slate-700">
                                  {formatUsd(product.unitPrice)}
                                </span>
                              ) : null}
                              {product.currentStock != null ? (
                                <span>{product.currentStock} in stock</span>
                              ) : null}
                              {onTicket > 0 ? (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                                  {onTicket} on ticket
                                </span>
                              ) : (
                                <span className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                  Add
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {walkInFiltered.length > walkInResults.length ? (
                    <p className="text-[11px] text-slate-400">
                      Showing {walkInResults.length} of {walkInFiltered.length} —
                      refine with search or a subcategory.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-xs text-slate-500">
                  No products match this filter.
                </p>
              )}
            </div>
          )}

          {lines.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className={tableClassName}>
                <thead>
                  <tr>
                    <th className={tableHeaderCellClassName}>Item</th>
                    <th className={tableHeaderCellClassName}>Qty</th>
                    <th className={tableHeaderCellClassName}>Unit</th>
                    <th className={tableHeaderCellClassName}>Weight each</th>
                    <th className={tableHeaderCellClassName}>Line weight</th>
                    <th className={tableHeaderCellClassName}></th>
                  </tr>
                </thead>
                <tbody className={tableBodyClassName}>
                  {lines.map((line) => {
                    const qty = Number(line.quantity) || 0;
                    const each = parseEditorWeight(line.weightEach) ?? 0;
                    return (
                      <tr key={line.key}>
                        <td className={tableCellClassName}>
                          <span className="font-medium text-slate-900">
                            {line.itemCode}
                          </span>
                          <span className="ml-2 text-slate-500">
                            {line.description}
                          </span>
                        </td>
                        <td className={tableCellClassName}>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={line.quantity}
                            onChange={(event) =>
                              updateWalkInLine(line.key, "quantity", event.target.value)
                            }
                            className={`w-20 ${inlineTableInputClass}`}
                          />
                        </td>
                        <td className={`${tableCellClassName} text-slate-600`}>{line.unit}</td>
                        <td className={tableCellClassName}>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={line.weightEach}
                            onChange={(event) =>
                              updateWalkInLine(line.key, "weightEach", event.target.value)
                            }
                            className={`w-24 ${inlineTableInputClass}`}
                          />
                        </td>
                        <td className={`${tableCellClassName} text-slate-600`}>
                          {each > 0 ? formatWeight(qty * each) : "—"}
                        </td>
                        <td className={`${tableCellClassName} text-right`}>
                          <button
                            type="button"
                            onClick={() => removeLine(line.key)}
                            className="text-xs font-medium text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </SectionCard>
      ) : null}

      {ticketType === "JOB" && fulfillmentMethod === "PICKUP" ? (
        <SectionCard
          title="Pickup & payment"
          description="How the customer is paying and who is picking up."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Payment method
              </label>
              <select
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(
                    event.target.value as "PAY_NOW" | "ON_ACCOUNT" | "",
                  )
                }
                className={inputClass}
              >
                <option value="">Not specified</option>
                <option value="PAY_NOW">Pay now</option>
                <option value="ON_ACCOUNT">Charge to account</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Picked up by (optional)
              </label>
              <input
                value={pickedUpBy}
                onChange={(event) => setPickedUpBy(event.target.value)}
                placeholder="Name on pickup"
                className={inputClass}
              />
            </div>
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={paymentReceived}
              onChange={(event) => setPaymentReceived(event.target.checked)}
            />
            Payment received
          </label>
        </SectionCard>
      ) : null}

      {ticketType === "WALK_IN" ? (
        <>
          <SectionCard title="Summary">
            <p className="text-xs text-slate-600">
              {selectedLineCount} line(s) selected
              {totalWeight > 0
                ? ` · ${formatWeight(totalWeight)} on this load`
                : ""}
              {deliveryDate ? ` · scheduled for ${deliveryDate}` : ""}
            </p>
          </SectionCard>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          ) : null}

          {actionButtons}
        </>
      ) : null}
    </div>
  );
}
