"use server";

import { AppPermission } from "@/app/generated/prisma/client";
import { getAppSettings } from "@/lib/app-settings";
import { requirePermission } from "@/lib/auth/session";
import { withDatabaseRetry } from "@/lib/prisma";
import {
  geocodeAddress,
  suggestAddresses,
  type AddressSuggestion,
} from "@/lib/shipping/geocode";
import {
  haversineMiles,
  resolveZone,
  toResolvableZone,
} from "@/lib/shipping/zones";

export type ShippingLookupResult =
  | { error: string }
  | {
      ok: true;
      point: { lat: number; lng: number };
      matchedAddress: string;
      distanceMiles: number | null;
      /** Parsed from the truck capacity setting, for estimating load counts. */
      truckCapacityLbs: number | null;
      zone: {
        id: string;
        name: string;
        kind: "RADIUS" | "POLYGON";
        ratePerLoad: number;
        color: string;
      } | null;
    };

type ShippingLookupSuccess = Extract<ShippingLookupResult, { ok: true }>;

async function resolveShippingRateForPoint(
  point: { lat: number; lng: number },
  matchedAddress: string,
): Promise<ShippingLookupSuccess> {
  const [settings, zoneRows] = await Promise.all([
    getAppSettings(),
    withDatabaseRetry((client) =>
      client.shippingZone.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
    ),
  ]);

  const yard =
    settings.yardLatitude !== null && settings.yardLongitude !== null
      ? { lat: settings.yardLatitude, lng: settings.yardLongitude }
      : null;
  const match = resolveZone(point, yard, zoneRows.map(toResolvableZone));
  const distanceMiles = yard ? haversineMiles(yard, point) : null;
  const capacityDigits = Number(
    settings.truckCapacityLabel.replace(/[^0-9.]/g, ""),
  );
  const truckCapacityLbs =
    Number.isFinite(capacityDigits) && capacityDigits > 0
      ? capacityDigits
      : null;

  return {
    ok: true,
    point,
    matchedAddress,
    distanceMiles,
    truckCapacityLbs,
    zone: match
      ? {
          id: match.zone.id,
          name: match.zone.name,
          kind: match.zone.kind,
          ratePerLoad: match.zone.ratePerLoad,
          color: match.zone.color,
        }
      : null,
  };
}

export async function lookupShippingRate(
  address: string,
): Promise<ShippingLookupResult> {
  await requirePermission(AppPermission.QUOTES_VIEW);

  const query = address?.trim();
  if (!query) return { error: "Enter a delivery address." };

  let geocoded;
  try {
    geocoded = await geocodeAddress(query);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Address lookup failed.",
    };
  }
  if (!geocoded) {
    return {
      error:
        "Address not found. Try adding the town and state (e.g. \"123 Main St, Brooklyn, NY\").",
    };
  }

  return resolveShippingRateForPoint(
    { lat: geocoded.latitude, lng: geocoded.longitude },
    geocoded.displayName,
  );
}

/** Zone lookup for a point already resolved by an autocomplete suggestion. */
export async function lookupShippingRateAtPoint(input: {
  lat: number;
  lng: number;
  label: string;
}): Promise<ShippingLookupResult> {
  await requirePermission(AppPermission.QUOTES_VIEW);

  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return { error: "Invalid location." };
  }

  return resolveShippingRateForPoint(
    { lat, lng },
    String(input.label ?? "").trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
  );
}

/** Search-as-you-type suggestions for delivery addresses (Photon/OSM). */
export async function suggestShippingAddresses(
  query: string,
): Promise<AddressSuggestion[]> {
  await requirePermission(AppPermission.QUOTES_VIEW);

  const trimmed = String(query ?? "").trim();
  if (trimmed.length < 3) return [];

  let bias: { lat: number; lng: number } | undefined;
  try {
    const settings = await getAppSettings();
    bias =
      settings.yardLatitude !== null && settings.yardLongitude !== null
        ? { lat: settings.yardLatitude, lng: settings.yardLongitude }
        : undefined;
  } catch {
    bias = undefined;
  }

  try {
    return await suggestAddresses(trimmed, bias);
  } catch {
    // Suggestions are best-effort; typing continues to work without them.
    return [];
  }
}
