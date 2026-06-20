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
import type { QuoteLineFulfillment } from "@/lib/delivery-fulfillment";

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

function initialFleetSelect(value: string | null | undefined, options: string[]) {
  if (!value) {
    return { selected: "", other: "" };
  }
  if (options.includes(value)) {
    return { selected: value, other: "" };
  }
  return { selected: "__other__", other: value };
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
    unit: "EA",
    weightEach: "",
    yardLocation: "",
  };
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

  const selectedJob = jobs.find((job) => job.id === jobId);
  const quote = selectedJob?.quotes[0];

  useEffect(() => {
    if (ticketType !== "JOB" || !quote?.id) {
      setFulfillment([]);
      return;
    }
    void getQuoteFulfillmentForTicket(quote.id, ticketId).then(setFulfillment);
  }, [ticketType, quote?.id, ticketId]);

  const totalWeight = useMemo(() => {
    return lines
      .filter((line) => selectedLineIds.has(line.key))
      .reduce((sum, line) => {
        const qty = Number(line.quantity) || 0;
        const each = Number(line.weightEach) || 0;
        return sum + qty * each;
      }, 0);
  }, [lines, selectedLineIds]);

  function toggleLine(meta: QuoteLineFulfillment, checked: boolean) {
    if (checked) {
      setSelectedLineIds((current) => new Set([...current, meta.quoteLineItemId]));
      setLines((current) => {
        if (current.some((line) => line.key === meta.quoteLineItemId)) {
          return current;
        }
        return [...current, mapFulfillmentToLine(meta)];
      });
    } else {
      setSelectedLineIds((current) => {
        const next = new Set(current);
        next.delete(meta.quoteLineItemId);
        return next;
      });
    }
  }

  function buildPayload(status: SaveDeliveryTicketInput["status"]): SaveDeliveryTicketInput {
    const activeLines = lines.filter((line) => selectedLineIds.has(line.key));
    const linePayload: DeliveryTicketLineInput[] = activeLines
      .filter((line) => Number(line.quantity) > 0)
      .map((line) => ({
        quoteLineItemId: line.quoteLineItemId,
        productId: line.productId,
        jobStructureId: line.jobStructureId,
        lineType: line.lineType,
        itemCode: line.itemCode,
        description: line.description || null,
        quantity: Number(line.quantity),
        unit: line.unit,
        weightEach: line.weightEach ? Number(line.weightEach) : null,
        yardLocation: line.yardLocation || null,
      }));

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
      deliveryDate: defaultValues?.deliveryDate ?? null,
      deliveryTime: defaultValues?.deliveryTime ?? null,
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

      {ticketType === "JOB" ? (
        <SectionCard title="Job and quote">
          <select
            value={jobId}
            onChange={(event) => setJobId(event.target.value)}
            className={inputClass}
          >
            <option value="">Select job…</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.jobNumber} — {job.projectName}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-500">
            Won quote: {quote?.quoteNumber ?? "None"}
          </p>
        </SectionCard>
      ) : null}

      {ticketType === "JOB" && quote ? (
        <SectionCard title="Quote lines for this load" noPadding>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Pick</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Quoted</th>
                  <th className="px-3 py-2">Shipped</th>
                  <th className="px-3 py-2">Remaining</th>
                  <th className="px-3 py-2">On load</th>
                  <th className="px-3 py-2">Eligible</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fulfillment.map((line) => {
                  const editorLine = lines.find((l) => l.key === line.quoteLineItemId);
                  const checked = selectedLineIds.has(line.quoteLineItemId);
                  return (
                    <tr key={line.quoteLineItemId}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!line.eligible}
                          onChange={(event) => toggleLine(line, event.target.checked)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{line.itemCode}</div>
                        <div className="text-slate-500">{line.description}</div>
                      </td>
                      <td className="px-3 py-2">{line.quotedQty}</td>
                      <td className="px-3 py-2">{line.shippedQty}</td>
                      <td className="px-3 py-2">{line.remainingQty}</td>
                      <td className="px-3 py-2">
                        {checked && editorLine ? (
                          <input
                            type="number"
                            min="0"
                            max={line.remainingQty}
                            value={editorLine.quantity}
                            className="w-16 rounded border border-slate-200 px-1 py-0.5"
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
                      <td className="px-3 py-2">
                        {line.eligible ? "Yes" : (line.eligibilityReason ?? "No")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
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
          {totalWeight > 0 ? ` · ${totalWeight.toLocaleString()} lb est.` : ""}
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
