import "server-only";

// OpenStreetMap Nominatim geocoding. Free, no API key; usage policy requires
// an identifying User-Agent and at most ~1 request/second, which this
// internal office tool stays well under.

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

// Photon (komoot) is used for search-as-you-type suggestions: it is built for
// autocomplete, which Nominatim's usage policy explicitly disallows.
const PHOTON_SEARCH_URL = "https://photon.komoot.io/api/";

export type GeocodeResult = {
  latitude: number;
  longitude: number;
  displayName: string;
};

export type AddressSuggestion = {
  label: string;
  latitude: number;
  longitude: number;
};

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    countrycode?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    town?: string;
    village?: string;
    district?: string;
    state?: string;
    postcode?: string;
  };
};

function formatPhotonLabel(p: NonNullable<PhotonFeature["properties"]>): string {
  const line1 =
    p.housenumber && p.street
      ? `${p.housenumber} ${p.street}`
      : (p.name ?? p.street ?? "");
  // Photon puts the hamlet/village people actually use in `district` and the
  // surrounding township (e.g. Town of Brookhaven) in `city` — prefer the
  // specific locality.
  const city = p.district ?? p.village ?? p.town ?? p.city ?? "";
  const region = [p.state, p.postcode].filter(Boolean).join(" ");
  return [line1, city, region].filter(Boolean).join(", ");
}

/** Search-as-you-type suggestions, optionally biased toward the yard. */
export async function suggestAddresses(
  query: string,
  bias?: { lat: number; lng: number },
): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const params = new URLSearchParams({ q: trimmed, limit: "6", lang: "en" });
  if (bias) {
    params.set("lat", String(bias.lat));
    params.set("lon", String(bias.lng));
  }

  const response = await fetch(`${PHOTON_SEARCH_URL}?${params}`, {
    headers: {
      "User-Agent": "precastapp/1.0 (internal delivery pricing tool)",
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(6_000),
  });
  if (!response.ok) {
    throw new Error(`Address suggestion service returned ${response.status}.`);
  }

  const body = (await response.json()) as { features?: PhotonFeature[] };
  const suggestions: AddressSuggestion[] = [];
  const seen = new Set<string>();
  for (const feature of body.features ?? []) {
    const props = feature.properties;
    const coords = feature.geometry?.coordinates;
    if (!props || !coords) continue;
    if ((props.countrycode ?? "").toUpperCase() !== "US") continue;
    const label = formatPhotonLabel(props);
    const longitude = Number(coords[0]);
    const latitude = Number(coords[1]);
    if (!label || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      continue;
    }
    if (seen.has(label)) continue;
    seen.add(label);
    suggestions.push({ label, latitude, longitude });
  }
  return suggestions;
}

export async function geocodeAddress(
  address: string,
): Promise<GeocodeResult | null> {
  const query = address.trim();
  if (!query) return null;

  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "1",
    countrycodes: "us",
  });

  const response = await fetch(`${NOMINATIM_SEARCH_URL}?${params}`, {
    headers: {
      "User-Agent": "precastapp/1.0 (internal delivery pricing tool)",
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Address lookup service returned ${response.status}.`);
  }

  const results = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;
  const first = results[0];
  if (!first) return null;

  const latitude = Number(first.lat);
  const longitude = Number(first.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return { latitude, longitude, displayName: first.display_name };
}
