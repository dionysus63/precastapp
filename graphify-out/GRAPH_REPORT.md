# Graph Report - precastapp  (2026-10-04)

## Corpus Check
- 775 files · ~491,735 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 3, .mdc 2, .example 1)

## Summary
- 8897 nodes · 26522 edges · 207 communities (160 shown, 47 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 237 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b3649bb1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app/products/actions.ts
- rect-structure.ts
- pdf.worker.min.mjs
- Annotation
- XFAObject
- .getOperatorList
- structure-workbook.ts
- rect-structure-workbook.ts
- ContentObject
- rect-template-pdf.ts
- DeliveryTicketEditor
- .add
- drill-sheet-template-pdf.ts
- QuoteForm
- quote-form.tsx
- company-logo-raster.ts
- rect-sheet-detail.ts
- drill-sheets/pdf-actions.ts
- product-utils.ts
- product-kinds.ts
- compilerOptions
- .createDocumentHandler
- .getTextContent
- rect-sheet-persistence.ts
- Glyph
- OptionObject
- rich-text.ts
- galley-actions.ts
- delivery-ticket-pdf-line-items.ts
- drain-ring-matrix-utils.ts
- delivery-tickets/pdf-actions.ts
- drill-sheet-preview.tsx
- scripts
- job-detail-mapper.ts
- build
- LocaleSetNamespace
- sheet-pdfs/actions.ts
- quote-utils.ts
- daily-production-entry.tsx
- rect-pdf-set-service.ts
- drill-sheet.ts
- .success
- inventory/page.tsx
- CMap
- import/actions.ts
- drill-sheet-form.tsx
- shipping-zones-manager.tsx
- XMLParserBase
- auth/constants.ts
- dependencies
- customer-mapper.ts
- structures/actions.ts
- bulk-load-planner.tsx
- postcss.config.mjs
- customer-name-similarity.ts
- .getUint16
- quote-mapper.ts
- Handy Commands — Precast App
- devDependencies
- delivery-tickets/actions.ts
- delivery-ticket-utils.ts
- PsWasmCompiler
- quote-pdf-line-items.ts
- submittal-package.ts
- delivery-dispatch-utils.ts
- product-form.tsx
- delivery-ticket-pdf-data.ts
- confirm-dialog.tsx
- app-settings.ts
- pipe-modal.tsx
- job-sheet-import-actions.ts
- delivery-fulfillment.ts
- jobs/page.tsx
- randomId
- calibrate-rect-templates.ts
- AGENTS.md
- ProductDocumentsSection
- vitest
- jobs/actions.ts
- t
- ref_path
- .getBytes
- purchase-order-utils.ts
- job-structure-import-dialog.tsx
- withDatabaseRetry
- plan-sheet-actions.ts
- quotes/actions.ts
- AnnotationBorderStyle
- input.tsx
- Precast Ops desktop updates
- casting-ticket-lines.ts
- bid-actions.ts
- XmlObject
- ref_fs
- electron/package.json
- structure-workbook.tsx
- product-taxonomy.server.ts
- generate-invoice-templates.ts
- send-actions.ts
- XhtmlObject
- job-folders.ts
- files/actions.ts
- FormTypeahead
- SimpleGlyph
- windows-explorer.ts
- operations/actions.ts
- app/products/page.tsx
- session-keep-alive.tsx
- Office deployment — single Windows server + UNC job folders
- Office rollout checklist
- next
- react
- pipe-openings/actions.ts
- import-rect-sheet-pdfs.ts
- .get
- getStringOption
- delivery-schedule-pdf-html.ts
- app_generated_prisma_client_prismaclient
- Deployment server info checklist
- delivery-ticket-pdf-html.ts
- Troubleshooting
- unreachable
- structure-workbook-plan-takeoff.tsx
- Precast Ops
- copy-pdf-worker.mjs
- CipherTransformFactory
- printPdfUrl
- DeviceRgbCS
- JpegImage
- calculateSHA512
- app_generated_prisma_client_prisma
- drain-ring-utils.ts
- render-example-sheets.ts
- ring-builder-modal.tsx
- CalRGBCS
- rect-structure-import.ts
- quote-line-items-table.tsx
- build-id/route.ts
- template_Value
- signature_Signature
- main.mjs
- lexer_Lexer
- product-submittals-service.ts
- TextState
- .push
- ExclGroup
- ChunkedStream
- StringObject
- invoice-mapper.ts
- ToUnicodeMap
- FormatError
- test-db.ts
- .find
- NullOptimizer
- .#Ne
- package.json
- prisma.ts
- GlobalImageCache
- product-export.ts
- [...file]/route.ts
- structure-template-pdf-service.ts
- custom-structure-import.ts
- all/page.tsx
- ui
- product-mapper.ts
- generate-circular-import-template.mjs
- rect-bulk-grid.tsx
- .checkAndRepair
- ConfigNamespace
- LabCS
- xdp_Xdp
- SectionCard
- ColorSpace
- SingleIntersector
- process-app-icon.ps1
- Phase 6 — Electron client (staff PCs)
- warn
- allowScripts
- Security posture: internal, trusted-network tool
- MathClamp

## God Nodes (most connected - your core abstractions)
1. `withDatabaseRetry()` - 350 edges
2. `requirePermission()` - 336 edges
3. `XFAObject` - 208 edges
4. `next` - 201 edges
5. `SectionCard()` - 195 edges
6. `warn()` - 175 edges
7. `DashboardShell()` - 163 edges
8. `react` - 156 edges
9. `ConfigNamespace` - 141 edges
10. `reloadAfterAction()` - 137 edges

## Surprising Connections (you probably didn't know these)
- `Authentication today` --references--> `signInWithPassword()`  [INFERRED]
  AGENTS.md → app/login/actions.ts
- `Quote → JobStructure linking` --references--> `linkJobStructuresFromQuote()`  [INFERRED]
  docs/STRUCTURE_PRODUCTION_WORKFLOW.md → lib/job-structure-workflow.ts
- `handleDelete()` --calls--> `deleteCustomer()`  [EXTRACTED]
  components/customers/delete-customer-button.tsx → app/customers/actions.ts
- `JobsPage()` --indirect_call--> `mapJobToRow()`  [INFERRED]
  app/jobs/page.tsx → lib/job-mapper.ts
- `openDialog()` --calls--> `loadJobStructureImportOptions()`  [EXTRACTED]
  components/jobs/job-structure-import-dialog.tsx → app/jobs/structure-import-actions.ts

## Import Cycles
- None detected.

## Communities (207 total, 47 thin omitted)

### Community 0 - "app/products/actions.ts"
Cohesion: 0.08
Nodes (45): assertAllAssemblyComponentCodesExist(), BulkImportRow, bulkImportUpdateData(), collectAssemblyBomImportRows(), collectReferencedComponentCodes(), createFormProfileReader(), createProduct(), importProductsOrThrow() (+37 more)

### Community 1 - "rect-structure.ts"
Cohesion: 0.08
Nodes (41): SumpMode, annotateRectOpeningSections(), ComputedRectSection, computeHorizontalGeometry(), computeRectDefaultSumpFeet(), computeRectPricing(), computeRectStructure(), computeRectWallHeightFeet() (+33 more)

### Community 2 - "pdf.worker.min.mjs"
Cohesion: 0.01
Nodes (217): 14(), 291(), 750(), 981(), Ac, adjustWidths(), ah, al (+209 more)

### Community 5 - "XFAObject"
Cohesion: 0.01
Nodes (70): Arc, Assist, Barcode, Bind, BindItems, Bookend, Border, Break (+62 more)

### Community 6 - ".getOperatorList"
Cohesion: 0.03
Nodes (37): addCachedImageOps(), BrotliStream, CheckedOperatorList, EvalState, fetchBinaryData(), generateFont(), getColorConversionBatchSize(), getFamilyName() (+29 more)

### Community 7 - "structure-workbook.ts"
Cohesion: 0.12
Nodes (41): groupToneClasses(), pipeSizesForMaterial(), RowOpeningsEditor(), RowPenetrationsEditor(), StructureWorkbookGrid(), StructureWorkbookGridProps, uniquePipeMaterials(), applyDefaultsToBlankRow() (+33 more)

### Community 9 - "rect-structure-workbook.ts"
Cohesion: 0.07
Nodes (62): RectSheetCastingOption, RectSheetOpeningSizeOption, RectSheetTemplateOption, CompleteDrillSheetEntry, CompleteDrillSheetsClient(), handleCreate(), CompleteDrillSheetsClientProps, groupToneClasses() (+54 more)

### Community 10 - "ContentObject"
Cohesion: 0.02
Nodes (24): AlwaysEmbed, BehaviorOverride, BooleanElement, ContentObject, DateElement, DateTime, DateTimeSymbols, Decimal (+16 more)

### Community 11 - "rect-template-pdf.ts"
Cohesion: 0.05
Nodes (76): aboveFloorText(), fmtElevation(), InfoRow(), placementText(), RectSheetDetailView(), RectSheetDetailViewProps, Stat(), wholeInches() (+68 more)

### Community 12 - "DeliveryTicketEditor"
Cohesion: 0.05
Nodes (63): DeliveryTicketJobSearchOption, SaveDeliveryTicketInput, splitStructureForShipping(), unsplitStructure(), getQuoteFulfillmentWithOpenLoads(), DeliveryTicketEditor(), addExtraCustomLine(), addExtraProduct() (+55 more)

### Community 13 - ".add"
Cohesion: 0.02
Nodes (35): CFF, CFFCharset, CFFCompiler, CFFDict, CFFFDSelect, CFFHeader, CFFIndex, CFFOffsetTracker (+27 more)

### Community 14 - "drill-sheet-template-pdf.ts"
Cohesion: 0.06
Nodes (54): getStructureElevations(), flattenPdfForms(), applyTemplateFieldFonts(), baseSectionHeightFeet(), buildDiagramLayout(), buildDrillSheetFieldMap(), classifyDaFont(), consumeMarkerField() (+46 more)

### Community 15 - "QuoteForm"
Cohesion: 0.06
Nodes (54): loadJobCustomStructureImportCandidates(), toPlainNumberString(), createDefaultCustomStructureRow(), createLineId(), QuoteForm(), addCategoryLine(), addLineItem(), addLineItems() (+46 more)

### Community 16 - "quote-form.tsx"
Cohesion: 0.04
Nodes (58): QuoteSaveDestination, reloadQuoteFormPriceOptions(), collectRingOtherSubcategories(), formatJobAddress(), loadPipeProductsForQuoteForm(), loadQuoteFormPriceOptions(), mapPipeProductToQuoteOption(), mapServiceProductsToOptions() (+50 more)

### Community 17 - "company-logo-raster.ts"
Cohesion: 0.16
Nodes (21): convertPdfToPng(), IMAGE_MIME_TYPES, pathExists(), pathToLocalFileUrl(), rasterizeImageBufferToPng(), saveCompanyLogo(), seedLogoFromPdf(), writeLogoPngFromFile() (+13 more)

### Community 18 - "rect-sheet-detail.ts"
Cohesion: 0.09
Nodes (41): GET(), rectPreviewResponse(), RouteContext, deleteDrillSheet(), DrillSheetDetailPage(), DrillSheetDetailPageProps, loadJobSheetNav(), RectSheetDetail() (+33 more)

### Community 19 - "drill-sheets/pdf-actions.ts"
Cohesion: 0.15
Nodes (25): saveDeliverySchedulePdf(), generateDrillSheetPdf(), GenerateDrillSheetPdfResult, generateJobDrillSheetsPdf(), GenerateJobDrillSheetsPdfResult, generateRectSheetPdf(), SchedulePrintActions(), handleSave() (+17 more)

### Community 20 - "product-utils.ts"
Cohesion: 0.11
Nodes (17): bulkPasteColumnHeaders, bulkPasteExample, BulkProductPasteRow, productCastingOriginFilterOptions, productInputClassName, productStatusFilterOptions, productSubmittalsFilterOptions, productTypeFilterOptions (+9 more)

### Community 21 - "product-kinds.ts"
Cohesion: 0.08
Nodes (40): findExistingProductCodesAction(), importProducts(), BulkPasteForm(), handleImport(), handleParsePreview(), lookUpExistingCodes(), BulkPasteFormProps, formatMissingTaxonomySummary() (+32 more)

### Community 22 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 23 - ".createDocumentHandler"
Cohesion: 0.03
Nodes (27): 835(), AbortException, AnnotationFactory, arrayBuffersToBytes(), BasePdfManager, BasePDFStream, clearGlobalCaches(), LocalPdfManager (+19 more)

### Community 24 - ".getTextContent"
Cohesion: 0.08
Nodes (23): BaseLocalCache, EvaluatorPreprocessor, GlobalColorSpaceCache, isArrayEqual(), LocalGStateCache, LocalImageCache, LocalTilingPatternCache, addFakeSpaces() (+15 more)

### Community 25 - "rect-sheet-persistence.ts"
Cohesion: 0.06
Nodes (69): createDrillSheet(), createRectSheet(), updateDrillSheet(), updateRectSheet(), upgradeRectSheetFromPlaceholder(), loadPlaceholder(), NewRectSheetPage(), NewRectSheetPageProps (+61 more)

### Community 26 - "Glyph"
Cohesion: 0.12
Nodes (4): CompositeGlyph, GlyfTable, Glyph, GlyphHeader

### Community 27 - "OptionObject"
Cohesion: 0.02
Nodes (36): ADBE_JSConsole, ADBE_JSDebugger, AutoSave, config_Attributes, config_Type, config_Validate, Conformance, Destination (+28 more)

### Community 28 - "rich-text.ts"
Cohesion: 0.13
Nodes (22): handleAddCustomStructure(), RichTextContentProps, RichTextEditor(), applyCommand(), emitChange(), handlePaste(), RichTextEditorProps, getCompanyLogoDataUri() (+14 more)

### Community 29 - "galley-actions.ts"
Cohesion: 0.13
Nodes (26): injectGalleyFamilyOptions(), applyGalleyBreakdown(), ApplyGalleyBreakdownResult, BREAKDOWN_STATUSES, BreakdownDialog(), submit(), formatMixSummary(), GalleyBreakdownBanner() (+18 more)

### Community 30 - "delivery-ticket-pdf-line-items.ts"
Cohesion: 0.07
Nodes (49): COL_DESC_WIDTH, COL_DESC_X, COL_ITEM_NUM_WIDTH, COL_ITEM_NUM_X, COL_QTY_WIDTH, COL_QTY_X, DEFAULT_TABLE_LAYOUT, DeliveryTicketTableLayout (+41 more)

### Community 31 - "drain-ring-matrix-utils.ts"
Cohesion: 0.08
Nodes (37): DrainRingMatrixRows(), DrainRingMatrixRowsProps, DrainRingStyleTable(), DrainRingStyleTableProps, FEET_STAT_COLUMNS, ringStockClassName(), ringStockLabel(), allocateRingsForLoads() (+29 more)

### Community 32 - "delivery-tickets/pdf-actions.ts"
Cohesion: 0.10
Nodes (26): DeliveryTicketPdfPreviewResult, generateDeliveryTicketPdf(), GenerateDeliveryTicketPdfResult, getDeliveryTicketPdfPreviewBase64(), loadTicketForPdf(), printDeliveryTicketDirect(), PrintDeliveryTicketDirectResult, SaveDeliverySchedulePdfResult (+18 more)

### Community 33 - "drill-sheet-preview.tsx"
Cohesion: 0.11
Nodes (38): CalcRow(), DrillSheetPreview(), DrillSheetPreviewProps, feet(), HeaderRow(), PlanDiagram(), PreviewPanel(), angleToClockPosition() (+30 more)

### Community 34 - "scripts"
Cohesion: 0.11
Nodes (19): scripts, build, db:seed, db:sync-files, deploy:build, deploy:check, deploy:start, deploy:update (+11 more)

### Community 35 - "job-detail-mapper.ts"
Cohesion: 0.02
Nodes (151): updateJobCustomerAction(), updateJobStatusAction(), listCustomersForBidList(), JobTabContent(), JobTabContentProps, convertTicketToInvoice(), JobDrillSheetsPdfButtons(), ChevronIcon() (+143 more)

### Community 36 - "build"
Cohesion: 0.11
Nodes (18): build, appId, directories, extraResources, icon, nsis, productName, publish (+10 more)

### Community 37 - "LocaleSetNamespace"
Cohesion: 0.03
Nodes (24): CalendarSymbols, CurrencySymbol, CurrencySymbols, DatePattern, DatePatterns, Day, DayNames, Era (+16 more)

### Community 38 - "sheet-pdfs/actions.ts"
Cohesion: 0.18
Nodes (19): createSheetPdfSetAction(), deleteSheetPdfSetFileAction(), parseBooleanField(), renameSheetPdfSetAction(), revalidate(), uploadSheetPdfSetFileAction(), SHAPE_LABELS, SheetPdfSetCard() (+11 more)

### Community 39 - "quote-utils.ts"
Cohesion: 0.13
Nodes (26): CustomStructureCostBreakdown(), addItem(), CustomStructureCostBreakdownProps, CustomStructureDetailBreakdown(), CustomStructurePricingFooter(), CustomStructurePricingFooterProps, buildCreateQuoteInput(), calculateQuoteTotals() (+18 more)

### Community 40 - "daily-production-entry.tsx"
Cohesion: 0.18
Nodes (14): DailyProductionPage(), DailyProductionPageProps, DailyProductionEntry(), DailyProductionEntryProps, localToday(), shiftDate(), TaxonomyCategory, DailyProductionDayEntry (+6 more)

### Community 41 - "rect-pdf-set-service.ts"
Cohesion: 0.16
Nodes (13): deleteSheetPdfSetAction(), deleteRectPdfSetFile(), getLegacyRectPdfSetsRoot(), getRectPdfSetsRoot(), isMissingFile(), PDF_EXTENSIONS, readRectPdfSetFileBytes(), rectPdfSetRelativePath() (+5 more)

### Community 42 - "drill-sheet.ts"
Cohesion: 0.06
Nodes (48): DrillSheetPreviewMeta, annotateOpeningSections(), buildSolverHoles(), compareCost(), computeDefaultSumpFeet(), ComputedOpening, computeDrillSheet(), ComputedSection (+40 more)

### Community 43 - ".success"
Cohesion: 0.05
Nodes (39): applyAssist(), ariaLabel(), Caption, CheckButton, checkDimensions(), ChoiceList, computeBbox(), Corner (+31 more)

### Community 44 - "inventory/page.tsx"
Cohesion: 0.03
Nodes (134): AGGREGATE_SORT_COLUMNS, CONTACT_SORT_COLUMNS, ContactSortColumn, CUSTOMER_SORT_FIELDS, CustomerSortColumn, CustomersPage(), isAggregateSortColumn(), loadCustomerAggregates() (+126 more)

### Community 46 - "import/actions.ts"
Cohesion: 0.11
Nodes (35): buildCastingResolver(), CastingResolution, importPipeOpenings(), importRectOpenings(), ImportRowInput, ImportRowMessage, importStructureTemplates(), importTemplates() (+27 more)

### Community 47 - "drill-sheet-form.tsx"
Cohesion: 0.10
Nodes (25): buildCommittedPreview(), CommittedOpeningNumbers, CommittedPreviewNumbers, connectionOptions, createOpening(), DiameterConfigOption, DrillSheetCastingOption, DrillSheetForm() (+17 more)

### Community 48 - "shipping-zones-manager.tsx"
Cohesion: 0.06
Nodes (58): createShippingZone(), deleteShippingZone(), revalidateShippingZonePaths(), setYardLocation(), ShippingZoneInput, updateShippingZone(), ValidatedZone, validateZoneInput() (+50 more)

### Community 50 - "XMLParserBase"
Cohesion: 0.06
Nodes (7): DatasetXMLParser, MetadataParser, SimpleDOMNode, SimpleXMLParser, XFAParser, XMLParserBase, skipWs()

### Community 51 - "auth/constants.ts"
Cohesion: 0.05
Nodes (65): SimilarCustomerMatch, searchCustomersForJobForm(), ProfilePage(), EditSettingsUserPage(), EditSettingsUserPageProps, SettingsUsersPage(), CustomerFormProps, CustomerFormValues (+57 more)

### Community 52 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, leaflet, next, nodemailer, pdf-lib, @pdf-lib/fontkit, pdf-to-printer, pdfjs-dist (+11 more)

### Community 53 - "customer-mapper.ts"
Cohesion: 0.04
Nodes (83): addCustomerContact(), BulkContactDbState, BulkContactImportRow, CONTACT_ROLES, CustomerContactInput, deleteCustomerContact(), importContacts(), importContactsOrThrow() (+75 more)

### Community 54 - "structures/actions.ts"
Cohesion: 0.13
Nodes (27): assertDiametersHaveMolds(), createStructureTemplate(), deleteStructureTemplate(), duplicateStructureTemplate(), handlePrismaError(), parseTemplatePayload(), resolvePriceListIdForTemplateSave(), saveRectPriceEntry() (+19 more)

### Community 55 - "bulk-load-planner.tsx"
Cohesion: 0.07
Nodes (53): DeliveryTicketLineInput, discardSavedLoadPlan(), PlannedLoadInput, saveLoadPlanForLater(), savePlannedLoads(), SavePlannedLoadsInput, buildRows(), BulkLoadPlanner() (+45 more)

### Community 57 - "customer-name-similarity.ts"
Cohesion: 0.19
Nodes (16): checkBulkCustomerDbDuplicates(), BulkPasteForm(), handleImport(), handleParsePreview(), compactCustomerName(), compactSimilarity(), CustomerNameCandidate, findSimilarCustomers() (+8 more)

### Community 64 - ".getUint16"
Cohesion: 0.15
Nodes (18): buildComponentData(), decodeScan(), decodeBlock(), decodeHuffman(), decodeMcu(), readBit(), receive(), receiveAndExtend() (+10 more)

### Community 65 - "quote-mapper.ts"
Cohesion: 0.11
Nodes (24): formatQuoteYards(), formatYards(), bidDueUrgencyFor(), deriveOriginalQuoteNumber(), deriveSupersededBy(), formatLineNotes(), formatQuoteDate(), formatQuoteDateLong() (+16 more)

### Community 66 - "Handy Commands — Precast App"
Cohesion: 0.15
Nodes (13): App (Next.js), Browse data, Daily workflow, Database backups, Electron desktop client, Git / GitHub (optional), Handy Commands — Precast App, Office deployment (Windows server) (+5 more)

### Community 67 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, electron, electron-builder, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx (+8 more)

### Community 68 - "delivery-tickets/actions.ts"
Cohesion: 0.06
Nodes (39): assertQuoteLinkable(), buildLineCreates(), buildLinesPayload(), createDeliveryTicket(), DeliveryTicketActionResult, generateDeliveryTicketSubmittalPackage(), GenerateTicketSubmittalResult, parseDate() (+31 more)

### Community 69 - "delivery-ticket-utils.ts"
Cohesion: 0.09
Nodes (25): deliveryDateFilterOptions, DeliveryFilterOptions, deliveryTicketCustomerOptions, DeliveryTicketDetailLineItem, DeliveryTicketDetailView, deliveryTicketDriverOptions, DeliveryTicketFormLineItem, deliveryTicketInputClassName (+17 more)

### Community 70 - "PsWasmCompiler"
Cohesion: 0.06
Nodes (21): ast_Parser, encodeASCIIString(), _nodesEqual(), PsArgNode, PsBinaryNode, PsBlock, PsConstNode, PsIf (+13 more)

### Community 71 - "quote-pdf-line-items.ts"
Cohesion: 0.09
Nodes (43): isWinAnsi(), toWinAnsiText(), COL_DESC_WIDTH, COL_DESC_X, COL_ITEM_NUM_WIDTH, COL_ITEM_NUM_X, COL_QTY_WIDTH, COL_QTY_X (+35 more)

### Community 72 - "submittal-package.ts"
Cohesion: 0.12
Nodes (26): getSubmittalsJobSubfolder(), dedupeSharedPdfObjects(), isSkipped(), rewriteRefs(), SKIP_TYPES, structuralKey(), TYPE_KEY, buildSubmittalPackageBaseName() (+18 more)

### Community 73 - "delivery-dispatch-utils.ts"
Cohesion: 0.23
Nodes (12): DispatcherWeekCalendar, DispatcherWeekCalendarProps, getReferenceDateForWeekOffset(), DISPATCH_STATUSES, formatWeekRangeLabel(), getDispatchDays(), getTodaysScheduledLoads(), groupTicketsByDeliveryDate() (+4 more)

### Community 74 - "product-form.tsx"
Cohesion: 0.08
Nodes (25): CastingComponentPickerOption, CastingSupplierOption, drainRingDiameterOptions, ProductFormProps, ProductFormValues, AdsPipeJointType, adsPipeJointTypeFormOptions, adsPipeJointTypeLabels (+17 more)

### Community 75 - "delivery-ticket-pdf-data.ts"
Cohesion: 0.06
Nodes (57): blankOr(), buildDeliveryTicketFormData(), computeTotalPieces(), DbCustomer, DbDeliveryTicketForPdf, DbJob, DELIVERY_TICKET_PDF_INCLUDE, DeliveryTicketContentPage (+49 more)

### Community 76 - "confirm-dialog.tsx"
Cohesion: 0.10
Nodes (22): GlobalError(), isStaleDeploymentError(), RootLayout(), NotFound(), DeleteCustomerButton(), handleDelete(), DeleteCustomerButtonProps, AppProviders() (+14 more)

### Community 77 - "app-settings.ts"
Cohesion: 0.03
Nodes (133): GET(), DeliveryTicketPreviewPage(), DeliveryTicketPreviewPageProps, PREVIEW_ORIGINS, geistMono, geistSans, generateMetadata(), QuoteDetailPage() (+125 more)

### Community 78 - "pipe-modal.tsx"
Cohesion: 0.12
Nodes (28): createDefaultQuoteRow(), createRowId(), PipeModal(), handleAddQuoteLines(), handleAddUnitPricesToDescription(), handleClose(), resetModal(), PipeModalMode (+20 more)

### Community 79 - "job-sheet-import-actions.ts"
Cohesion: 0.21
Nodes (12): JobCustomStructureImportCandidate, JobSheetImportCandidates, loadJobSheetImportCandidates(), STATUS_LABELS, DecimalLike, decimalToInput(), lowestInvertText(), mapCircularSheetToWorkbookRow() (+4 more)

### Community 80 - "delivery-fulfillment.ts"
Cohesion: 0.10
Nodes (42): validateLines(), getQuoteFulfillmentForTicket(), normalizeAdsPipeJointType(), loadCastingComponentOptionsByAssembly(), loadCastingComponentOptionsForAssembly(), AdsPipeOption, allLineageIds(), buildFulfillmentFromContext() (+34 more)

### Community 81 - "jobs/page.tsx"
Cohesion: 0.20
Nodes (12): JobDetailPage(), JobDetailPageProps, resolveTab(), VALID_TABS, buildJobOrderBy(), JOB_LIST_SELECT, JOB_SORT_FIELDS, JobSortColumn (+4 more)

### Community 82 - "randomId"
Cohesion: 0.04
Nodes (75): saveProductionEntry(), createRow(), ProductionEntryForm(), addLine(), handleSubmit(), ProductionEntryFormProps, ProductionLineRow, ProductOption (+67 more)

### Community 83 - "calibrate-rect-templates.ts"
Cohesion: 0.09
Nodes (25): Align, ALIGNMENTS, BLACK, calibrateVariant(), EXPLODED_SPECS, extractTextItems(), findItem(), HEADER_SPECS (+17 more)

### Community 84 - "AGENTS.md"
Cohesion: 0.38
Nodes (4): Codebase exploration: use graphify first, Prisma / Database Rules, Project context, This is NOT the Next.js you know

### Community 85 - "ProductDocumentsSection"
Cohesion: 0.20
Nodes (14): deleteProductDocumentAction(), openProductDocument(), openProductSubmittalsFolder(), scanProductDocumentsAction(), uploadProductDocumentAction(), InventorySubmittalsCell(), handleOpen(), InventorySubmittalsCellProps (+6 more)

### Community 86 - "vitest"
Cohesion: 0.07
Nodes (36): computePreviewTotals(), Decimal, DecimalInstance, DecimalLike, toDecimal(), batchConvertDeliveredTicketsToInvoices(), BatchInvoiceConversionResult, CastingSetCharge (+28 more)

### Community 87 - "jobs/actions.ts"
Cohesion: 0.06
Nodes (59): BulkImportRow, createCustomer(), CUSTOMER_STATUSES, CustomerRecordInput, deleteCustomer(), findSimilarCustomers(), importCustomers(), importCustomersOrThrow() (+51 more)

### Community 88 - "t"
Cohesion: 0.07
Nodes (17): 463(), 812(), 837(), 944(), Binder, createDataNode(), createText(), DataHandler (+9 more)

### Community 89 - "ref_path"
Cohesion: 0.13
Nodes (22): openJobStructureDocument(), handleOpenDocument(), pathExists(), resolveUniqueFilePath(), assertPathUnderJobFolder(), assertPathUnderRoot(), normalizePath(), pathsEqual() (+14 more)

### Community 90 - ".getBytes"
Cohesion: 0.03
Nodes (30): Ascii85Stream, AsciiHexStream, bytesToString(), CCITTFaxStream, CipherTransform, Cmd, DecodeStream, decrypt() (+22 more)

### Community 91 - "purchase-order-utils.ts"
Cohesion: 0.19
Nodes (7): mapPurchaseOrderDetail(), mapPurchaseOrderListRow(), PoWithVendor, parsePurchaseOrderStatus(), purchaseOrderStatusFormOptions, purchaseOrderStatusLabels, purchaseOrderStatusVariant()

### Community 92 - "job-structure-import-dialog.tsx"
Cohesion: 0.10
Nodes (33): JobStructureImportEntry, JobStructureImportResult, buildPreview(), Cell, detectShape(), ImportOptions, JobStructureImportButton(), handleFile() (+25 more)

### Community 93 - "withDatabaseRetry"
Cohesion: 0.04
Nodes (98): GET(), checkBulkContactDbState(), searchCustomersForWalkInTicket(), searchJobsForDeliveryTicket(), updateTicketDriver(), updateTicketTrailer(), syncAllFiles(), BulkEditPageProps (+90 more)

### Community 94 - "plan-sheet-actions.ts"
Cohesion: 0.12
Nodes (31): GET(), RouteContext, getPlanSheetForOpen(), listJobConstructionPlanPdfs(), mapPlanSheetRow(), pathExists(), savePlanSheetMarkup(), selectJobPlanSheet() (+23 more)

### Community 95 - "quotes/actions.ts"
Cohesion: 0.05
Nodes (65): assertGalleyFamiliesExist(), computeQuoteFinancials(), createQuote(), CreateQuoteInput, CreateQuoteLineItemInput, DeleteQuoteResult, isQuoteNumberConflict(), parseOptionalDate() (+57 more)

### Community 97 - "input.tsx"
Cohesion: 0.40
Nodes (3): inputClassName, InputProps, textareaClassName

### Community 98 - "Precast Ops desktop updates"
Cohesion: 0.40
Nodes (4): Precast Ops desktop updates, Publish a desktop update (from the dev PC), Verify (from any office PC), Which machine does what

### Community 99 - "casting-ticket-lines.ts"
Cohesion: 0.23
Nodes (8): CastingCollapseMeta, CastingCollapsibleLine, CastingExplodeComponent, CastingExplodedPiece, collapseCastingTicketLines(), perSetByProduct(), setWeightFor(), META

### Community 100 - "bid-actions.ts"
Cohesion: 0.17
Nodes (18): addJobBidder(), awardJob(), generateQuotesFromMaster(), removeJobBidder(), buildContactMapForGenerate(), buildDefaultContactMap(), JobBiddingPanel(), handleAddBidder() (+10 more)

### Community 101 - "XmlObject"
Cohesion: 0.04
Nodes (9): Builder, Datasets, datasets_Data, DatasetsNamespace, Empty, Root, UnknownNamespace, XFAAttribute (+1 more)

### Community 102 - "ref_fs"
Cohesion: 0.05
Nodes (60): buildContentPageBytes(), fillAcroFormFields(), fitTermsField(), getDeliveryTicketPdfFillOptions(), HEADER_BAND_GREY, redrawDriverLabel(), drawLineItemsOnPage(), DrillSheetPdfBuildResult (+52 more)

### Community 104 - "electron/package.json"
Cohesion: 0.18
Nodes (10): author, dependencies, electron-updater, description, main, name, private, productName (+2 more)

### Community 105 - "structure-workbook.tsx"
Cohesion: 0.10
Nodes (30): JobSheetImportCandidate, PlanSheetRecord, DrillSheetTemplateOption, JobSheetImportDialog(), JobSheetImportDialogProps, pipeSizesForMaterial(), StructureWorkbookDefaultsPanel(), StructureWorkbookDefaultsPanelProps (+22 more)

### Community 106 - "product-taxonomy.server.ts"
Cohesion: 0.14
Nodes (22): chipClassName(), StockProductPicker(), StockProductPickerProps, ensureTaxonomyForBulkImport(), fetchActiveProductTaxonomy(), resolveTaxonomyByNamesForImport(), validateTaxonomySelection(), analyzeTaxonomyByNames() (+14 more)

### Community 108 - "generate-invoice-templates.ts"
Cohesion: 0.12
Nodes (25): CONT_TABLE_BOTTOM_Y, MAIN_TABLE_BOTTOM_Y, addTextField(), BLACK, BOTTOM_BOX, buildTemplate(), Ctx, drawBox() (+17 more)

### Community 110 - "send-actions.ts"
Cohesion: 0.07
Nodes (56): findSupersededBy(), getSendQuoteDefaults(), getSendQuoteEmailConfigured(), OpenOutlookDraftResult, openQuoteInOutlook(), sendQuote(), SendQuoteDefaults, SendQuoteInput (+48 more)

### Community 111 - "XhtmlObject"
Cohesion: 0.04
Nodes (18): B, Body, Br, hl, Html, $i, layoutText(), li (+10 more)

### Community 112 - "job-folders.ts"
Cohesion: 0.42
Nodes (8): getJobSubfolders(), buildJobFolderBaseName(), createJobFoldersForJob(), createJobFolderStructure(), isFolderPathTakenByAnotherJob(), pathExists(), resolveJobFolderPath(), sanitizeFolderName()

### Community 114 - "files/actions.ts"
Cohesion: 0.06
Nodes (56): ExplorerOpenResult, getJobFilesForBrowser(), listJobFilesAction(), listJobsMissingFolders(), listRecentFiles(), openJobFile(), openJobFolderCategory(), revalidateFilesPaths() (+48 more)

### Community 115 - "FormTypeahead"
Cohesion: 0.43
Nodes (6): FormTypeahead(), closeDropdown(), handleContainerBlur(), handleKeyDown(), handleSelect(), FormTypeaheadProps

### Community 118 - "windows-explorer.ts"
Cohesion: 0.10
Nodes (34): ClientPathMapping, getClientPathMappings(), stripTrailingSeparators(), toClientOpenPath(), translateToClientPath(), assertDirectoryExists(), assertFileExists(), assertPathAccessible() (+26 more)

### Community 119 - "operations/actions.ts"
Cohesion: 0.03
Nodes (101): approveStructureForProduction(), BULK_STRUCTURE_STATUSES, bulkDeleteJobStructures(), bulkSetJobStructureStatuses(), BulkStructureStatus, cancelTicketFromReconcile(), collectDeliveredUninvoicedTicketIds(), confirmDeliveryDayReconciliation() (+93 more)

### Community 120 - "app/products/page.tsx"
Cohesion: 0.14
Nodes (26): DetailField(), ProductDetailPage(), ProductDetailPageProps, buildProductOrderBy(), PRODUCT_SORT_COLUMNS, ProductSortColumn, ProductsPage(), VALID_PRODUCT_STATUSES (+18 more)

### Community 121 - "session-keep-alive.tsx"
Cohesion: 0.52
Nodes (5): keepSessionAlive(), recordPing(), SessionKeepAlive(), ping(), shouldPing()

### Community 122 - "Office deployment — single Windows server + UNC job folders"
Cohesion: 0.11
Nodes (18): Architecture, End-to-end smoke test, Firewall, Important behavior, Install prerequisites, Office deployment — single Windows server + UNC job folders, Ongoing maintenance, Phase 1 — Prepare the Windows server (+10 more)

### Community 123 - "Office rollout checklist"
Cohesion: 0.12
Nodes (17): 1. Server URL for the desktop app, 2. First install on each staff PC, 3. Staff expectations, 4. Role walkthrough (recommended), 5. Backups, 6. Support contacts, 7. Post-rollout verification (first week), Database (nightly recommended) (+9 more)

### Community 124 - "next"
Cohesion: 0.04
Nodes (94): GET(), parseCopyParam(), RouteContext, GET(), RouteContext, GET(), GET(), parseDateParam() (+86 more)

### Community 125 - "react"
Cohesion: 0.04
Nodes (93): updateDeliveryTicketStatus(), createJobFolder(), openJobStructureSubmittalsFolder(), uploadJobStructureDocumentAction(), importCustomJobStructures(), linkStructuresForWonQuote(), deleteQuote(), setQuoteTaxExempt() (+85 more)

### Community 126 - "pipe-openings/actions.ts"
Cohesion: 0.53
Nodes (5): combinedMaterial(), decimal(), parsePipeOpeningsPayload(), PipeOpeningPayload, savePipeOpeningSizes()

### Community 127 - "import-rect-sheet-pdfs.ts"
Cohesion: 0.19
Nodes (16): RECT_TOP_SLAB_MARKER_FIELD, rectTemplateVariantKey(), BLACK, dumpVariant(), ELEVATION_WALLS_X, enrichVariant(), main(), markersForVariant() (+8 more)

### Community 128 - ".get"
Cohesion: 0.03
Nodes (44): ButtonWidgetAnnotation, addPageDict(), appendIfJavaScriptDict(), parseNestedOrder(), parseOnOff(), parseOrder(), _collectAction(), collectActions() (+36 more)

### Community 129 - "getStringOption"
Cohesion: 0.03
Nodes (24): Acrobat, BatchOutput, Color, Common, Compress, Config, config_Area, Data (+16 more)

### Community 130 - "delivery-schedule-pdf-html.ts"
Cohesion: 0.19
Nodes (18): DeliveryScheduleTicket, JobDeliverySchedule, SCHEDULE_TICKET_SELECT, buildDeliverySchedulePdfHtml(), DeliveryScheduleVariant, escapeHtml(), formatDeliveryAddress(), formatFriendlyDate() (+10 more)

### Community 131 - "app_generated_prisma_client_prismaclient"
Cohesion: 0.15
Nodes (17): DEFAULT_APP_SETTINGS_DATA, DEFAULT_SEED_LOGO_PDF_PATH, decodeApiKey(), PrismaDevPayload, resolveDatabaseUrl(), resolvePrismaDevPayload(), resolveShadowDatabaseUrl(), databaseUrl (+9 more)

### Community 134 - "Deployment server info checklist"
Cohesion: 0.22
Nodes (9): Database, Deployment server info checklist, Electron client, File shares (UNC), Network, PDF generation, Post-deploy verification, Server (+1 more)

### Community 136 - "delivery-ticket-pdf-html.ts"
Cohesion: 0.17
Nodes (19): CompanyProfile, getCompanyProfile(), DeliveryTicketPdfView, getDeliveryTicketCopyTitles(), addressBlockHtml(), buildDeliveryTicketPdfHtml(), escapeHtml(), optionalNote() (+11 more)

### Community 137 - "Troubleshooting"
Cohesion: 0.33
Nodes (6): `P1001` — Can't reach database server, Password authentication failed, Port 3000 already in use, Prisma Studio — "Could not load schema metadata", Quote PDF — "Could not find Chrome" / browser not found, Troubleshooting

### Community 138 - "unreachable"
Cohesion: 0.04
Nodes (14): BasePDFStreamRangeReader, BasePDFStreamReader, BaseShading, BaseStream, buildMeshVertexData(), DummyShading, FunctionBasedShading, getB() (+6 more)

### Community 139 - "structure-workbook-plan-takeoff.tsx"
Cohesion: 0.11
Nodes (27): pipeSizesForMaterial(), uniquePipeMaterials(), bearingFromDelta(), commitRow(), DragState, pdfToScreen(), PipePopup(), polarToScreenPoint() (+19 more)

### Community 141 - "Precast Ops"
Cohesion: 0.40
Nodes (5): Desktop shell (optional), Local development, Office deployment, Precast Ops, Project docs

### Community 142 - "copy-pdf-worker.mjs"
Cohesion: 0.33
Nodes (4): projectRoot, scriptDir, workerSource, workerTarget

### Community 150 - "CipherTransformFactory"
Cohesion: 0.22
Nodes (5): ARCFourCipher, calculateMD5(), CipherTransformFactory, PasswordException, writeObject()

### Community 151 - "printPdfUrl"
Cohesion: 0.07
Nodes (39): printDeliveryTicketSubmittalsDirect(), DraftBatchPreviewPage(), DeliveryTicketSubmittalPdfCanvasPreview(), renderPage(), DeliveryTicketSubmittalPdfCanvasPreviewProps, getDeliveryTicketSubmittalPreviewPrintUrl(), DeliveryTicketSubmittalPreviewContent(), handlePrint() (+31 more)

### Community 154 - "calculateSHA512"
Cohesion: 0.09
Nodes (16): AES128Cipher, AES256Cipher, AESBaseCipher, calculateSHA384(), calculateSHA512(), ch(), littleSigma(), littleSigmaPrime() (+8 more)

### Community 155 - "app_generated_prisma_client_prisma"
Cohesion: 0.04
Nodes (90): InventoryProductSearchOption, resolveReceivingCategory(), saveInventoryAdjustment(), savePurchaseReceipt(), searchInventoryProducts(), InventoryReceiptsPage(), InventoryReceiptsPageProps, saveDailyProductionDay() (+82 more)

### Community 156 - "drain-ring-utils.ts"
Cohesion: 0.15
Nodes (16): ProductForm(), handleCategoryChange(), handleProductKindChange(), handleProductTypeChange(), handleRingDiameterChange(), assertSanitaryDrainRingAllowed(), diameterSupportsSanitaryDrainRing(), DRAIN_RING_SANITARY_DIAMETERS (+8 more)

### Community 157 - "render-example-sheets.ts"
Cohesion: 0.18
Nodes (12): puppeteer, findBrowser(), HTML_PATH, main(), EXAMPLES, findBrowser(), HTML(), main() (+4 more)

### Community 158 - "ring-builder-modal.tsx"
Cohesion: 0.07
Nodes (56): RingBuilderModal, createDefaultHeightPoolRow(), createRowId(), formatRingBuilderUnitPrice(), HeightPoolRow, initOtherInputs(), OtherProductInput, OtherSection() (+48 more)

### Community 160 - "rect-structure-import.ts"
Cohesion: 0.14
Nodes (21): RectImportDialog(), handleFile(), handlePasteParse(), RectImportDialogProps, Cell, cellText(), findHeaderRow(), gridFromTsv() (+13 more)

### Community 161 - "quote-line-items-table.tsx"
Cohesion: 0.09
Nodes (32): DeliveryTicketDetailContent(), DeliveryTicketDetailContentProps, formatLineType(), isBlank(), OptionalField(), paymentMethodLabel(), PickupInfo, RELATED_PLACEHOLDERS (+24 more)

### Community 162 - "build-id/route.ts"
Cohesion: 0.67
Nodes (3): dynamic, GET(), readBuildId()

### Community 163 - "template_Value"
Cohesion: 0.11
Nodes (5): Draw, Field, Image, _setValue(), template_Value

### Community 165 - "main.mjs"
Cohesion: 0.11
Nodes (29): __dirname, getUserConfigPath(), loadConfig(), readJsonFile(), validateServerUrl(), buildApplicationMenu(), checkForNewServerBuild(), clearWebCache() (+21 more)

### Community 168 - "product-submittals-service.ts"
Cohesion: 0.15
Nodes (28): saveUploadedPlanPdf(), getStockSubmittalsRoot(), sanitizeFileName(), buildPlanSheetBaseName(), PLAN_SHEET_FALLBACK_DIR, PLAN_SHEET_JOB_SUBFOLDER, resolvePlanSheetDirectory(), assertPathUnderStockSubmittalsRoot() (+20 more)

### Community 172 - ".push"
Cohesion: 0.03
Nodes (54): addChildren(), buildHuffmanTable(), CaretAnnotation, ChoiceWidgetAnnotation, ChunkedStreamManager, CircleAnnotation, core_utils_numberToString(), createImage() (+46 more)

### Community 173 - "ExclGroup"
Cohesion: 0.06
Nodes (9): addHTML(), Area, createLine(), ExclGroup, flushHTML(), getAvailableSpace(), getContainedChildren(), Subform (+1 more)

### Community 175 - "StringObject"
Cohesion: 0.02
Nodes (43): Amd, AppearanceFilter, Base, Certificate, config_Picture, connection_set_Uri, ConnectionSet, ConnectionSetNamespace (+35 more)

### Community 176 - "invoice-mapper.ts"
Cohesion: 0.53
Nodes (5): formatDate(), formatMoney(), InvoiceDetailView, mapDbInvoiceToDetailView(), statusVariant()

### Community 179 - "FormatError"
Cohesion: 0.04
Nodes (35): addHex(), BinaryCMapReader, BinaryCMapStream, buildPostScriptWasmFunction(), createBuiltInCMap(), expectInt(), expectString(), extendCMap() (+27 more)

### Community 180 - "test-db.ts"
Cohesion: 0.46
Nodes (4): globalSetup(), url, assertIsTestDatabaseUrl(), getTestDatabaseUrl()

### Community 181 - ".find"
Cohesion: 0.11
Nodes (6): FontFinder, FontInfo, FontSelector, makeObj(), PageSet, stripQuotes()

### Community 186 - "package.json"
Cohesion: 0.08
Nodes (24): eslintConfig, main, name, postcss, overrides, @hono/node-server, next, private (+16 more)

### Community 187 - "prisma.ts"
Cohesion: 0.04
Nodes (109): BulkCustomersPage(), BulkContactsPage(), EditCustomerPage(), EditCustomerPageProps, CustomerNotFound(), NewCustomerPage(), listStockProductsForTicket(), EDIT_ORIGINS (+101 more)

### Community 189 - "product-export.ts"
Cohesion: 0.11
Nodes (23): GET(), customerStatusFormOptions, buildCustomersExportBuffer(), customerExportHeaders, customerStatusLabels, CustomerWithContacts, mapCustomerToExportRow(), roleContactName() (+15 more)

### Community 190 - "[...file]/route.ts"
Cohesion: 0.33
Nodes (3): CONTENT_TYPES, RouteContext, UPDATES_DIR

### Community 191 - "structure-template-pdf-service.ts"
Cohesion: 0.40
Nodes (8): assertPathUnderRoot(), deleteTemplatePdf(), getStructureTemplatePdfsRoot(), readTemplatePdfBytes(), StructureTemplatePdfRecord, TemplatePdfVariant, main(), uniqueSetName()

### Community 196 - "custom-structure-import.ts"
Cohesion: 0.19
Nodes (14): Cell, cellText(), ColumnMap, customGridFromTsv(), CustomImportEntry, CustomImportIssue, CustomImportResult, CustomImportRow (+6 more)

### Community 197 - "all/page.tsx"
Cohesion: 0.14
Nodes (20): AllDeliveryTicketsPage(), startOfToday(), VALID_DELIVERY_STATUSES, DeliveryTicketsPage(), startOfToday(), ACTIVE_PICKUP_STATUSES, formatDate(), toRow() (+12 more)

### Community 204 - "product-mapper.ts"
Cohesion: 0.15
Nodes (19): ProductRow, formatProductKindBadgeLabel(), categoryVariant(), documentTypeLabel(), formatDecimal(), formatDocumentDate(), formatFileSize(), formatYesNo() (+11 more)

### Community 209 - "generate-circular-import-template.mjs"
Cohesion: 0.05
Nodes (30): colWidths, EXAMPLE_ROWS, exampleSheet, HEADERS, INSTRUCTIONS, instructionsSheet, outDir, outPath (+22 more)

### Community 227 - "rect-bulk-grid.tsx"
Cohesion: 0.07
Nodes (54): BulkSheetRowInput, BulkSheetRowResult, RectOpeningField, RectSheetFormValues, circularPayloadFromValues(), rectPayloadFromValues(), focusGridCell(), formatBrickInches() (+46 more)

### Community 242 - ".checkAndRepair"
Cohesion: 0.05
Nodes (32): adjustMapping(), Ai, amendFallbackToUnicode(), CFFFont, convertCidString(), createCmapTable(), createNameTable(), createOS2Table() (+24 more)

### Community 243 - "ConfigNamespace"
Cohesion: 0.01
Nodes (66): Acrobat7, AddSilentPrint, AddViewerPreferences, AdjustData, AdobeExtensionLevel, Agent, Cache, Change (+58 more)

### Community 248 - "LabCS"
Cohesion: 0.14
Nodes (3): CalGrayCS, DeviceCmykCS, LabCS

### Community 260 - "SectionCard"
Cohesion: 0.05
Nodes (103): where, ProductInventoryPage(), ProductInventoryPageProps, CompactTable(), Home(), CastingSuppliersPage(), CastingSuppliersPageProps, PriceListDetailPage() (+95 more)

### Community 261 - "ColorSpace"
Cohesion: 0.09
Nodes (5): AlternateCS, ColorSpace, DeviceGrayCS, DeviceRgbaCS, PatternCS

### Community 311 - "Phase 6 — Electron client (staff PCs)"
Cohesion: 0.25
Nodes (8): A. Server app updates (quotes, jobs, UI — most changes), B. Desktop shell updates (Electron auto-update), Build the installer, C. Server URL change only, Client updates (auto-update from server), Install on each desk PC, Local development with Electron, Phase 6 — Electron client (staff PCs)

### Community 315 - "warn"
Cohesion: 0.03
Nodes (24): AppearanceStreamEvaluator, Catalog, addPageError(), CmykICCBasedCS, ColorSpaceUtils, createValidAbsoluteUrl(), DatasetReader, decodeString() (+16 more)

### Community 330 - "allowScripts"
Cohesion: 0.25
Nodes (8): allowScripts, electron@35.7.5, esbuild@0.28.1, prisma@7.8.0, @prisma/engines@7.8.0, puppeteer@25.1.0, sharp@0.34.5, unrs-resolver@1.12.2

### Community 333 - "Security posture: internal, trusted-network tool"
Cohesion: 0.67
Nodes (3): Authentication today, Authorization, Security posture: internal, trusted-network tool

### Community 336 - "MathClamp"
Cohesion: 0.05
Nodes (15): convertBlackAndWhiteToRGBA(), convertToRGBA(), ImageResizer, IndexedCS, isDefaultDecodeHelper(), JBig2CCITTFaxImage, Jbig2Error, JpxError (+7 more)

## Knowledge Gaps
- **1363 isolated node(s):** `dynamic`, `RouteContext`, `RouteContext`, `RouteContext`, `RouteContext` (+1358 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 2410 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **47 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `reloadAfterAction()` connect `react` to `SectionCard`, `app_generated_prisma_client_prisma`, `galley-actions.ts`, `quote-line-items-table.tsx`, `job-detail-mapper.ts`, `sheet-pdfs/actions.ts`, `daily-production-entry.tsx`, `inventory/page.tsx`, `import/actions.ts`, `shipping-zones-manager.tsx`, `auth/constants.ts`, `delivery-tickets/actions.ts`, `app-settings.ts`, `randomId`, `ProductDocumentsSection`, `job-structure-import-dialog.tsx`, `bid-actions.ts`, `files/actions.ts`, `operations/actions.ts`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `TemplateNamespace` connect `XFAObject` to `.get`, `getStringOption`, `pdf.worker.min.mjs`, `template_Value`, `ContentObject`, `.success`, `ExclGroup`, `StringObject`, `MathClamp`, `.find`, `operations/actions.ts`, `OptionObject`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `SectionCard()` connect `SectionCard` to `rect-structure-workbook.ts`, `rect-template-pdf.ts`, `DeliveryTicketEditor`, `QuoteForm`, `quote-form.tsx`, `product-kinds.ts`, `app_generated_prisma_client_prisma`, `quote-line-items-table.tsx`, `job-detail-mapper.ts`, `sheet-pdfs/actions.ts`, `daily-production-entry.tsx`, `inventory/page.tsx`, `import/actions.ts`, `drill-sheet-form.tsx`, `shipping-zones-manager.tsx`, `auth/constants.ts`, `customer-mapper.ts`, `customer-name-similarity.ts`, `prisma.ts`, `delivery-dispatch-utils.ts`, `app-settings.ts`, `randomId`, `ProductDocumentsSection`, `jobs/actions.ts`, `bid-actions.ts`, `structure-workbook.tsx`, `files/actions.ts`, `operations/actions.ts`, `app/products/page.tsx`, `next`, `react`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **What connects `dynamic`, `RouteContext`, `RouteContext` to the rest of the system?**
  _1363 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app/products/actions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07738095238095238 - nodes in this community are weakly interconnected._
- **Should `rect-structure.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08156028368794327 - nodes in this community are weakly interconnected._
- **Should `pdf.worker.min.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.009201290077784101 - nodes in this community are weakly interconnected._