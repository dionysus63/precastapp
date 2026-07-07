"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createShippingZone,
  deleteShippingZone,
  setYardLocation,
  updateShippingZone,
  type ShippingZoneInput,
} from "@/app/settings/shipping-zones/actions";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import type {
  LatLng,
  PolygonRing,
  ResolvableZone,
} from "@/lib/shipping/zones";
import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";

const ZoneMap = dynamic(() => import("@/components/shipping/zone-map"), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
  ),
});

export type ZoneListItem = ResolvableZone & {
  active: boolean;
  notes: string | null;
};

type ShippingZonesManagerProps = {
  zones: ZoneListItem[];
  yard: LatLng | null;
  companyAddress: string;
};

type ZoneFormState = {
  id: string | null;
  name: string;
  kind: "RADIUS" | "POLYGON";
  radiusMiles: string;
  ratePerLoad: string;
  color: string;
  sortOrder: string;
  active: boolean;
  notes: string;
  ring: PolygonRing;
};

const DEFAULT_CENTER: [number, number] = [40.78, -72.915];

const inputClass =
  "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm";
const labelClass = "text-[11px] font-medium text-slate-600";
const buttonClass =
  "rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50";
const secondaryButtonClass =
  "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";

function emptyForm(kind: "RADIUS" | "POLYGON"): ZoneFormState {
  return {
    id: null,
    name: "",
    kind,
    radiusMiles: "",
    ratePerLoad: "",
    color: kind === "POLYGON" ? "#dc2626" : "#2563eb",
    sortOrder: "0",
    active: true,
    notes: "",
    ring: [],
  };
}

