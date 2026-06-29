"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { DrillSheetTemplateOption } from "@/components/drill-sheets/drill-sheet-form";
import { StructureWorkbook } from "@/components/quotes/structure-workbook/structure-workbook";
import type { EditableQuoteLineItem } from "@/lib/quotes/types";
import { readWorkbookSession } from "@/lib/quotes/structure-workbook";
import type { StructureWorkbookOptions } from "@/lib/quotes/structure-workbook";

type StructureWorkbookPageClientProps = {
  quoteId?: string;
  returnPath: string;
  serverLineItems?: EditableQuoteLineItem[];
  templates: DrillSheetTemplateOption[];
  castings: StructureWorkbookOptions["castings"];
  pipeOpeningSizes: StructureWorkbookOptions["pipeOpeningSizes"];
  diameterConfigs: StructureWorkbookOptions["diameterConfigs"];
};

export function StructureWorkbookPageClient({
  quoteId,
  returnPath,
  serverLineItems = [],
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

  return (
    <>
      <Link
        href={returnPath}
        className="text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        ← Back to Quote
      </Link>
      <div className="mt-4">
        <StructureWorkbook
          quoteId={quoteId}
          returnPath={returnPath}
          initialLineItems={initialLineItems}
          templates={templates}
          castings={castings}
          pipeOpeningSizes={pipeOpeningSizes}
          diameterConfigs={diameterConfigs}
        />
      </div>
    </>
  );
}
