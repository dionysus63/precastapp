import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { MarkAllSubmittedButton } from "@/components/drill-sheets/mark-all-submitted-button";
import {
  JobOverviewInvoices,
  PrintAllInvoicesButton,
} from "@/components/jobs/overview/job-overview-invoices";
import { JobOverviewLoads } from "@/components/jobs/overview/job-overview-loads";
import { JobOverviewPaperwork } from "@/components/jobs/overview/job-overview-paperwork";
import { JobOverviewQuotes } from "@/components/jobs/overview/job-overview-quotes";
import { JobOverviewStockItems } from "@/components/jobs/overview/job-overview-stock-items";
import { JobOverviewStructures } from "@/components/jobs/overview/job-overview-structures";
import { overviewHeaderButtonClassName } from "@/components/jobs/overview/overview-styles";
import type { JobOverviewView } from "@/lib/job-overview";

/** What the signed-in user may see and do on the Overview. */
export type JobOverviewPermissions = {
  canManageDeliveries: boolean;
  canScanIn: boolean;
  canManageProduction: boolean;
  canViewQuotes: boolean;
  canManageQuotes: boolean;
  canViewInvoices: boolean;
  canManageInvoices: boolean;
  canViewFiles: boolean;
  canManageFiles: boolean;
};

function HeaderButtons({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>
  );
}

/**
 * The job page's Overview tab: working grids, so the day's work on a job
 * (move a load along, print a ticket, mark an invoice paid, drop in the PO)
 * is done here without opening the other tabs. Loads, structures and quotes
 * on the left; paperwork, invoices and stock still owed on the right.
 */
export function JobOverviewSection({
  jobId,
  hasFolder,
  overview,
  permissions,
}: {
  jobId: string;
  hasFolder: boolean;
  overview: JobOverviewView;
  permissions: JobOverviewPermissions;
}) {
  const hasSheets = overview.structures.some(
    (structure) => structure.drillSheetId,
  );

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="min-w-0 space-y-4">
        <SectionCard
          title="Loads"
          count={overview.loads.length}
          noPadding
          action={
            permissions.canManageDeliveries ? (
              <HeaderButtons>
                <Link
                  href={`/delivery-tickets/plan?jobId=${jobId}`}
                  className={overviewHeaderButtonClassName}
                >
                  Plan Loads
                </Link>
                <Link
                  href={`/delivery-tickets/schedule?jobId=${jobId}`}
                  className={overviewHeaderButtonClassName}
                >
                  Schedule Loads
                </Link>
                <Link
                  href={`/delivery-tickets/new?jobId=${jobId}`}
                  className={overviewHeaderButtonClassName}
                >
                  New Ticket
                </Link>
              </HeaderButtons>
            ) : null
          }
        >
          <JobOverviewLoads
            loads={overview.loads}
            canManageDeliveries={permissions.canManageDeliveries}
            canScanIn={permissions.canScanIn}
          />
        </SectionCard>

        <SectionCard
          title="Structures"
          count={overview.structures.length}
          noPadding
          action={
            <HeaderButtons>
              {hasSheets ? (
                <a
                  href={`/api/jobs/${jobId}/drill-sheets`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={overviewHeaderButtonClassName}
                >
                  All Sheets PDF
                </a>
              ) : null}
              {permissions.canManageProduction ? (
                <MarkAllSubmittedButton
                  jobId={jobId}
                  count={overview.structuresToSubmit}
                />
              ) : null}
              <Link
                href={`/jobs/${jobId}?tab=quick-build`}
                className={overviewHeaderButtonClassName}
              >
                Quick Build
              </Link>
            </HeaderButtons>
          }
        >
          <JobOverviewStructures
            jobId={jobId}
            structures={overview.structures}
            canManageProduction={permissions.canManageProduction}
          />
        </SectionCard>

        {permissions.canViewQuotes ? (
          <SectionCard
            title="Quotes"
            count={overview.quotes.length}
            noPadding
            action={
              permissions.canManageQuotes ? (
                <Link
                  href={`/quotes/new?jobId=${jobId}`}
                  className={overviewHeaderButtonClassName}
                >
                  New Quote
                </Link>
              ) : null
            }
          >
            <JobOverviewQuotes quotes={overview.quotes} />
          </SectionCard>
        ) : null}
      </div>

      <div className="min-w-0 space-y-4">
        {permissions.canViewFiles ? (
          <SectionCard title="Paperwork" noPadding>
            <JobOverviewPaperwork
              jobId={jobId}
              hasFolder={hasFolder}
              paperwork={overview.paperwork}
              canManageFiles={permissions.canManageFiles}
            />
          </SectionCard>
        ) : null}

        {permissions.canViewInvoices ? (
          <SectionCard
            title="Invoices"
            count={overview.invoices.length}
            noPadding
            action={<PrintAllInvoicesButton invoices={overview.invoices} />}
          >
            <JobOverviewInvoices
              invoices={overview.invoices}
              money={overview.money}
              canManageInvoices={permissions.canManageInvoices}
            />
          </SectionCard>
        ) : null}

        {overview.stockItems ? (
          <SectionCard
            title="Stock Items Still Owed"
            count={overview.stockItems.length}
            noPadding
            action={
              permissions.canManageDeliveries ? (
                <Link
                  href={`/delivery-tickets/plan?jobId=${jobId}`}
                  className={overviewHeaderButtonClassName}
                >
                  Plan Loads
                </Link>
              ) : null
            }
          >
            <JobOverviewStockItems items={overview.stockItems} />
          </SectionCard>
        ) : null}
      </div>
    </div>
  );
}
