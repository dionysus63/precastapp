"use client";

import { useMemo } from "react";
import { BackButton } from "@/components/dashboard/back-button";
import type {
  RectSheetCastingOption,
  RectSheetOpeningSizeOption,
  RectSheetTemplateOption,
} from "@/components/drill-sheets/rect-sheet-form";
import { RectStructureWorkbook } from "@/components/quotes/rect-structure-workbook/rect-structure-workbook";
import { readWorkbookSession } from "@/lib/quotes/structure-workbook";
import type { EditableQuoteLineItem } from "@/lib/quotes/types";

type RectStructureWorkbookPageClientProps = {
  quoteId?: string;
  jobId?: string | null;
  returnPath: string;
  serverLineItems?: EditableQuoteLineItem[];
  templates: RectSheetTemplateOption[];
  castings: RectSheetCastingOption[];
  openingSizes: RectSheetOpeningSizeOption[];
};

export function RectStructureWorkbookPageClient({
  quoteId,
  jobId,
  returnPath,
  serverLineItems = [],
  templates,
  castings,
  openingSizes,
}: RectStructureWorkbookPageClientProps) {
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
      <BackButton href={effectiveReturnPath} label="Back to Quote" />
      <div className="mt-4">
        <RectStructureWorkbook
          quoteId={quoteId}
          jobId={jobId ?? readWorkbookSession(quoteId)?.pendingFormState?.jobId}
          returnPath={effectiveReturnPath}
          initialLineItems={initialLineItems}
          templates={templates}
          castings={castings}
          openingSizes={openingSizes}
        />
      </div>
    </>
  );
}
