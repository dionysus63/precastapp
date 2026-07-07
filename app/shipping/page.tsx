import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { RateLookup } from "@/components/shipping/rate-lookup";
import { getAppSettings } from "@/lib/app-settings";
import { withDatabaseRetry } from "@/lib/prisma";
import { toResolvableZone } from "@/lib/shipping/zones";

export default async function ShippingRatesPage() {
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

  return (
    <DashboardShell
      title="Shipping Rates"
      subtitle="Enter a delivery address to find its zone and price per load."
    >
      {zoneRows.length === 0 ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
          No shipping zones are set up yet. Configure them under{" "}
          <Link href="/settings/shipping-zones" className="underline">
            Settings → Shipping Zones
          </Link>
          .
        </p>
      ) : null}
      <RateLookup zones={zoneRows.map(toResolvableZone)} yard={yard} />
    </DashboardShell>
  );
}
