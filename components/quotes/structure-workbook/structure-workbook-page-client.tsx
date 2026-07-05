"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { PlanSheetRecord } from "@/app/quotes/plan-sheet-actions";
import type { DrillSheetTemplateOption } from "@/components/drill-sheets/drill-sheet-form";
import { StructureWorkbook } from "@/components/quotes/structure-workbook/structure-workbook";
import type { EditableQuoteLineItem } from "@/lib/quotes/types";
import { readWorkbookSession } from "@/lib/quotes/structure-workbook";
import type { StructureWorkbookOptions } from "@/lib/quotes/structure-workbook";

type StructureWorkbookPageClientProps = {
  quoteId?: string;
  jobId?: string | null;
  returnPath: string;
  serverLineItems?: EditableQuoteLineItem[];
  initialPlanSheet?: PlanSheetRecord | null;
  templates: DrillSheetTemplateOption[];
  castings: StructureWorkbookOptions["castings"];
  pipeOpeningSizes: StructureWorkbookOptions["pipeOpeningSizes"];
  diameterConfigs: StructureWorkbookOptions["diameterConfigs"];
};

export function StructureWorkbookPageClient({
  quoteId,
  jobId,
  returnPath,
  serverLineItems = [],
  initialPlanSheet = null,
  templates,
  castings,
  pipeOpeningSizes,
  diameterConfigs,
}: StructureWorkbookPageClientProps) {
  const initialLineItems = useMemo(() => {
    const session = readWorkbookSession(quoteId);
    if (session?.pendingLineItems?.length) {
      return session.pendingLineItems;
    }
    return serverLineItems;
  }, [quoteId, serverLineItems]);

  const effectiveReturnPath =
    readWorkbookSession(quoteId)?.returnPath ?? returnPath;

  return (
    <>
      <Link
        href={effectiveReturnPath}
        className="text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        ← Back to Quote
      </Link>
      <div className="mt-4">
        <StructureWorkbook
          quoteId={quoteId}
          jobId={jobId ?? readWorkbookSession(quoteId)?.pendingFormState?.jobId}
          returnPath={effectiveReturnPath}
          initialLineItems={initialLineItems}
          initialPlanSheet={initialPlanSheet}
          templates={templates}
          castings={castings}
          pipeOpeningSizes={pipeOpeningSizes}
          diameterConfigs={diameterConfigs}
        />
      </div>
    </>
  );
}