export function ShippingZonesManager({
  zones,
  yard,
  companyAddress,
}: ShippingZonesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ZoneFormState | null>(null);
  const [yardLatInput, setYardLatInput] = useState(
    yard ? String(yard.lat) : "",
  );
  const [yardLngInput, setYardLngInput] = useState(
    yard ? String(yard.lng) : "",
  );

  const drawing = form !== null && form.kind === "POLYGON";
  // Hide the edited zone's stored shape so it isn't drawn twice under the draft.
  const mapZones: ResolvableZone[] = zones.filter(
    (zone) => zone.active && zone.id !== form?.id,
  );

  function update(patch: Partial<ZoneFormState>) {
    setForm((current) => (current ? { ...current, ...patch } : current));
  }

  function startEdit(zone: ZoneListItem) {
    setError(null);
    setForm({
      id: zone.id,
      name: zone.name,
      kind: zone.kind,
      radiusMiles: zone.radiusMiles !== null ? String(zone.radiusMiles) : "",
      ratePerLoad: String(zone.ratePerLoad),
      color: zone.color,
      sortOrder: String(zone.sortOrder),
      active: zone.active,
      notes: zone.notes ?? "",
      ring: zone.polygon ? [...zone.polygon] : [],
    });
  }

  function handleMapClick(lat: number, lng: number) {
    if (!form || form.kind !== "POLYGON") return;
    update({
      ring: [
        ...form.ring,
        [Number(lat.toFixed(6)), Number(lng.toFixed(6))],
      ],
    });
  }

  function saveZone() {
    if (!form) return;
    const input: ShippingZoneInput = {
      name: form.name,
      kind: form.kind,
      radiusMiles: form.radiusMiles === "" ? null : Number(form.radiusMiles),
      polygon: form.kind === "POLYGON" ? form.ring : null,
      ratePerLoad: Number(form.ratePerLoad),
      color: form.color,
      sortOrder: Number(form.sortOrder),
      active: form.active,
      notes: form.notes || null,
    };
    setError(null);
    startTransition(async () => {
      const result = form.id
        ? await updateShippingZone(form.id, input)
        : await createShippingZone(input);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setForm(null);
      router.refresh();
    });
  }

  function removeZone(zone: ZoneListItem) {
    if (!window.confirm(`Delete zone "${zone.name}"?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteShippingZone(zone.id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if (form?.id === zone.id) setForm(null);
      router.refresh();
    });
  }

  function saveYard(source: "companyAddress" | "manual") {
    setError(null);
    startTransition(async () => {
      const result = await setYardLocation(
        source === "companyAddress"
          ? { source }
          : {
              source,
              latitude: Number(yardLatInput),
              longitude: Number(yardLngInput),
            },
      );
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setYardLatInput(String(result.latitude));
      setYardLngInput(String(result.longitude));
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <SectionCard title="Yard location">
        <p className="text-xs text-slate-600">
          Radius zones are measured as straight-line miles from this point.
          Company address: <span className="font-medium">{companyAddress}</span>
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className={labelClass}>Latitude</label>
            <input
              value={yardLatInput}
              onChange={(event) => setYardLatInput(event.target.value)}
              className={inputClass}
              placeholder="40.7809"
            />
          </div>
          <div>
            <label className={labelClass}>Longitude</label>
            <input
              value={yardLngInput}
              onChange={(event) => setYardLngInput(event.target.value)}
              className={inputClass}
              placeholder="-72.9147"
            />
          </div>
          <button
            type="button"
            onClick={() => saveYard("manual")}
            disabled={isPending}
            className={buttonClass}
          >
            Save coordinates
          </button>
          <button
            type="button"
            onClick={() => saveYard("companyAddress")}
            disabled={isPending}
            className={secondaryButtonClass}
          >
            Look up from company address
          </button>
          {!yard ? (
            <span className="text-xs font-medium text-amber-700">
              Yard location not set — radius zones won&apos;t work until it is.
            </span>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="Zone map">
        {drawing ? (
          <p className="mb-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800">
            Drawing “{form.name || "new zone"}” — click the map to add boundary
            points ({form.ring.length} so far,{" "}
            {form.ring.length >= 3 ? "ready to save" : "need at least 3"}).
          </p>
        ) : null}
        <ZoneMap
          center={yard ? [yard.lat, yard.lng] : DEFAULT_CENTER}
          zoom={9}
          yard={yard}
          zones={mapZones}
          draftRing={drawing ? form.ring : null}
          onMapClick={drawing ? handleMapClick : undefined}
        />
      </SectionCard>

      <SectionCard title="Zones" noPadding>
        {zones.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            No zones yet. Add radius rings for your regular delivery area, then
            draw polygon zones for NYC.
          </p>
        ) : (
          <div className={tableFlushWrapperClassName}>
            <table className={tableClassName}>
              <thead>
                <tr>
                  <th className={tableHeaderCellClassName}>Zone</th>
                  <th className={tableHeaderCellClassName}>Type</th>
                  <th className={tableHeaderCellClassName}>Boundary</th>
                  <th className={tableHeaderCellClassName}>Rate / load</th>
                  <th className={tableHeaderCellClassName}>Status</th>
                  <th className={tableHeaderCellClassName}>Actions</th>
                </tr>
              </thead>
              <tbody className={tableBodyClassName}>
                {zones.map((zone) => (
                  <tr key={zone.id} className={tableRowClassName}>
                    <td className={`${tableCellClassName} font-medium text-slate-900`}>
                      <span
                        className="mr-2 inline-block h-3 w-3 rounded-full align-middle"
                        style={{ backgroundColor: zone.color }}
                      />
                      {zone.name}
                    </td>
                    <td className={`${tableCellClassName} text-slate-700`}>
                      {zone.kind === "RADIUS" ? "Radius" : "Drawn boundary"}
                    </td>
                    <td className={`${tableCellClassName} text-slate-700`}>
                      {zone.kind === "RADIUS"
                        ? `${zone.radiusMiles} mi from yard`
                        : `${zone.polygon?.length ?? 0} boundary points`}
                    </td>
                    <td className={`${tableCellClassName} text-slate-700`}>
                      {zone.ratePerLoad.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                      })}
                    </td>
                    <td className={tableCellClassName}>
                      <StatusBadge
                        label={zone.active ? "Active" : "Inactive"}
                        variant={zone.active ? "success" : "neutral"}
                      />
                    </td>
                    <td className={tableCellClassName}>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(zone)}
                          className="text-slate-700 underline hover:text-slate-900"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeZone(zone)}
                          disabled={isPending}
                          className="text-red-600 underline hover:text-red-800 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title={form?.id ? "Edit zone" : "Add zone"}>
        {form === null ? (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setForm(emptyForm("RADIUS"));
              }}
              className={buttonClass}
            >
              Add radius zone
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setForm(emptyForm("POLYGON"));
              }}
              className={secondaryButtonClass}
            >
              Draw NYC / custom zone
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Name *</label>
              <input
                value={form.name}
                onChange={(event) => update({ name: event.target.value })}
                className={inputClass}
                placeholder={
                  form.kind === "RADIUS" ? "Zone 1 — 0–25 mi" : "Manhattan"
                }
              />
            </div>
            <div>
              <label className={labelClass}>Type</label>
              <select
                value={form.kind}
                onChange={(event) =>
                  update({
                    kind: event.target.value as "RADIUS" | "POLYGON",
                  })
                }
                className={inputClass}
              >
                <option value="RADIUS">Radius from yard</option>
                <option value="POLYGON">Drawn boundary</option>
              </select>
            </div>
            {form.kind === "RADIUS" ? (
              <div>
                <label className={labelClass}>Radius (miles) *</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.radiusMiles}
                  onChange={(event) =>
                    update({ radiusMiles: event.target.value })
                  }
                  className={inputClass}
                />
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => update({ ring: form.ring.slice(0, -1) })}
                  disabled={form.ring.length === 0}
                  className={secondaryButtonClass}
                >
                  Undo point
                </button>
                <button
                  type="button"
                  onClick={() => update({ ring: [] })}
                  disabled={form.ring.length === 0}
                  className={secondaryButtonClass}
                >
                  Clear
                </button>
              </div>
            )}
            <div>
              <label className={labelClass}>Rate per load ($) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.ratePerLoad}
                onChange={(event) =>
                  update({ ratePerLoad: event.target.value })
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Color</label>
              <input
                type="color"
                value={form.color}
                onChange={(event) => update({ color: event.target.value })}
                className="mt-1 block h-9 w-16 rounded-lg border border-slate-200 bg-white"
              />
            </div>
            <div>
              <label className={labelClass}>Sort order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(event) => update({ sortOrder: event.target.value })}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Notes</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(event) => update({ notes: event.target.value })}
                className={inputClass}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => update({ active: event.target.checked })}
                />
                Active
              </label>
            </div>
            <div className="flex gap-2 sm:col-span-3">
              <button
                type="button"
                onClick={saveZone}
                disabled={isPending}
                className={buttonClass}
              >
                {form.id ? "Save zone" : "Create zone"}
              </button>
              <button
                type="button"
                onClick={() => setForm(null)}
                disabled={isPending}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
