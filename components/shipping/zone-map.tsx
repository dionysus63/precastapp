"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Polygon,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type {
  LatLng,
  PolygonRing,
  ResolvableZone,
} from "@/lib/shipping/zones";

const MILES_TO_METERS = 1609.344;

export type ZoneMapProps = {
  center: [number, number];
  zoom?: number;
  heightClassName?: string;
  yard: LatLng | null;
  zones: ResolvableZone[];
  /** Address pin from a rate lookup. */
  pin?: { lat: number; lng: number; label?: string } | null;
  /** In-progress polygon while the user is drawing. */
  draftRing?: PolygonRing | null;
  onMapClick?: (lat: number, lng: number) => void;
};

// MapContainer only reads `center` on mount; this pans to new lookup pins.
function FlyToPin({ pin }: { pin: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (pin) map.flyTo([pin.lat, pin.lng], Math.max(map.getZoom(), 11));
  }, [map, pin]);
  return null;
}

function ClickCapture({
  onMapClick,
}: {
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: (event) => onMapClick(event.latlng.lat, event.latlng.lng),
  });
  return null;
}

export default function ZoneMap({
  center,
  zoom = 9,
  heightClassName = "h-[420px]",
  yard,
  zones,
  pin = null,
  draftRing = null,
  onMapClick,
}: ZoneMapProps) {
  // Draw big rings first so smaller rings and polygons stay clickable on top.
  const radiusZones = zones
    .filter(
      (zone): zone is ResolvableZone & { radiusMiles: number } =>
        zone.kind === "RADIUS" && zone.radiusMiles !== null,
    )
    .sort((a, b) => b.radiusMiles - a.radiusMiles);
  const polygonZones = zones.filter(
    (zone) => zone.kind === "POLYGON" && zone.polygon && zone.polygon.length >= 3,
  );

  return (
    <div className={`${heightClassName} overflow-hidden rounded-xl border border-slate-200`}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {onMapClick ? <ClickCapture onMapClick={onMapClick} /> : null}
        <FlyToPin pin={pin} />

        {yard
          ? radiusZones.map((zone) => (
              <Circle
                key={zone.id}
                center={[yard.lat, yard.lng]}
                radius={zone.radiusMiles * MILES_TO_METERS}
                pathOptions={{
                  color: zone.color,
                  weight: 2,
                  fillOpacity: 0.06,
                }}
              >
                <Tooltip sticky>
                  {zone.name} — {zone.radiusMiles} mi
                </Tooltip>
              </Circle>
            ))
          : null}

        {polygonZones.map((zone) => (
          <Polygon
            key={zone.id}
            positions={zone.polygon as PolygonRing}
            pathOptions={{ color: zone.color, weight: 2, fillOpacity: 0.15 }}
          >
            <Tooltip sticky>{zone.name}</Tooltip>
          </Polygon>
        ))}

        {draftRing && draftRing.length > 0 ? (
          <>
            {draftRing.length >= 3 ? (
              <Polygon
                positions={draftRing}
                pathOptions={{
                  color: "#0f172a",
                  weight: 2,
                  dashArray: "6 4",
                  fillOpacity: 0.1,
                }}
              />
            ) : (
              <Polyline
                positions={draftRing}
                pathOptions={{ color: "#0f172a", weight: 2, dashArray: "6 4" }}
              />
            )}
            {draftRing.map(([lat, lng], index) => (
              <CircleMarker
                key={`${lat},${lng},${index}`}
                center={[lat, lng]}
                radius={4}
                pathOptions={{ color: "#0f172a", fillOpacity: 1 }}
              />
            ))}
          </>
        ) : null}

        {yard ? (
          <CircleMarker
            center={[yard.lat, yard.lng]}
            radius={7}
            pathOptions={{ color: "#b91c1c", fillColor: "#ef4444", fillOpacity: 1 }}
          >
            <Tooltip>Yard</Tooltip>
          </CircleMarker>
        ) : null}

        {pin ? (
          <CircleMarker
            center={[pin.lat, pin.lng]}
            radius={7}
            pathOptions={{ color: "#1d4ed8", fillColor: "#3b82f6", fillOpacity: 1 }}
          >
            <Tooltip permanent>{pin.label ?? "Delivery address"}</Tooltip>
          </CircleMarker>
        ) : null}
      </MapContainer>
    </div>
  );
}
