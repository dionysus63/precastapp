"use client";

import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import {
  lookupShippingRate,
  lookupShippingRateAtPoint,
  suggestShippingAddresses,
  type ShippingLookupResult,
} from "@/app/shipping/actions";
import { SectionCard } from "@/components/dashboard/section-card";
import { AddressAutocomplete } from "@/components/shipping/address-autocomplete";
import type { AddressSuggestion } from "@/lib/shipping/geocode";
import type { LatLng, ResolvableZone } from "@/lib/shipping/zones";

const ZoneMap = dynamic(() => import("@/components/shipping/zone-map"), {
  ssr: false,
  loading: () => (
    <div className="h-[480px] animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
  ),
});

type RateLookupProps = {
  zones: ResolvableZone[];
  yard: LatLng | null;
};

const DEFAULT_CENTER: [number, number] = [40.78, -72.915];

type LookupSuccess = Extract<ShippingLookupResult, { ok: true }>;

export function RateLookup({ zones, yard }: RateLookupProps) {
  const [address, setAddress] = useState("");
  const [result, setResult] = useState<LookupSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function search() {
    if (!address.trim() || isPending) return;
    setError(null);
    startTransition(async () => {
      const response = await lookupShippingRate(address);
      if ("error" in response) {
        setResult(null);
        setError(response.error);
        return;
      }
      setResult(response);
    });
  }

  function handleSuggestionSelect(suggestion: AddressSuggestion) {
    setAddress(suggestion.label);
    setError(null);
    startTransition(async () => {
      const response = await lookupShippingRateAtPoint({
        lat: suggestion.latitude,
        lng: suggestion.longitude,
        label: suggestion.label,
      });
      if ("error" in response) {
        setResult(null);
        setError(response.error);
        return;
      }
      setResult(response);
    });
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Look up a delivery address">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[320px] flex-1">
            <label className="text-xs font-medium text-slate-700">
              Delivery address
            </label>
            <div className="mt-1">
              <AddressAutocomplete
                inputId="shippingLookupAddress"
                value={address}
                onChangeText={setAddress}
                onSelectSuggestion={handleSuggestionSelect}
                suggest={suggestShippingAddresses}
                placeholder="123 Main St, Brooklyn, NY"
                inputClassName="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={search}
            disabled={isPending || !address.trim()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {isPending ? "Looking up…" : "Get shipping price"}
          </button>
        </div>

        {error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-medium text-red-700">
            {error}
          </p>
        ) : null}

        {result ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Matched address
              </p>
              <p className="mt-0.5 text-sm text-slate-800">
                {result.matchedAddress}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Zone
              </p>
              {result.zone ? (
                <p className="mt-0.5 text-lg font-semibold text-slate-900">
                  <span
                    className="mr-2 inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: result.zone.color }}
                  />
                  {result.zone.name}
                </p>
              ) : (
                <p className="mt-0.5 text-sm font-semibold text-amber-700">
                  Outside all zones — price manually
                </p>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Rate per load
              </p>
              <p className="mt-0.5 text-lg font-semibold text-slate-900">
                {result.zone
                  ? result.zone.ratePerLoad.toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                    })
                  : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Distance from yard
              </p>
              <p className="mt-0.5 text-lg font-semibold text-slate-900">
                {result.distanceMiles !== null
                  ? `${result.distanceMiles.toFixed(1)} mi`
                  : "Yard not set"}
              </p>
            </div>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Zone map">
        <ZoneMap
          center={
            result
              ? [result.point.lat, result.point.lng]
              : yard
                ? [yard.lat, yard.lng]
                : DEFAULT_CENTER
          }
          zoom={result ? 11 : 9}
          heightClassName="h-[480px]"
          yard={yard}
          zones={zones}
          pin={
            result
              ? {
                  lat: result.point.lat,
                  lng: result.point.lng,
                  label: result.zone
                    ? `${result.zone.name} — ${result.zone.ratePerLoad.toLocaleString(
                        "en-US",
                        { style: "currency", currency: "USD" },
                      )}`
                    : "Outside all zones",
                }
              : null
          }
        />
      </SectionCard>
    </div>
  );
}
