import { SectionCard } from "@/components/dashboard/section-card";
import { SystemMaintenancePanel } from "@/components/settings/settings-action-buttons";
import { SettingsShell } from "@/components/settings/settings-shell";
import { getDocumentNumberingPreview } from "@/app/settings/actions";
import { getAppSettings } from "@/lib/app-settings";

export default async function SystemSettingsPage() {
  const [settings, numbering] = await Promise.all([
    getAppSettings(),
    getDocumentNumberingPreview(),
  ]);

  return (
    <SettingsShell
      title="System & Maintenance"
      subtitle="Document numbering, file sync, and environment summary."
    >
      <SectionCard title="Next document numbers" description={numbering.quoteNote}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Document</th>
                <th className="px-3 py-2 font-semibold">Format</th>
                <th className="px-3 py-2 font-semibold">Last # ({numbering.year})</th>
                <th className="px-3 py-2 font-semibold">Next</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-3 py-2 font-medium">Job</td>
                <td className="px-3 py-2 font-mono">{numbering.job.format}</td>
                <td className="px-3 py-2">{numbering.job.lastNumber}</td>
                <td className="px-3 py-2 font-mono font-semibold">{numbering.job.next}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">Delivery ticket</td>
                <td className="px-3 py-2 font-mono">{numbering.deliveryTicket.format}</td>
                <td className="px-3 py-2">{numbering.deliveryTicket.lastNumber}</td>
                <td className="px-3 py-2 font-mono font-semibold">
                  {numbering.deliveryTicket.next}
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">Invoice</td>
                <td className="px-3 py-2 font-mono">{numbering.invoice.format}</td>
                <td className="px-3 py-2">{numbering.invoice.lastNumber}</td>
                <td className="px-3 py-2 font-mono font-semibold">{numbering.invoice.next}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Maintenance actions">
        <SystemMaintenancePanel />
      </SectionCard>

      <SectionCard title="Environment">
        <dl className="grid gap-2 text-xs sm:grid-cols-2">
          <div>
            <dt className="font-medium text-slate-500">Platform</dt>
            <dd className="font-mono text-slate-800">{process.platform}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Node</dt>
            <dd className="font-mono text-slate-800">{process.version}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium text-slate-500">Jobs root</dt>
            <dd className="font-mono text-slate-800">{settings.jobsRoot}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium text-slate-500">Quote PDF fallback</dt>
            <dd className="font-mono text-slate-800">{settings.quotePdfFallbackDir}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium text-slate-500">Stock submittals root</dt>
            <dd className="font-mono text-slate-800">{settings.stockSubmittalsRoot}</dd>
          </div>
        </dl>
      </SectionCard>
    </SettingsShell>
  );
}
