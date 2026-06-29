import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { StructureWorkbookPageClient } from "@/components/quotes/structure-workbook/structure-workbook-page-client";
import { requirePermission } from "@/lib/auth/session";
import { canEditQuote } from "@/lib/quotes/edit-rules";
import { mapQuoteToFormInitialValues } from "@/lib/quote-mapper";
import { loadDrillSheetFormOptions } from "@/lib/drill-sheet-options";
import { withDatabaseRetry } from "@/lib/prisma";
import type { QuoteStatus } from "@/app/generated/prisma/client";

type EditQuoteStructuresPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditQuoteStructuresPage({
  params,
}: EditQuoteStructuresPageProps) {
  const { id } = await params;
  await requirePermission("QUOTES_MANAGE");

  const quote = await withDatabaseRetry((prisma) =>
    prisma.quote.findUnique({
      where: { id },
      include: {
        lineItems: {
          orderBy: [{ sortOrder: "asc" }, { lineNumber: "asc" }],
        },
      },
    }),
  );

  if (!quote) {
    notFound();
  }

  let supersededBy: { id: string } | null = null;
  if (quote.status === "REVISED") {
    const rootId = quote.originalQuoteId ?? quote.id;
    supersededBy = await withDatabaseRetry((prisma) =>
      prisma.quote.findFirst({
        where: {
          OR: [{ id: rootId }, { originalQuoteId: rootId }],
          revisionNumber: { gt: quote.revisionNumber },
        },
        orderBy: { revisionNumber: "asc" },
        select: { id: true },
      }),
    );
  }

  if (!canEditQuote(quote.status as QuoteStatus, supersededBy)) {
    redirect(`/quotes/${id}`);
  }

  const formValues = mapQuoteToFormInitialValues(quote);
  const {
    templateOptions,
    castingOptions,
    pipeOpeningSizes,
    diameterConfigs,
  } = await loadDrillSheetFormOptions();

  return (
    <DashboardShell
      title="Circular Structure Workbook"
      subtitle={`Quote ${quote.quoteNumber}`}
    >
      <StructureWorkbookPageClient
        quoteId={id}
        returnPath={`/quotes/${id}/edit`}
        serverLineItems={formValues.lineItems}
        templates={templateOptions}
        castings={castingOptions}
        pipeOpeningSizes={pipeOpeningSizes}
        diameterConfigs={diameterConfigs}
      />
    </DashboardShell>
  );
}
