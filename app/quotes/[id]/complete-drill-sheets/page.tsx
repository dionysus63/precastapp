import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  CompleteDrillSheetsClient,
  type CompleteDrillSheetEntry,
} from "@/components/quotes/rect-structure-workbook/complete-drill-sheets-client";
import { requirePermission } from "@/lib/auth/session";
import { loadRectSheetFormOptions } from "@/lib/drill-sheet-options";
import { withDatabaseRetry } from "@/lib/prisma";
import { parseRectStructureConfigJson } from "@/lib/quotes/rect-structure-workbook";

type CompleteDrillSheetsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CompleteDrillSheetsPage({
  params,
}: CompleteDrillSheetsPageProps) {
  const { id } = await params;
  await requirePermission("STRUCTURES_MANAGE");

  const [quote, placeholders, { templateOptions, castingOptions, openingSizes }] =
    await Promise.all([
      withDatabaseRetry((prisma) =>
        prisma.quote.findUnique({
          where: { id },
          select: { id: true, quoteNumber: true, jobId: true },
        }),
      ),
      withDatabaseRetry((prisma) =>
        prisma.jobStructure.findMany({
          where: {
            quoteId: id,
            needsCutSheet: true,
            structureTemplateId: null,
            structureType: "CONFIGURABLE_PRODUCT",
          },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            structureNumber: true,
            quoteLineItems: {
              select: { structureConfigJson: true },
              take: 1,
            },
          },
        }),
      ),
      loadRectSheetFormOptions(),
    ]);

  if (!quote) {
    notFound();
  }

  const entries: CompleteDrillSheetEntry[] = [];
  let skipped = 0;
  for (const placeholder of placeholders) {
    const config = parseRectStructureConfigJson(
      placeholder.quoteLineItems[0]?.structureConfigJson ?? null,
    );
    if (config) {
      entries.push({
        jobStructureId: placeholder.id,
        structureNumber: placeholder.structureNumber ?? "",
        config,
      });
    } else {
      skipped += 1;
    }
  }

  const returnPath = quote.jobId
    ? `/jobs/${quote.jobId}?tab=production`
    : `/quotes/${quote.id}`;

  return (
    <DashboardShell
      title="Complete Drill Sheets"
      subtitle={`Quote ${quote.quoteNumber} — fill in the drill-sheet detail for every quote-only structure at once.`}
    >
      <Link
        href={returnPath}
        className="text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        ← Back
      </Link>

      <div className="mt-4 space-y-4">
        {skipped > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            {skipped} structure{skipped === 1 ? "" : "s"} on this quote{" "}
            {skipped === 1 ? "was" : "were"} not quoted as rectangular
            structures and {skipped === 1 ? "is" : "are"} not shown here —
            complete {skipped === 1 ? "it" : "them"} from{" "}
            <Link
              href={`/jobs/${quote.jobId}?tab=production`}
              className="font-semibold underline"
            >
              the job&apos;s production tab
            </Link>
            .
          </div>
        ) : null}
        {entries.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            No quote-only rectangular structures are waiting on drill sheets
            for this quote.
          </div>
        ) : templateOptions.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            No active rectangular templates yet. Create one in{" "}
            <Link href="/structures" className="font-semibold underline">
              Structures
            </Link>{" "}
            first.
          </div>
        ) : (
          <CompleteDrillSheetsClient
            quoteId={quote.id}
            returnPath={returnPath}
            entries={entries}
            templates={templateOptions}
            castings={castingOptions}
            openingSizes={openingSizes}
          />
        )}
      </div>
    </DashboardShell>
  );
}
