import { SectionCard } from "@/components/dashboard/section-card";
import { SystemMaintenancePanel } from "@/components/settings/settings-action-buttons";
import { SettingsShell } from "@/components/settings/settings-shell";
import { getDocumentNumberingPreview } from "@/app/settings/actions";
import { getAppSettings } from "@/lib/app-settings";

import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
} from "@/lib/table-styles";
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
        <div className={tableFlushWrapperClassName}>
          <table className={tableClassName}>
            <thead>
              <tr>
                <th className={tableHeaderCellClassName}>Document</th>
                <th className={tableHeaderCellClassName}>Format</th>
                <th className={tableHeaderCellClassName}>Last # ({numbering.year})</th>
                <th className={tableHeaderCellClassName}>Next</th>
              </tr>
            </thead>
            <tbody className={tableBodyClassName}>
              <tr>
                <td className={`${tableCellClassName} font-medium`}>Job</td>
                <td className={`${tableCellClassName} font-mono`}>{numbering.job.format}</td>
                <td className={tableCellClassName}>{numbering.job.lastNumber}</td>
                <td className={`${tableCellClassName} font-mono font-semibold`}>{numbering.job.next}</td>
              </tr>
              <tr>
                <td className={`${tableCellClassName} font-medium`}>Delivery ticket</td>
                <td className={`${tableCellClassName} font-mono`}>{numbering.deliveryTicket.format}</td>
                <td className={tableCellClassName}>{numbering.deliveryTicket.lastNumber}</td>
                <td className={`${tableCellClassName} font-mono font-semibold`}>
                  {numbering.deliveryTicket.next}
                </td>
              </tr>
              <tr>
                <td className={`${tableCellClassName} font-medium`}>Invoice</td>
                <td className={`${tableCellClassName} font-mono`}>{numbering.invoice.format}</td>
                <td className={tableCellClassName}>{numbering.invoice.lastNumber}</td>
                <td className={`${tableCellClassName} font-mono font-semibold`}>{numbering.invoice.next}</td>
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
