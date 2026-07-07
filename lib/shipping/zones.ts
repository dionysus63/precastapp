// Pure geometry helpers for shipping zones. Safe to import from both server
// actions and client map components.

export type LatLng = { lat: number; lng: number };

/** Unclosed ring of [lat, lng] vertex pairs, as stored in ShippingZone.polygon. */
export type PolygonRing = Array<[number, number]>;

export type ResolvableZone = {
  id: string;
  name: string;
  kind: "RADIUS" | "POLYGON";
  radiusMiles: number | null;
  polygon: PolygonRing | null;
  ratePerLoad: number;
  color: string;
  sortOrder: number;
};

export type ZoneMatch = {
  zone: ResolvableZone;
  /** Straight-line miles from the yard, when the yard location is known. */
  distanceMiles: number | null;
};

const EARTH_RADIUS_MILES = 3958.7613;

export function haversineMiles(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Ray-casting point-in-polygon over [lat, lng] pairs. */
export function pointInPolygon(point: LatLng, ring: PolygonRing): boolean {
  if (ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [latI, lngI] = ring[i];
    const [latJ, lngJ] = ring[j];
    const intersects =
      latI > point.lat !== latJ > point.lat &&
      point.lng <
        ((lngJ - lngI) * (point.lat - latI)) / (latJ - latI) + lngI;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Find the zone an address point falls in. Hand-drawn polygon zones win over
 * radius rings (they exist precisely to override the rings inside NYC);
 * among radius zones the smallest ring containing the point wins.
 */
export function resolveZone(
  point: LatLng,
  yard: LatLng | null,
  zones: ResolvableZone[],
): ZoneMatch | null {
  const distanceMiles = yard ? haversineMiles(yard, point) : null;

  const polygonMatch = zones
    .filter((zone) => zone.kind === "POLYGON" && zone.polygon)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .find((zone) => pointInPolygon(point, zone.polygon as PolygonRing));
  if (polygonMatch) return { zone: polygonMatch, distanceMiles };

  if (distanceMiles === null) return null;

  const radiusMatch = zones
    .filter(
      (zone): zone is ResolvableZone & { radiusMiles: number } =>
        zone.kind === "RADIUS" && zone.radiusMiles !== null,
    )
    .sort((a, b) => a.radiusMiles - b.radiusMiles)
    .find((zone) => distanceMiles <= zone.radiusMiles);
  return radiusMatch ? { zone: radiusMatch, distanceMiles } : null;
}

/**
 * Map a ShippingZone DB row (Decimal fields arrive as unknown) into the plain
 * numeric shape used by the resolver and the client map components.
 */
export function toResolvableZone(row: {
  id: string;
  name: string;
  kind: string;
  radiusMiles: unknown;
  polygon: unknown;
  ratePerLoad: unknown;
  color: string;
  sortOrder: number;
}): ResolvableZone {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind === "POLYGON" ? "POLYGON" : "RADIUS",
    radiusMiles: row.radiusMiles === null ? null : Number(row.radiusMiles),
    polygon: parsePolygonRing(row.polygon),
    ratePerLoad: Number(row.ratePerLoad),
    color: row.color,
    sortOrder: row.sortOrder,
  };
}

/** Validate a polygon payload from the client into a stored ring. */
export function parsePolygonRing(value: unknown): PolygonRing | null {
  if (!Array.isArray(value) || value.length < 3) return null;
  const ring: PolygonRing = [];
  for (const vertex of value) {
    if (!Array.isArray(vertex) || vertex.length !== 2) return null;
    const lat = Number(vertex[0]);
    const lng = Number(vertex[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    ring.push([lat, lng]);
  }
  return ring;
}
