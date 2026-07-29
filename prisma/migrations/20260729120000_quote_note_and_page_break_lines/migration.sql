-- Presentation-only quote lines: NOTE renders as a full-width text row,
-- PAGE_BREAK starts a new page on the printed quote. Both are non-billable
-- like CATEGORY.
ALTER TYPE "QuoteLineType" ADD VALUE 'NOTE';
ALTER TYPE "QuoteLineType" ADD VALUE 'PAGE_BREAK';
