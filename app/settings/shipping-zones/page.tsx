import { SettingsShell } from "@/components/settings/settings-shell";
import {
  ShippingZonesManager,
  type ZoneListItem,
} from "@/components/shipping/shipping-zones-manager";
import { getAppSettings } from "@/lib/app-settings";
import { withDatabaseRetry } from "@/lib/prisma";
import { toResolvableZone } from "@/lib/shipping/zones";

export default async function ShippingZonesPage() {
  const [settings, zoneRows] = await Promise.all([
    getAppSettings(),
    withDatabaseRetry((client) =>
      client.shippingZone.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
    ),
  ]);

  const zones: ZoneListItem[] = zoneRows.map((row) => ({
    ...toResolvableZone(row),
    active: row.active,
    notes: row.notes,
  }));
  const yard =
    settings.yardLatitude !== null && settings.yardLongitude !== null
      ? { lat: settings.yardLatitude, lng: settings.yardLongitude }
      : null;

  return (
    <SettingsShell
      title="Shipping Zones"
      subtitle="Delivery pricing zones: radius rings from the yard plus hand-drawn NYC boundaries."
    >
      <ShippingZonesManager
        zones={zones}
        yard={yard}
        companyAddress={settings.companyAddress}
      />
    </SettingsShell>
  );
}
