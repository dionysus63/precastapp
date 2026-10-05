"use client";

import { localTodayInput } from "@/lib/date-only";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  createDeliveryTicket,
  listStockProductsForTicket,
  updateDeliveryTicket,
  type DeliveryTicketLineInput,
  type SaveDeliveryTicketInput,
} from "@/app/delivery-tickets/actions";
import { getQuoteFulfillmentWithOpenLoads } from "@/app/operations/actions";
import { BackButton } from "@/components/dashboard/back-button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useUnsavedChangesWarning } from "@/lib/hooks/use-unsaved-changes-warning";
import type { QuoteLineFulfillment } from "@/lib/delivery-fulfillment";
import { buildDrainRingDiameterGroups } from "@/components/delivery-tickets/drain-ring-matrix-utils";
import { collapseCastingTicketLines } from "@/lib/casting-ticket-lines";
import { navigateAfterAction } from "@/lib/reload-after-action";
import { describeActionFailure } from "@/lib/action-result";
import {
  computeOverQuoteEntries,
  computeWalkInSummary,
  fulfillmentMetaForEditorLine,
  generateLineKey,
  getEffectiveWeightEach,
  initialFleetSelect,
  initialQuoteId,
  isCompositeEditorKey,
  parseEditorWeight,
  productPriceFor,
  resolveFleetValue,
  stripQuoteDerivedLines,
} from "@/components/delivery-tickets/delivery-ticket-editor/editor-utils";
import { ExtraItemsCard } from "@/components/delivery-tickets/delivery-ticket-editor/extra-items-card";
import {
  EditorActionButtons,
  TicketTypeToggle,
} from "@/components/delivery-tickets/delivery-ticket-editor/header-controls";
import { JobPickupPaymentCard } from "@/components/delivery-tickets/delivery-ticket-editor/job-pickup-payment-card";
import { JobTicketHeader } from "@/components/delivery-tickets/delivery-ticket-editor/job-ticket-header";
import { LeaveConfirmDialog } from "@/components/delivery-tickets/delivery-ticket-editor/leave-confirm-dialog";
import { PickupPricingCard } from "@/components/delivery-tickets/delivery-ticket-editor/pickup-pricing-card";
import { QuoteLinesTable } from "@/components/delivery-tickets/delivery-ticket-editor/quote-lines-table";
import type {
  EditorLine,
  JobOption,
  ProductOption,
} from "@/components/delivery-tickets/delivery-ticket-editor/types";
import { useQuoteLineEditing } from "@/components/delivery-tickets/delivery-ticket-editor/use-quote-line-editing";
import { useStickyRegionHeight } from "@/components/delivery-tickets/delivery-ticket-editor/use-sticky-region-height";
import { useStructureSplit } from "@/components/delivery-tickets/delivery-ticket-editor/use-structure-split";
import { useWalkInProductFilter } from "@/components/delivery-tickets/delivery-ticket-editor/use-walk-in-product-filter";
import { WalkInProductPicker } from "@/components/delivery-tickets/delivery-ticket-editor/walk-in-product-picker";
import { WalkInTicketHeader } from "@/components/delivery-tickets/delivery-ticket-editor/walk-in-ticket-header";
import { WalkInTicketLinesCard } from "@/components/delivery-tickets/delivery-ticket-editor/walk-in-ticket-lines-card";

