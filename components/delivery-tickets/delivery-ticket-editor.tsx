"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  createDeliveryTicket,
  updateDeliveryTicket,
  type DeliveryTicketLineInput,
  type SaveDeliveryTicketInput,
} from "@/app/delivery-tickets/actions";
import { getQuoteFulfillmentForTicket } from "@/app/operations/actions";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import type { QuoteLineFulfillment } from "@/lib/delivery-fulfillment";
import { formatDrainRingStyleLabel } from "@/lib/drain-ring-utils";

type JobOption = {
  id: string;
  jobNumber: string;
  projectName: string;
  customerName: string;
  quotes: { id: string; quoteNumber: string }[];
};

type ProductOption = {
  id: string;
  productCode: string;
  name: string;
  unit: string;
  weight: number | null;
};

type EditorLine = {
  key: string;
  quoteLineItemId: string | null;
  productId: string | null;
  jobStructureId: string | null;
  lineType: SaveDeliveryTicketInput["lines"][number]["lineType"];
  itemCode: string;
  description: string;
  quantity: string;
  unit: string;
  weightEach: string;
  yardLocation: string;
};

export type DeliveryTicketEditorProps = {
  mode: "create" | "edit";
  ticketId?: string;
  jobs: JobOption[];
  products?: ProductOption[];
  fleetOptions?: {
    trucks: string[];
    drivers: string[];
    trailers: string[];
    truckCapacityLabel: string;
  };
  defaultValues?: Partial<
    Omit<SaveDeliveryTicketInput, "lines">
  > & {
    lines?: EditorLine[];
  };
};

const inputClass =
  "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm";

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
  return `${value.toLocaleString()} lb`;
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
  return fulfillmentLine.weightEach;
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

function mapFulfillmentToLine(meta: QuoteLineFulfillment): EditorLine {
  return {
    key: meta.quoteLineItemId,
    quoteLineItemId: meta.quoteLineItemId,
    productId: meta.productId,
    jobStructureId: meta.jobStructureId,
    lineType: meta.lineType as EditorLine["lineType"],
    itemCode: meta.itemCode,
    description: meta.description ?? "",
    quantity: meta.eligible && meta.remainingQty > 0 ? String(meta.remainingQty) : "0",
    unit: meta.unit,
    weightEach: meta.weightEach != null ? String(meta.weightEach) : "",
    yardLocation: "",
  };
}

function isDrainRingEditorKey(key: string): boolean {
  return key.includes("::");
}

