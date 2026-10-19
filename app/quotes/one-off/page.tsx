import Link from "next/link";
import { AppPermission } from "@/app/generated/prisma/client";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { OneOffDrillSheets } from "@/components/quotes/one-off/one-off-drill-sheets";
import { requirePermission } from "@/lib/auth/session";
import {
  loadDrillSheetFormOptions,
  loadRectSheetFormOptions,
} from "@/lib/drill-sheet-options";

/** Quote list tabs, so One-Off reads as one more tab of the Quotes page. */
const QUOTE_TABS = [
  { label: "Open", href: "/quotes" },
  { label: "Won", href: "/quotes?status=WON" },
  { label: "Closed", href: "/quotes?status=CLOSED" },
  { label: "All", href: "/quotes?status=ALL" },
];

export default async function OneOffDrillSheetsPage() {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);

  const [circular, rect] = await Promise.all([
    loadDrillSheetFormOptions(),
    loadRectSheetFormOptions(),
  ]);

  return (
    <DashboardShell
      title="Quotes"
      subtitle="Manage bids, revisions, and quote status."
    >
      <div className="space-y-4">
        <div className="border-b border-slate-200">
          <div className="-mb-px flex flex-wrap items-center gap-1">
            {QUOTE_TABS.map((tab) => (
              <Link
                key={tab.label}
                href={tab.href}
                className="border-b-2 border-transparent px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-800"
              >
                {tab.label}
              </Link>
            ))}
            <span className="border-b-2 border-slate-900 px-3 py-2 text-xs font-medium text-slate-900">
              One-Off
            </span>
          </div>
        </div>

        <OneOffDrillSheets
          circularOptions={{
            templates: circular.templateOptions,
            castings: circular.castingOptions,
            pipeOpeningSizes: circular.pipeOpeningSizes,
            diameterConfigs: circular.diameterConfigs,
          }}
          rectOptions={{
            templates: rect.templateOptions,
            castings: rect.castingOptions,
            openingSizes: rect.openingSizes,
          }}
        />
      </div>
    </DashboardShell>
  );
}