export type DeliveryTicketEditorProps = {
  mode: "create" | "edit";
  ticketId?: string;
  // ISO updatedAt of the ticket as loaded for editing; sent back with the
  // save so the server can reject stale writes (optimistic concurrency).
  expectedUpdatedAt?: string;
  jobs: JobOption[];
  products?: ProductOption[];
  /** All price lists for the walk-in selector (default list first). */
  priceListOptions?: { id: string; name: string; isDefault: boolean }[];
  /** Product groups/sub-groups (Settings → Product Groups) for the picker. */
  productGroups?: { id: string; name: string; parentId: string | null }[];
  /** Default sales tax %, for the walk-in totals (matches invoicing). */
  defaultTaxRatePercent?: number;
  /** Where cancel / save-draft / preview-back return to — the page that
   * opened the editor (key is the preview page's `from` param). */
  returnTo?: { key: string; href: string };
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

export function DeliveryTicketEditor({
  mode,
  ticketId,
  expectedUpdatedAt,
  jobs,
  products: initialProducts = [],
  priceListOptions = [],
  productGroups = [],
  defaultTaxRatePercent = 0,
  fleetOptions,
  defaultValues,
  backHref,
  backLabel,
  returnTo = { key: "walk-ins", href: "/walk-ins" },
}: DeliveryTicketEditorProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Catalog + active price list: walk-ins can switch lists, which re-fetches
  // product prices and smart-reprices the lines already on the ticket.
  const [products, setProducts] = useState<ProductOption[]>(initialProducts);
  const [priceListId, setPriceListId] = useState<string | null>(
    defaultValues?.priceListId ??
      priceListOptions.find((option) => option.isDefault)?.id ??
      priceListOptions[0]?.id ??
      null,
  );
  const [priceListLoading, setPriceListLoading] = useState(false);
  // Bumped per price-list fetch so a stale response never applies.
  const priceListRequestRef = useRef(0);
  const [isDirty, setIsDirty] = useState(false);
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
  >(
    defaultValues?.paymentMethod ??
      // New walk-ins/pickups default to on-account; saved tickets keep
      // whatever was chosen (including "not specified").
      (mode === "create" &&
      (defaultValues?.ticketType === "WALK_IN" ||
        defaultValues?.fulfillmentMethod === "PICKUP")
        ? "ON_ACCOUNT"
        : ""),
  );
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
  // Per-line weight inputs are hidden by default to keep the ticket panel
  // tight; the total weight always shows at the bottom.
  const [showLineWeights, setShowLineWeights] = useState(false);
  // JOB tickets: product search for items added outside the quote.
  const [extraSearch, setExtraSearch] = useState("");
  const [jobId, setJobId] = useState(defaultValues?.jobId ?? "");
  const [searchedJob, setSearchedJob] = useState<JobOption | null>(null);
  const [quoteId, setQuoteId] = useState(() =>
    initialQuoteId(defaultValues?.jobId ?? "", defaultValues?.quoteId, jobs),
  );
  // Latest selected quote, for async refreshes that finish after a switch.
  const quoteIdRef = useRef(quoteId);
  useEffect(() => {
    quoteIdRef.current = quoteId;
  }, [quoteId]);
  const [deliveryDate, setDeliveryDate] = useState(
    defaultValues?.deliveryDate ?? localTodayInput(),
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
      // A walk-in has no job: drop the job, quote and every quote-derived
      // line selection so none of it can be saved on the walk-in.
      setJobId("");
      setSearchedJob(null);
      setQuoteId("");
      const stripped = stripQuoteDerivedLines(lines, selectedLineIds);
      setLines(stripped.lines);
      setSelectedLineIds(stripped.selectedLineIds);
      setExpandedCastingIds(new Set());
      split.setSplitFormStructureId(null);
      // Walk-ins default to on-account unless a payment was already picked.
      setPaymentMethod((current) => current || "ON_ACCOUNT");
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

  // Measures the sticky header so dependent sticky elements (the JOB quote
  // table header, the walk-in "On this ticket" panel) pin just below it.
  const { stickyRegionRef, stickyRegionHeight } = useStickyRegionHeight(
    ticketType,
    quote,
  );

  useEffect(() => {
    if (ticketType !== "JOB" || !quoteId) {
      return;
    }
    // Switching quotes quickly: only the latest request may apply.
    let cancelled = false;
    void getQuoteFulfillmentWithOpenLoads(quoteId, ticketId).then((result) => {
      if (cancelled) {
        return;
      }
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
    }).catch((caught: unknown) => {
      if (cancelled) {
        return;
      }
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load the quote's lines.",
      );
    });
    return () => {
      cancelled = true;
    };
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

  const isPickup = ticketType === "WALK_IN" || fulfillmentMethod === "PICKUP";

  // Quote-line selection handlers (standard rows, drain rings, ADS pipe,
  // casting pieces, split-structure pieces).
  const editing = useQuoteLineEditing({
    setLines,
    setSelectedLineIds,
    linesByKey,
    getAvailableQty,
    isPickup,
    markDirty,
  });

  // Casting rows pick whole sets by default; this opt-in reveals per-piece
  // counts for partial loads (auto-open when counts are already uneven).
  const [expandedCastingIds, setExpandedCastingIds] = useState<Set<string>>(
    new Set(),
  );

  // --- Split-structure pieces ---------------------------------------------

  function refreshFulfillment() {
    if (ticketType === "JOB" && quoteId) {
      const requestedQuoteId = quoteId;
      getQuoteFulfillmentWithOpenLoads(requestedQuoteId, ticketId)
        .then((result) => {
          // The user may have picked another quote while this was in flight.
          if (quoteIdRef.current !== requestedQuoteId) {
            return;
          }
          setFulfillment(result.fulfillment);
          setOnOpenLoads(result.onOpenLoads);
        })
        .catch((caught) => {
          if (quoteIdRef.current === requestedQuoteId) {
            setError(
              caught instanceof Error
                ? caught.message
                : "Could not reload the quote's lines.",
            );
          }
        });
    }
  }

  const split = useStructureSplit(refreshFulfillment);

  // --- Walk-in product picker ---------------------------------------------

  const walkInFilter = useWalkInProductFilter(products, productGroups);

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
          // Walk-ins are always pickups: bill the yard price when one exists.
          unitPrice: (() => {
            const price = productPriceFor(product, true);
            return price != null ? price.toFixed(2) : "";
          })(),
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

  /** Switch price lists: re-fetch the catalog, then smart-reprice — lines
   * still at the OLD list's catalog price follow the new list; hand-entered
   * prices are kept (they show a "custom" tag in the ticket panel). */
  function handlePriceListChange(nextId: string) {
    if (!nextId || nextId === priceListId) {
      return;
    }
    const previousProducts = products;
    // Fetch first, then switch list + prices together; a newer pick
    // supersedes this one, so only the latest response applies.
    const requestId = ++priceListRequestRef.current;
    setPriceListLoading(true);
    void listStockProductsForTicket(nextId)
      .then((next) => {
        if (requestId !== priceListRequestRef.current) {
          return;
        }
        setPriceListId(nextId);
        markDirty();
        setError(null);
        setProducts(next);
        const oldById = new Map(previousProducts.map((p) => [p.id, p]));
        const nextById = new Map(next.map((p) => [p.id, p]));
        setLines((current) =>
          current.map((line) => {
            if (line.quoteLineItemId != null || !line.productId) {
              return line;
            }
            const nextProduct = nextById.get(line.productId);
            if (!nextProduct) {
              return line;
            }
            const nextPrice = productPriceFor(nextProduct, true);
            const oldProduct = oldById.get(line.productId);
            const oldCatalog = oldProduct
              ? productPriceFor(oldProduct, true)
              : null;
            const entered = Number(line.unitPrice ?? "");
            const untouched =
              !line.unitPrice?.trim() ||
              (oldCatalog != null &&
                Number.isFinite(entered) &&
                Math.abs(entered - oldCatalog) < 0.005);
            if (!untouched) {
              return line;
            }
            return {
              ...line,
              unitPrice: nextPrice != null ? nextPrice.toFixed(2) : "",
            };
          }),
        );
      })
      .catch((caught: unknown) => {
        if (requestId !== priceListRequestRef.current) {
          return;
        }
        // The old list and its prices stay in place.
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load that price list's prices.",
        );
      })
      .finally(() => {
        if (requestId === priceListRequestRef.current) {
          setPriceListLoading(false);
        }
      });
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
    const price = productPriceFor(product, isPickup);
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
        unitPrice: price != null ? price.toFixed(2) : "",
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
      // Walk-ins bill from the list picked on screen; invoicing resolves any
      // remaining lookups against the same list. Job tickets keep whatever
      // the ticket already had.
      priceListId: isWalkIn
        ? priceListId
        : (defaultValues?.priceListId ?? null),
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
      const overages = computeOverQuoteEntries(
        payload.lines,
        fulfillmentById,
        getAvailableQty,
      );
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
      let result: Awaited<ReturnType<typeof createDeliveryTicket>>;
      try {
        result =
          mode === "edit" && ticketId
            ? await updateDeliveryTicket(ticketId, payload)
            : await createDeliveryTicket(payload);
      } catch (caught) {
        // Thrown action errors / network failures (including a page left open
        // across a server update): show them instead of failing silently;
        // the transition ends so the buttons re-enable.
        setError(
          describeActionFailure(caught, "Could not save the delivery ticket."),
        );
        return;
      }
      if ("error" in result && result.error) {
        setError(result.error);
      } else if ("success" in result && result.success) {
        const href =
          destination === "preview"
            ? `/delivery-tickets/${result.ticketId}/preview?from=${returnTo.key}`
            : destination === "walkIns"
              ? returnTo.href
              : `/delivery-tickets/${result.ticketId}`;
        navigateAfterAction(href);
      }
    });
  }

  const selectedLineCount = lines.filter((line) =>
    selectedLineIds.has(line.key),
  ).length;
  // Walk-in money summary for the sticky bar and the lines-table footer.
  const {
    walkInPieceCount,
    walkInSubtotal,
    walkInMissingPriceCount,
    walkInMoney,
  } = computeWalkInSummary(
    lines,
    selectedLineIds,
    ticketType === "WALK_IN",
    defaultTaxRatePercent,
  );
  const cancelHref =
    mode === "edit" && ticketId
      ? `/delivery-tickets/${ticketId}`
      : ticketType === "WALK_IN"
        ? returnTo.href
        : "/delivery-tickets";
  const ticketTypeButtons = (
    <TicketTypeToggle
      ticketType={ticketType}
      onChange={handleTicketTypeChange}
    />
  );
  const actionButtons = (
    <EditorActionButtons
      ticketType={ticketType}
      isPickup={isPickup}
      pending={pending}
      cancelHref={cancelHref}
      onCancelClick={guardLeave}
      onSaveDraft={() =>
        submit("DRAFT", ticketType === "WALK_IN" ? "walkIns" : "detail")
      }
      onSaveAndPreview={() => submit("DRAFT", "preview")}
      onSchedule={() => submit("SCHEDULED")}
    />
  );

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
        <LeaveConfirmDialog
          pending={pending}
          onKeepEditing={() => setLeaveTarget(null)}
          onDiscard={() => {
            const target = leaveTarget;
            setIsDirty(false);
            setLeaveTarget(null);
            router.push(target);
          }}
          onSave={() => {
            setLeaveTarget(null);
            void submit(
              mode === "edit"
                ? (defaultValues?.status ?? "DRAFT")
                : "DRAFT",
              ticketType === "WALK_IN" ? "walkIns" : "detail",
            );
          }}
        />
      ) : null}

      {ticketType === "WALK_IN" ? (
        <WalkInTicketHeader
          stickyRef={stickyRegionRef}
          ticketTypeButtons={ticketTypeButtons}
          actionButtons={actionButtons}
          walkInPieceCount={walkInPieceCount}
          walkInSubtotal={walkInSubtotal}
          walkInMissingPriceCount={walkInMissingPriceCount}
          totalWeight={totalWeight}
          walkInOneOff={walkInOneOff}
          setWalkInOneOff={setWalkInOneOff}
          walkInCustomer={walkInCustomer}
          setWalkInCustomer={setWalkInCustomer}
          walkInCustomerId={walkInCustomerId}
          setWalkInCustomerId={setWalkInCustomerId}
          walkInReference={walkInReference}
          setWalkInReference={setWalkInReference}
          deliveryDate={deliveryDate}
          setDeliveryDate={setDeliveryDate}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          pickedUpBy={pickedUpBy}
          setPickedUpBy={setPickedUpBy}
          paymentReceived={paymentReceived}
          setPaymentReceived={setPaymentReceived}
          priceListOptions={priceListOptions}
          priceListId={priceListId}
          priceListLoading={priceListLoading}
          onPriceListChange={handlePriceListChange}
          markDirty={markDirty}
        />
      ) : null}

      {ticketType === "WALK_IN" && error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}

      {ticketType === "JOB" ? (
        <JobTicketHeader
          stickyRef={stickyRegionRef}
          ticketTypeButtons={ticketTypeButtons}
          actionButtons={actionButtons}
          selectedLineCount={selectedLineCount}
          totalWeight={totalWeight}
          isPickup={isPickup}
          loadCapacityLabel={loadCapacityLabel}
          selectedJob={selectedJob}
          onJobChange={handleJobChange}
          quoteId={quoteId}
          onQuoteChange={handleQuoteChange}
          hasQuote={Boolean(quote)}
          fulfillmentMethod={fulfillmentMethod}
          setFulfillmentMethod={setFulfillmentMethod}
          deliveryDate={deliveryDate}
          setDeliveryDate={setDeliveryDate}
          drivers={drivers}
          driver={driver}
          setDriver={setDriver}
          driverOther={driverOther}
          setDriverOther={setDriverOther}
          trailers={trailers}
          trailer={trailer}
          setTrailer={setTrailer}
          trailerOther={trailerOther}
          setTrailerOther={setTrailerOther}
          error={error}
          markDirty={markDirty}
        />
      ) : null}

      {ticketType === "JOB" && quote ? (
        <QuoteLinesTable
          fulfillment={fulfillment}
          isPickup={isPickup}
          drainRingDiameterGroups={drainRingDiameterGroups}
          editing={editing}
          split={split}
          getAvailableQty={getAvailableQty}
          getOnOpenLoadsQty={getOnOpenLoadsQty}
          linesByKey={linesByKey}
          selectedLineIds={selectedLineIds}
          setLines={setLines}
          expandedCastingIds={expandedCastingIds}
          setExpandedCastingIds={setExpandedCastingIds}
          totalWeight={totalWeight}
          loadCapacityLabel={loadCapacityLabel}
          stickyRegionHeight={stickyRegionHeight}
        />
      ) : null}

      {ticketType === "JOB" && quote && isPickup ? (
        <PickupPricingCard
          lines={lines}
          selectedLineIds={selectedLineIds}
          fulfillmentById={fulfillmentById}
          onApplyPickupListPrices={applyPickupListPrices}
          updateLine={updateWalkInLine}
          markDirty={markDirty}
        />
      ) : null}

      {ticketType === "JOB" && quote ? (
        <ExtraItemsCard
          isPickup={isPickup}
          extraSearch={extraSearch}
          onExtraSearchChange={setExtraSearch}
          extraResults={extraResults}
          extraLines={extraLines}
          onAddProduct={addExtraProduct}
          onAddCustomLine={addExtraCustomLine}
          updateLine={updateWalkInLine}
          removeLine={removeLine}
        />
      ) : null}

      {ticketType === "WALK_IN" ? (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          <WalkInProductPicker
            products={products}
            filter={walkInFilter}
            walkInQtyByProductId={walkInQtyByProductId}
            onAddProduct={addWalkInLine}
          />

          <WalkInTicketLinesCard
            stickyRegionHeight={stickyRegionHeight}
            lines={lines}
            products={products}
            showLineWeights={showLineWeights}
            onToggleLineWeights={() => setShowLineWeights((current) => !current)}
            updateLine={updateWalkInLine}
            removeLine={removeLine}
            markDirty={markDirty}
            walkInSubtotal={walkInSubtotal}
            walkInMoney={walkInMoney}
            walkInMissingPriceCount={walkInMissingPriceCount}
            defaultTaxRatePercent={defaultTaxRatePercent}
            totalWeight={totalWeight}
          />
        </div>
      ) : null}

      {ticketType === "JOB" && fulfillmentMethod === "PICKUP" ? (
        <JobPickupPaymentCard
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          pickedUpBy={pickedUpBy}
          setPickedUpBy={setPickedUpBy}
          paymentReceived={paymentReceived}
          setPaymentReceived={setPaymentReceived}
        />
      ) : null}

    </div>
  );
}
