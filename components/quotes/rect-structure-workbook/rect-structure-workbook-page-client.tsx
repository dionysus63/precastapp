"use client";

import Link from "next/link";
import { useMemo } from "react";
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
  returnPath: string;
  serverLineItems?: EditableQuoteLineItem[];
  templates: RectSheetTemplateOption[];
  castings: RectSheetCastingOption[];
  openingSizes: RectSheetOpeningSizeOption[];
};

export function RectStructureWorkbookPageClient({
  quoteId,
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
      <Link
        href={effectiveReturnPath}
        className="text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        ← Back to Quote
      </Link>
      <div className="mt-4">
        <RectStructureWorkbook
          quoteId={quoteId}
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
