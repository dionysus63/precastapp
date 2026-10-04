-- Sheet PDF set files moved from git-tracked assets/templates/rect-pdf-sets
-- to git-ignored storage/rect-pdf-sets. filePath now stores the path
-- relative to that root ("<setId>/<variant>.pdf") instead of an absolute
-- path, which also broke when a database moved between C:\Projects and
-- C:\Apps checkouts.
UPDATE "RectSheetPdfSetFile"
SET "filePath" = "setId" || '/'
  || CASE WHEN "hasTopSlab" THEN 'topslab' ELSE 'notopslab' END
  || '-'
  || CASE WHEN "hasBaseSlab" THEN 'base' ELSE 'nobase' END
  || '.pdf';
