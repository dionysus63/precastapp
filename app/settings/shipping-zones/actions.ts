"use server";

import { revalidatePath } from "next/cache";
import { AppPermission, Prisma } from "@/app/generated/prisma/client";
import { invalidateAppSettingsCache } from "@/lib/app-settings";
import { requirePermission } from "@/lib/auth/session";
import { withDatabaseRetry } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/shipping/geocode";
import { parsePolygonRing, type PolygonRing } from "@/lib/shipping/zones";

export type ShippingZoneInput = {
  name: string;
  kind: "RADIUS" | "POLYGON";
  radiusMiles: number | null;
  polygon: unknown;
  ratePerLoad: number;
  color: string;
  sortOrder: number;
  active: boolean;
  notes: string | null;
};

type ValidatedZone = {
  name: string;
  kind: "RADIUS" | "POLYGON";
  radiusMiles: number | null;
  polygon: PolygonRing | null;
  ratePerLoad: number;
  color: string;
  sortOrder: number;
  active: boolean;
  notes: string | null;
};

function validateZoneInput(
  input: ShippingZoneInput,
): { error: string } | { data: ValidatedZone } {
  const name = input.name?.trim();
  if (!name) return { error: "Zone name is required." };

  if (input.kind !== "RADIUS" && input.kind !== "POLYGON") {
    return { error: "Invalid zone type." };
  }

  const ratePerLoad = Number(input.ratePerLoad);
  if (!Number.isFinite(ratePerLoad) || ratePerLoad < 0) {
    return { error: "Rate per load must be zero or a positive amount." };
  }

  let radiusMiles: number | null = null;
  let polygon: PolygonRing | null = null;
  if (input.kind === "RADIUS") {
    radiusMiles = Number(input.radiusMiles);
    if (!Number.isFinite(radiusMiles) || radiusMiles <= 0) {
      return { error: "Radius zones need a distance in miles." };
    }
  } else {
    polygon = parsePolygonRing(input.polygon);
    if (!polygon) {
      return { error: "Draw the zone boundary on the map (at least 3 points)." };
    }
  }

  const color = /^#[0-9a-fA-F]{6}$/.test(input.color?.trim() ?? "")
    ? input.color.trim()
    : "#2563eb";
  const sortOrder = Number.isFinite(Number(input.sortOrder))
    ? Number(input.sortOrder)
    : 0;

  return {
    data: {
      name,
      kind: input.kind,
      radiusMiles,
      polygon,
      ratePerLoad,
      color,
      sortOrder,
      active: input.active !== false,
      notes: input.notes?.trim() || null,
    },
  };
}

function revalidateShippingZonePaths() {
  revalidatePath("/settings/shipping-zones");
  revalidatePath("/settings");
  revalidatePath("/shipping");
}

export async function createShippingZone(
  input: ShippingZoneInput,
): Promise<{ error: string } | { ok: true }> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);

  const validated = validateZoneInput(input);
  if ("error" in validated) return validated;

  try {
    await withDatabaseRetry((client) =>
      client.shippingZone.create({
        data: {
          ...validated.data,
          polygon: validated.data.polygon ?? undefined,
        },
      }),
    );
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not create zone.",
    };
  }

  revalidateShippingZonePaths();
  return { ok: true };
}

export async function updateShippingZone(
  id: string,
  input: ShippingZoneInput,
): Promise<{ error: string } | { ok: true }> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);

  if (!id) return { error: "Zone id is required." };
  const validated = validateZoneInput(input);
  if ("error" in validated) return validated;

  try {
    await withDatabaseRetry((client) =>
      client.shippingZone.update({
        where: { id },
        data: {
          ...validated.data,
          // DbNull clears the ring when a zone switches from polygon to radius.
          polygon: validated.data.polygon ?? Prisma.DbNull,
        },
      }),
    );
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not update zone.",
    };
  }

  revalidateShippingZonePaths();
  return { ok: true };
}

export async function deleteShippingZone(
  id: string,
): Promise<{ error: string } | { ok: true }> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);

  if (!id) return { error: "Zone id is required." };

  try {
    await withDatabaseRetry((client) =>
      client.shippingZone.delete({ where: { id } }),
    );
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not delete zone.",
    };
  }

  revalidateShippingZonePaths();
  return { ok: true };
}

export async function setYardLocation(
  input:
    | { source: "companyAddress" }
    | { source: "manual"; latitude: number; longitude: number },
): Promise<{ error: string } | { ok: true; latitude: number; longitude: number }> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);

  let latitude: number;
  let longitude: number;

  if (input.source === "companyAddress") {
    const settings = await withDatabaseRetry((client) =>
      client.appSettings.findUnique({ where: { id: "default" } }),
    );
    const address = settings?.companyAddress?.trim();
    if (!address) return { error: "Company address is not set." };

    let result;
    try {
      result = await geocodeAddress(address);
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : "Address lookup failed.",
      };
    }
    if (!result) {
      return {
        error: `Could not find "${address}" — enter the coordinates manually.`,
      };
    }
    latitude = result.latitude;
    longitude = result.longitude;
  } else {
    latitude = Number(input.latitude);
    longitude = Number(input.longitude);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      return { error: "Enter a valid latitude and longitude." };
    }
  }

  try {
    await withDatabaseRetry((client) =>
      client.appSettings.update({
        where: { id: "default" },
        data: { yardLatitude: latitude, yardLongitude: longitude },
      }),
    );
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not save yard location.",
    };
  }

  invalidateAppSettingsCache();
  revalidateShippingZonePaths();
  return { ok: true, latitude, longitude };
}