function fulfillmentMetaForEditorLine(
  line: EditorLine,
  fulfillmentById: Map<string, QuoteLineFulfillment>,
): QuoteLineFulfillment | undefined {
  if (isDrainRingEditorKey(line.key)) {
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
  jobs,
  products = [],
  fleetOptions,
  defaultValues,
}: DeliveryTicketEditorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ticketType, setTicketType] = useState<"JOB" | "WALK_IN">(
    defaultValues?.ticketType ?? "JOB",
  );
  const [jobId, setJobId] = useState(defaultValues?.jobId ?? "");
  const [quoteId, setQuoteId] = useState(() =>
    initialQuoteId(defaultValues?.jobId ?? "", defaultValues?.quoteId, jobs),
  );
  const [deliveryDate, setDeliveryDate] = useState(
    defaultValues?.deliveryDate ?? todayDateInputValue(),
  );
  const [deliveryTime, setDeliveryTime] = useState(defaultValues?.deliveryTime ?? "");
  const [fulfillment, setFulfillment] = useState<QuoteLineFulfillment[]>([]);
  const [lines, setLines] = useState<EditorLine[]>(defaultValues?.lines ?? []);
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(
    () => new Set(defaultValues?.lines?.map((l) => l.key) ?? []),
  );
  const trucks = fleetOptions?.trucks ?? [];
  const drivers = fleetOptions?.drivers ?? [];
  const trailers = fleetOptions?.trailers ?? [];
  const truckCapacityLabel = fleetOptions?.truckCapacityLabel ?? "80,000 lb";

  const initialTruck = initialFleetSelect(defaultValues?.truck, trucks);
  const initialDriver = initialFleetSelect(defaultValues?.driver, drivers);
  const initialTrailer = initialFleetSelect(defaultValues?.trailer, trailers);

  const [truck, setTruck] = useState(initialTruck.selected);
  const [driver, setDriver] = useState(initialDriver.selected);
  const [trailer, setTrailer] = useState(initialTrailer.selected);
  const [truckOther, setTruckOther] = useState(initialTruck.other);
  const [driverOther, setDriverOther] = useState(initialDriver.other);
  const [trailerOther, setTrailerOther] = useState(initialTrailer.other);

  function resolveFleetValue(
    selected: string,
    other: string,
    options: string[],
  ) {
    if (selected === "__other__") {
      return other.trim() || null;
    }
    return selected.trim() || null;
  }

  useEffect(() => {
    if (defaultValues?.lines?.length) {
      setLines(defaultValues.lines);
      setSelectedLineIds(new Set(defaultValues.lines.map((l) => l.key)));
    }
  }, [defaultValues?.lines]);

  useEffect(() => {
    if (defaultValues?.deliveryDate) {
      setDeliveryDate(defaultValues.deliveryDate);
    }
    if (defaultValues?.deliveryTime != null) {
      setDeliveryTime(defaultValues.deliveryTime);
    }
  }, [defaultValues?.deliveryDate, defaultValues?.deliveryTime]);

  function handleJobChange(nextJobId: string) {
    setJobId(nextJobId);
    const nextJob = jobs.find((job) => job.id === nextJobId);
    setQuoteId(nextJob?.quotes[0]?.id ?? "");
    setLines([]);
    setSelectedLineIds(new Set());
    setError(null);
  }

  function handleQuoteChange(nextQuoteId: string) {
    if (nextQuoteId === quoteId) {
      return;
    }
    setQuoteId(nextQuoteId);
    setLines([]);
    setSelectedLineIds(new Set());
    setError(null);
  }

  const selectedJob = jobs.find((job) => job.id === jobId);
  const quote =
    selectedJob?.quotes.find((entry) => entry.id === quoteId) ??
    selectedJob?.quotes[0];

  useEffect(() => {
    if (ticketType !== "JOB" || !quoteId) {
      setFulfillment([]);
      return;
    }
    void getQuoteFulfillmentForTicket(quoteId, ticketId).then(setFulfillment);
  }, [ticketType, quoteId, ticketId]);

  const fulfillmentById = useMemo(
    () => new Map(fulfillment.map((line) => [line.quoteLineItemId, line])),
    [fulfillment],
  );

  const linesByKey = useMemo(
    () => new Map(lines.map((line) => [line.key, line])),
    [lines],
  );

  useEffect(() => {
    if (fulfillment.length === 0) {
      return;
    }

    setLines((current) => {
      let changed = false;
      const next = current.map((line) => {
        if (isDrainRingEditorKey(line.key)) {
          return line;
        }
        if (!selectedLineIds.has(line.key)) {
          return line;
        }
        const meta = fulfillmentById.get(line.key);
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
  }, [fulfillment, fulfillmentById, selectedLineIds]);

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
    if (meta.isDrainRing) {
      return;
    }
    if (checked) {
      setSelectedLineIds((current) => new Set([...current, meta.quoteLineItemId]));
      setLines((current) => {
        const existing = current.find((line) => line.key === meta.quoteLineItemId);
        if (existing) {
          return current.map((line) =>
            line.key === meta.quoteLineItemId
              ? mergeFulfillmentIntoLine(line, meta)
              : line,
          );
        }
        return [...current, mapFulfillmentToLine(meta)];
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

  function drainRingLineKey(quoteLineItemId: string, productId: string) {
    return `${quoteLineItemId}::${productId}`;
  }

  function getDrainRingCount(quoteLineItemId: string, productId: string): string {
    const key = drainRingLineKey(quoteLineItemId, productId);
    return linesByKey.get(key)?.quantity ?? "";
  }

  function getDrainRingFeetUsed(meta: QuoteLineFulfillment): number {
    return meta.drainRingOptions.reduce((sum, option) => {
      const count = Number(getDrainRingCount(meta.quoteLineItemId, option.productId)) || 0;
      return sum + count * option.heightFeet;
    }, 0);
  }

  function setDrainRingCount(
    meta: QuoteLineFulfillment,
    option: QuoteLineFulfillment["drainRingOptions"][number],
    value: string,
  ) {
    const key = drainRingLineKey(meta.quoteLineItemId, option.productId);
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

  function buildPayload(status: SaveDeliveryTicketInput["status"]): SaveDeliveryTicketInput {
    const activeLines = lines.filter((line) => selectedLineIds.has(line.key));
    const linePayload: DeliveryTicketLineInput[] = activeLines
      .filter((line) => Number(line.quantity) > 0)
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
          lineType: line.lineType,
          itemCode: line.itemCode,
          description: line.description || null,
          quantity: Number(line.quantity),
          unit: line.unit,
          weightEach,
          yardLocation: line.yardLocation || null,
        };
      });

    return {
      ticketType,
      status,
      jobId: ticketType === "JOB" ? jobId || null : null,
      quoteId: ticketType === "JOB" ? quote?.id ?? null : null,
      quoteNumber: ticketType === "JOB" ? quote?.quoteNumber ?? null : null,
      jobNumber: selectedJob?.jobNumber ?? null,
      customerName: selectedJob?.customerName ?? defaultValues?.customerName ?? "",
      projectName: selectedJob?.projectName ?? defaultValues?.projectName ?? "",
      deliveryAddress: defaultValues?.deliveryAddress ?? null,
      deliveryDate: deliveryDate.trim() || null,
      deliveryTime: deliveryTime.trim() || null,
      truck: resolveFleetValue(truck, truckOther, trucks),
      driver: resolveFleetValue(driver, driverOther, drivers),
      trailer: resolveFleetValue(trailer, trailerOther, trailers),
      lines: linePayload,
    };
  }

  function submit(status: SaveDeliveryTicketInput["status"]) {
    setError(null);
    startTransition(async () => {
      const payload = buildPayload(status);
      const result =
        mode === "edit" && ticketId
          ? await updateDeliveryTicket(ticketId, payload)
          : await createDeliveryTicket(payload);
      if (result?.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Ticket type">
        <div className="flex gap-4 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={ticketType === "JOB"}
              onChange={() => setTicketType("JOB")}
            />
            Job ticket
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={ticketType === "WALK_IN"}
              onChange={() => setTicketType("WALK_IN")}
            />
            Walk-in
          </label>
        </div>
      </SectionCard>

      <SectionCard title="Schedule">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="deliveryDate" className="block text-xs font-medium text-slate-700">
              Delivery date
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
            <label htmlFor="deliveryTime" className="block text-xs font-medium text-slate-700">
              Delivery time
            </label>
            <input
              id="deliveryTime"
              type="time"
              value={deliveryTime}
              onChange={(event) => setDeliveryTime(event.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Required when scheduling a delivery.
        </p>
      </SectionCard>

      {ticketType === "JOB" ? (
        <SectionCard title="Job and quote">
          <select
            value={jobId}
            onChange={(event) => handleJobChange(event.target.value)}
            className={inputClass}
          >
            <option value="">Select job…</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.jobNumber} — {job.projectName}
              </option>
            ))}
          </select>
          {selectedJob ? (
            selectedJob.quotes.length > 0 ? (
              <div className="mt-3">
                <label
                  htmlFor="quoteId"
                  className="block text-xs font-medium text-slate-700"
                >
                  Won quote
                </label>
                <select
                  id="quoteId"
                  value={quoteId}
                  onChange={(event) => handleQuoteChange(event.target.value)}
                  className={inputClass}
                >
                  {selectedJob.quotes.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.quoteNumber}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">No won quote on this job.</p>
            )
          ) : null}
        </SectionCard>
      ) : null}

      {ticketType === "JOB" && quote ? (
        <SectionCard
          title="Quote lines for this load"
          description="Select items for this delivery and confirm quantities and weights."
          noPadding
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Pick</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Remaining</th>
                  <th className="px-3 py-2">Qty on load</th>
                  <th className="px-3 py-2">Weight each</th>
                  <th className="px-3 py-2">Line weight</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fulfillment.map((line) => {
                  if (line.isDrainRing) {
                    const feetUsed = getDrainRingFeetUsed(line);
                    const feetRemainingAfter =
                      Math.round((line.remainingQty - feetUsed) * 100) / 100;
                    const poolHeight = line.poolHeightFeet ?? 0;
                    const poolsRemaining =
                      poolHeight > 0
                        ? Math.round((feetRemainingAfter / poolHeight) * 100) / 100
                        : null;
                    const overLimit = feetUsed > line.remainingQty + 0.001;
                    return (
                      <tr key={line.quoteLineItemId} className="bg-slate-50/40">
                        <td className="px-3 py-3 align-top" colSpan={7}>
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <div>
                              <span className="font-medium text-slate-900">
                                {line.displayName}
                              </span>
                              <span className="ml-2 text-slate-500">
                                {line.itemCode}
                              </span>
                              {line.ringDiameterFeet ? (
                                <span className="ml-2 text-slate-500">
                                  {line.ringDiameterFeet}' diameter ·{" "}
                                  {formatDrainRingStyleLabel(line.drainRingStyle)}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-slate-600">
                              {line.remainingQty} of {line.quotedQty} LF remaining ·{" "}
                              {line.shippedQty} shipped
                            </div>
                          </div>
                          {line.description ? (
                            <div className="mt-0.5 text-slate-500">
                              {line.description}
                            </div>
                          ) : null}

                          {line.drainRingOptions.length === 0 ? (
                            <p className="mt-2 text-slate-500">
                              {line.eligibilityReason ??
                                "No ring SKUs available for this diameter."}
                            </p>
                          ) : (
                            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {line.drainRingOptions.map((option) => (
                                <div
                                  key={option.productId}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-slate-800">
                                      {option.heightFeet}' ring
                                    </span>
                                    <span className="text-slate-400">
                                      {option.productCode}
                                    </span>
                                  </div>
                                  <div className="mt-1 text-slate-500">
                                    {option.currentStock != null
                                      ? `${option.currentStock} in stock`
                                      : "Not tracked"}
                                  </div>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={getDrainRingCount(
                                      line.quoteLineItemId,
                                      option.productId,
                                    )}
                                    placeholder="0"
                                    className="mt-2 w-full rounded border border-slate-200 px-2 py-1"
                                    onChange={(event) =>
                                      setDrainRingCount(
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

                          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-slate-600">
                            <span>
                              On load:{" "}
                              <span className="font-semibold text-slate-900">
                                {feetUsed} LF
                              </span>
                            </span>
                            <span
                              className={
                                overLimit
                                  ? "font-semibold text-red-600"
                                  : "text-slate-600"
                              }
                            >
                              Remaining after load: {feetRemainingAfter} LF
                              {poolsRemaining != null
                                ? ` (~${poolsRemaining} pools)`
                                : ""}
                            </span>
                            {overLimit ? (
                              <span className="font-semibold text-red-600">
                                Exceeds remaining feet
                              </span>
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
                    <tr key={line.quoteLineItemId}>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!line.eligible}
                          onChange={(event) => toggleLine(line, event.target.checked)}
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="font-medium text-slate-900">{line.displayName}</div>
                        <div className="mt-0.5 text-slate-500">{line.itemCode}</div>
                        {line.description ? (
                          <div className="mt-1 text-slate-500">{line.description}</div>
                        ) : null}
                        <div className="mt-1">
                          <StatusBadge
                            label={formatLineTypeLabel(line.lineType)}
                            variant="neutral"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-slate-700">
                        <div>{line.remainingQty} of {line.quotedQty}</div>
                        <div className="text-slate-500">{line.shippedQty} shipped</div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        {checked && editorLine ? (
                          <input
                            type="number"
                            min="0"
                            max={line.remainingQty}
                            value={editorLine.quantity}
                            className="w-20 rounded border border-slate-200 px-2 py-1"
                            onChange={(event) =>
                              setLines((current) =>
                                current.map((row) =>
                                  row.key === line.quoteLineItemId
                                    ? { ...row, quantity: event.target.value }
                                    : row,
                                ),
                              )
                            }
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {checked && editorLine ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={weightInputValue}
                            placeholder="—"
                            className="w-24 rounded border border-slate-200 px-2 py-1"
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
                      <td className="px-3 py-2 align-top font-medium text-slate-900">
                        {checked && lineWeight > 0 ? formatWeight(lineWeight) : "—"}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-600">
                        {line.eligible ? "Ready" : (line.eligibilityReason ?? "Not ready")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50/80">
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-right font-medium text-slate-700">
                    Total load weight
                  </td>
                  <td className="px-3 py-3 font-semibold text-slate-900">
                    {totalWeight > 0 ? formatWeight(totalWeight) : "—"}
                  </td>
                  <td className="px-3 py-3 text-slate-500">
                    Capacity: {truckCapacityLabel}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </SectionCard>
      ) : null}

      {ticketType === "WALK_IN" && products.length > 0 ? (
        <SectionCard title="Walk-in products" description="Select stock products for this ticket.">
          <p className="text-xs text-slate-500">
            Walk-in line picking uses product catalog — add lines via product selection in a future pass. Use job tickets for quote-driven loads.
          </p>
        </SectionCard>
      ) : null}

      {trucks.length > 0 || drivers.length > 0 || trailers.length > 0 ? (
        <SectionCard
          title="Fleet & crew"
          description={`Capacity reference: ${truckCapacityLabel}`}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {trucks.length > 0 ? (
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Truck
                </label>
                <select
                  value={truck}
                  onChange={(event) => setTruck(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Select…</option>
                  {trucks.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  <option value="__other__">Other…</option>
                </select>
                {truck === "__other__" ? (
                  <input
                    value={truckOther}
                    onChange={(event) => setTruckOther(event.target.value)}
                    placeholder="Truck name"
                    className={`${inputClass} mt-2`}
                  />
                ) : null}
              </div>
            ) : null}
            {drivers.length > 0 ? (
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Driver
                </label>
                <select
                  value={driver}
                  onChange={(event) => setDriver(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Select…</option>
                  {drivers.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  <option value="__other__">Other…</option>
                </select>
                {driver === "__other__" ? (
                  <input
                    value={driverOther}
                    onChange={(event) => setDriverOther(event.target.value)}
                    placeholder="Driver name"
                    className={`${inputClass} mt-2`}
                  />
                ) : null}
              </div>
            ) : null}
            {trailers.length > 0 ? (
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Trailer
                </label>
                <select
                  value={trailer}
                  onChange={(event) => setTrailer(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Select…</option>
                  {trailers.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  <option value="__other__">Other…</option>
                </select>
                {trailer === "__other__" ? (
                  <input
                    value={trailerOther}
                    onChange={(event) => setTrailerOther(event.target.value)}
                    placeholder="Trailer type"
                    className={`${inputClass} mt-2`}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="Summary">
        <p className="text-xs text-slate-600">
          {selectedLineIds.size} line(s) selected
          {totalWeight > 0 ? ` · ${formatWeight(totalWeight)} on this load` : ""}
          {deliveryDate ? ` · scheduled for ${deliveryDate}` : ""}
        </p>
      </SectionCard>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Link
          href={mode === "edit" && ticketId ? `/delivery-tickets/${ticketId}` : "/delivery-tickets"}
          className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium hover:bg-slate-50"
        >
          Cancel
        </Link>
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("DRAFT")}
          className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          Save Draft
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("SCHEDULED")}
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          Schedule Delivery
        </button>
      </div>
    </div>
  );
}
