import type { ImportFileInfo } from "@/lib/job-import";

/** A dropped file, held in the browser until Import job sends it. */
export type ImportFileEntry = ImportFileInfo & {
  file: File;
  /** Page count for combined PDFs (read on drop); null otherwise. */
  pageCount: number | null;
};

export type ImportQuoteFields = {
  quoteNumber: string;
  /** yyyy-mm-dd */
  quoteDate: string;
  taxRate: string;
  /** The PDF's total, typed in to check the grid against. */
  totalCheck: string;
};
