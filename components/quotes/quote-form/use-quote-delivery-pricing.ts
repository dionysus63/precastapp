"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  lookupShippingRate,
  lookupShippingRateAtPoint,
  type ShippingLookupResult,
} from "@/app/shipping/actions";
import type { AddressSuggestion } from "@/lib/shipping/geocode";
import {
  type EditableQuoteLineItem,
  type QuoteFormServiceOption,
  formatQuoteCurrency,
  parseQuoteNumber,
  quoteLineItemTypeLabels,
} from "@/components/quotes/quote-utils";
import {
  createLineId,
  renumberLineItems,
  type ShippingHint,
  type ShippingStatus,
} from "@/components/quotes/quote-form/quote-form-utils";

/**
 * Shipping-zone lookup for the project address plus the editable delivery
 * pricing (loads × price per load) and the auto-maintained delivery note.
 * State stays owned by the quote form; this only groups it.
 */
export function useQuoteDeliveryPricing({
  initialDeliveryNotes,
  totalWeight,
  serviceOptions,
  setLineItems,
  setProjectAddress,
}: {
  initialDeliveryNotes: string;
  totalWeight: number;
  serviceOptions: QuoteFormServiceOption[];
  setLineItems: Dispatch<SetStateAction<EditableQuoteLineItem[]>>;
  setProjectAddress: (value: string) => void;
}) {
  const [deliveryNotes, setDeliveryNotes] = useState(initialDeliveryNotes);
  const [shippingHint, setShippingHint] = useState<ShippingHint | null>(null);
  const [shippingStatus, setShippingStatus] = useState<ShippingStatus>("idle");
  const shippingLookupSeq = useRef(0);
  const lastShippingAddress = useRef("");
  const lastAutoDeliveryNotes = useRef("");
  // Editable delivery pricing: blank loads field means "auto from weight".
  const [deliveryLoadsInput, setDeliveryLoadsInput] = useState("");
  const [maxLoadLbsInput, setMaxLoadLbsInput] = useState("");
  const [pricePerLoadInput, setPricePerLoadInput] = useState("");
  const maxLoadLbsDirty = useRef(false);
  // State (not a ref): the "add vs update" button label renders from it.
  const [deliveryLineId, setDeliveryLineId] = useState<string | null>(null);

  function applyShippingResult(seq: number, result: ShippingLookupResult) {
    if (seq !== shippingLookupSeq.current) return;
    if ("error" in result) {
      setShippingHint(null);
      setShippingStatus("error");
      return;
    }
    if (!result.zone) {
      setShippingHint(null);
      setShippingStatus("outside");
      return;
    }
    setShippingHint({
      zoneName: result.zone.name,
      ratePerLoad: result.zone.ratePerLoad,
      color: result.zone.color,
      distanceMiles: result.distanceMiles,
      truckCapacityLbs: result.truckCapacityLbs,
    });
    setShippingStatus("matched");
    // Prefill the editable delivery pricing for the new zone; a new
    // address means the old per-load price and loads override are stale.
    setPricePerLoadInput(String(result.zone.ratePerLoad));
    setDeliveryLoadsInput("");
    if (!maxLoadLbsDirty.current && result.truckCapacityLbs) {
      setMaxLoadLbsInput(String(result.truckCapacityLbs));
    }
  }

  function runShippingLookup(address: string) {
    const query = address.trim();
    if (!query) {
      lastShippingAddress.current = "";
      setShippingHint(null);
      setShippingStatus("idle");
      return;
    }
    if (query === lastShippingAddress.current) {
      return;
    }
    lastShippingAddress.current = query;
    const seq = ++shippingLookupSeq.current;
    setShippingStatus("loading");
    // Like getCustomerForQuoteForm in the form: not routed through the save
    // transition so it can't flip the Save button into its pending state.
    void lookupShippingRate(query)
      .then((result) => applyShippingResult(seq, result))
      .catch(() => {
        if (seq !== shippingLookupSeq.current) return;
        setShippingHint(null);
        setShippingStatus("error");
      });
  }

  function handleAddressSuggestionSelect(suggestion: AddressSuggestion) {
    setProjectAddress(suggestion.label);
    // The suggestion carries its own coordinates, so skip the geocode that
    // would otherwise fire when focus leaves the field.
    lastShippingAddress.current = suggestion.label;
    const seq = ++shippingLookupSeq.current;
    setShippingStatus("loading");
    void lookupShippingRateAtPoint({
      lat: suggestion.latitude,
      lng: suggestion.longitude,
      label: suggestion.label,
    })
      .then((result) => applyShippingResult(seq, result))
      .catch(() => {
        if (seq !== shippingLookupSeq.current) return;
        setShippingHint(null);
        setShippingStatus("error");
      });
  }

  function handleMaxLoadLbsInputChange(value: string) {
    maxLoadLbsDirty.current = true;
    setMaxLoadLbsInput(value);
  }

  const maxLoadLbs = parseQuoteNumber(maxLoadLbsInput);
  const autoDeliveryLoads =
    maxLoadLbs > 0 && totalWeight > 0
      ? Math.max(1, Math.ceil(totalWeight / maxLoadLbs))
      : null;
  const deliveryLoads = deliveryLoadsInput.trim()
    ? Math.max(0, Math.round(parseQuoteNumber(deliveryLoadsInput)))
    : autoDeliveryLoads;
  const pricePerLoad = pricePerLoadInput.trim()
    ? parseQuoteNumber(pricePerLoadInput)
    : null;
  const deliveryTotal =
    deliveryLoads !== null && deliveryLoads > 0 && pricePerLoad !== null
      ? deliveryLoads * pricePerLoad
      : null;

  // Keep the delivery note in sync with the zone and the editable pricing
  // fields, but never overwrite text the user typed themselves.
  useEffect(() => {
    if (!shippingHint && pricePerLoad === null) return;
    const zonePart = shippingHint ? `${shippingHint.zoneName} — ` : "";
    let note: string;
    if (deliveryLoads !== null && deliveryLoads > 0 && pricePerLoad !== null) {
      const rateText = formatQuoteCurrency(pricePerLoad);
      note = `Delivery: ${zonePart}est. ${deliveryLoads} load${deliveryLoads === 1 ? "" : "s"} @ ${rateText}/load`;
    } else if (pricePerLoad !== null) {
      note = `Delivery: ${zonePart}${formatQuoteCurrency(pricePerLoad)}/load`;
    } else {
      return;
    }
    setDeliveryNotes((current) => {
      const trimmed = current.trim();
      if (trimmed && trimmed !== lastAutoDeliveryNotes.current) {
        return current;
      }
      lastAutoDeliveryNotes.current = note;
      return note;
    });
  }, [shippingHint, deliveryLoads, pricePerLoad]);

  function applyDeliveryLineItem() {
    if (deliveryLoads === null || deliveryLoads <= 0 || pricePerLoad === null) {
      return;
    }
    const serviceOption = serviceOptions.find((entry) =>
      entry.item.toLowerCase().includes("delivery"),
    );
    const lineId = deliveryLineId ?? createLineId();
    setDeliveryLineId(lineId);
    setLineItems((current) => {
      const line: EditableQuoteLineItem = {
        id: lineId,
        lineNumber: current.length + 1,
        type: serviceOption?.lineType ?? "SERVICE",
        typeLabel:
          quoteLineItemTypeLabels[serviceOption?.lineType ?? "SERVICE"],
        item: serviceOption?.item ?? "Delivery",
        description: shippingHint
          ? `Delivery — ${shippingHint.zoneName}`
          : serviceOption?.description || "Delivery",
        qty: String(deliveryLoads),
        unit: serviceOption?.unit ?? "EA",
        unitPrice: String(pricePerLoad),
        weight: "",
        yards: "",
        taxable: serviceOption?.taxable ?? false,
      };
      const existingIndex = current.findIndex((entry) => entry.id === line.id);
      if (existingIndex >= 0) {
        const next = [...current];
        next[existingIndex] = {
          ...next[existingIndex],
          description: line.description,
          qty: line.qty,
          unitPrice: line.unitPrice,
        };
        return next;
      }
      return renumberLineItems([...current, line]);
    });
  }

  return {
    deliveryNotes,
    setDeliveryNotes,
    shippingHint,
    shippingStatus,
    deliveryLoadsInput,
    setDeliveryLoadsInput,
    maxLoadLbsInput,
    handleMaxLoadLbsInputChange,
    pricePerLoadInput,
    setPricePerLoadInput,
    deliveryLineId,
    autoDeliveryLoads,
    deliveryTotal,
    runShippingLookup,
    handleAddressSuggestionSelect,
    applyDeliveryLineItem,
  };
}
