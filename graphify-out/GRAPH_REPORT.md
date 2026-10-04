# Graph Report - precastapp  (2026-10-04)

## Corpus Check
- 772 files · ~490,902 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 3, .mdc 2, .example 1)

## Summary
- 8879 nodes · 26490 edges · 222 communities (173 shown, 49 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 236 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c6186586`
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
- warn
- drill-sheet-template-pdf.ts
- QuoteForm
- quote-form.tsx
- puppeteer-browser.ts
- quotes/actions.ts
- users/actions.ts
- product-form.tsx
- product-kinds.ts
- compilerOptions
- .createDocumentHandler
- .getTextContent
- rect-sheet-persistence.ts
- Glyph
- OptionObject
- quote-pdf-html.ts
- galley-actions.ts
- delivery-ticket-pdf-line-items.ts
- drain-ring-matrix-utils.ts
- delivery-tickets/pdf-actions.ts
- drill-sheet-preview.tsx
- scripts
- job-detail-content.tsx
- build
- LocaleSetNamespace
- sheet-pdfs/actions.ts
- invoices/actions.ts
- prisma.ts
- rect-sheet-detail-view.tsx
- drill-sheet.ts
- .success
- inventory/page.tsx
- CMap
- structure-import.ts
- rect-structure-workbook.tsx
- rate-lookup.tsx
- XMLParserBase
- auth/constants.ts
- dependencies
- customer-utils.ts
- structures/actions.ts
- bulk-load-planner.tsx
- postcss.config.mjs
- contact-actions.ts
- decodeScan
- quote-mapper.ts
- Handy Commands — Precast App
- devDependencies
- delivery-tickets/actions.ts
- delivery-ticket-utils.ts
- PsWasmCompiler
- quote-pdf-line-items.ts
- submittal-package.ts
- delivery-tickets/[id]/edit/page.tsx
- casting-utils.ts
- ref_fs
- production-entry-form.tsx
- app-settings.ts
- pipe-modal.tsx
- Datasets
- delivery-fulfillment.ts
- job-progress.ts
- navigateAfterAction
- calibrate-rect-templates.ts
- AGENTS.md
- walk-ins-board.tsx
- vitest
- jobs/actions.ts
- .parse
- job-structure-documents-service.ts
- DecodeStream
- IntegerObject
- job-structure-import-dialog.tsx
- withDatabaseRetry
- files/actions.ts
- quote-revision.ts
- AnnotationBorderStyle
- input.tsx
- Precast Ops desktop updates
- job-detail-mapper.ts
- job-bidding-panel.tsx
- Builder
- invoice-pdf-fill.ts
- SimpleDOMNode
- structure-workbook.tsx
- product-taxonomy.server.ts
- generate-invoice-templates.ts
- send-actions.ts
- XhtmlObject
- job-utils.ts
- job-files-browser.tsx
- zones.ts
- plan-sheet-actions.ts
- windows-explorer.ts
- operations/actions.ts
- product-export.ts
- money-rules.ts
- Office deployment — single Windows server + UNC job folders
- Office rollout checklist
- app_generated_prisma_client
- react
- .process
- import-rect-sheet-pdfs.ts
- .get
- getStringOption
- format.ts
- app_generated_prisma_client_prismaclient
- Deployment server info checklist
- delivery-ticket-pdf-html.ts
- Troubleshooting
- unreachable
- structure-workbook-plan-takeoff.tsx
- Precast Ops
- Util
- stringToBytes
- printPdfUrl
- job-structure-detail-mapper.ts
- JpegImage
- AESBaseCipher
- purchase-orders/actions.ts
- drain-ring-utils.ts
- render-example-sheets.ts
- ring-builder-modal.tsx
- CalRGBCS
- rect-structure-import.ts
- quote-line-items-table.tsx
- customer-mapper.ts
- template_Value
- signature_Signature
- main.mjs
- Stylesheet
- lexer_Lexer
- ref_path
- GroupMemberReorderTable
- MetadataParser
- TextState
- .push
- ExclGroup
- ChunkedStream
- StringObject
- invoice-mapper.ts
- XmlObject
- ToUnicodeMap
- FormatError
- test-db.ts
- FontFinder
- BasePDFStreamReader
- NullOptimizer
- ._bindElement
- .#Ne
- package.json
- next
- GlobalImageCache
- customer-export.ts
- [...file]/route.ts
- structure-template-pdf-service.ts
- print-pdf-url.ts
- XFAAttribute
- client-path-mapping.ts
- ShippingZonesManager
- custom-structure-import.ts
- walk-ins/page.tsx
- scanAllProductSubmittalsAction
- overrides
- ui
- delivery-ticket-detail-content.tsx
- product-mapper.ts
- generate-circular-import-template.mjs
- rect-bulk-grid.tsx
- .checkAndRepair
- ConfigNamespace
- LabCS
- xdp_Xdp
- calculateSHA512
- SectionCard
- ColorSpace
- SingleIntersector
- process-app-icon.ps1
- Phase 6 — Electron client (staff PCs)
- util_shadow
- allowScripts
- Security posture: internal, trusted-network tool
- .getUint16
- oi

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
- `AllDeliveryTicketsPage()` --indirect_call--> `mapDbDeliveryTicketToListRow()`  [INFERRED]
  app/delivery-tickets/all/page.tsx → lib/delivery-ticket-mapper.ts
- `DeliveryTicketsPage()` --indirect_call--> `mapDbDeliveryTicketToListRow()`  [INFERRED]
  app/delivery-tickets/page.tsx → lib/delivery-ticket-mapper.ts
- `openDialog()` --calls--> `loadJobStructureImportOptions()`  [EXTRACTED]
  components/jobs/job-structure-import-dialog.tsx → app/jobs/structure-import-actions.ts

## Import Cycles
- None detected.

## Communities (222 total, 49 thin omitted)

### Community 0 - "app/products/actions.ts"
Cohesion: 0.08
Nodes (45): assertAllAssemblyComponentCodesExist(), BulkImportRow, bulkImportUpdateData(), collectAssemblyBomImportRows(), collectReferencedComponentCodes(), createFormProfileReader(), createProduct(), importProductsOrThrow() (+37 more)

### Community 1 - "rect-structure.ts"
Cohesion: 0.09
Nodes (38): SumpMode, annotateRectOpeningSections(), ComputedRectSection, computeHorizontalGeometry(), computeRectDefaultSumpFeet(), computeRectPricing(), computeRectStructure(), computeRectWallHeightFeet() (+30 more)

### Community 2 - "pdf.worker.min.mjs"
Cohesion: 0.01
Nodes (216): 463(), 812(), 837(), 944(), Ac, adjustWidths(), ah, Ai (+208 more)

### Community 3 - "Annotation"
Cohesion: 0.09
Nodes (3): Annotation, LinkAnnotation, PopupAnnotation

### Community 5 - "XFAObject"
Cohesion: 0.01
Nodes (71): Arc, Assist, Barcode, Bind, BindItems, Bookend, Border, Break (+63 more)

### Community 6 - ".getOperatorList"
Cohesion: 0.04
Nodes (30): addCachedImageOps(), BrotliStream, CheckedOperatorList, EvalState, fetchBinaryData(), generateFont(), getFamilyName(), getFontSubstitution() (+22 more)

### Community 7 - "structure-workbook.ts"
Cohesion: 0.11
Nodes (42): groupToneClasses(), pipeSizesForMaterial(), RowOpeningsEditor(), RowPenetrationsEditor(), StructureWorkbookGrid(), StructureWorkbookGridProps, uniquePipeMaterials(), applyDefaultsToBlankRow() (+34 more)

### Community 9 - "rect-structure-workbook.ts"
Cohesion: 0.08
Nodes (45): loadJobSheetImportCandidates(), RectStructureWorkbook(), addRows(), duplicateSelected(), handleApply(), handleModeChange(), importRows(), repriceAllRows() (+37 more)

### Community 10 - "ContentObject"
Cohesion: 0.02
Nodes (24): AlwaysEmbed, BehaviorOverride, BooleanElement, ContentObject, DateElement, DateTime, DateTimeSymbols, Decimal (+16 more)

### Community 11 - "rect-template-pdf.ts"
Cohesion: 0.09
Nodes (40): sectionJointHeightsFeet(), baseOffsetText(), BLACK, buildFlaps(), buildRectSheetFieldMap(), CalloutLayout, calloutSlotTops(), consumeMarkerField() (+32 more)

### Community 12 - "DeliveryTicketEditor"
Cohesion: 0.06
Nodes (58): DeliveryTicketJobSearchOption, SaveDeliveryTicketInput, searchCustomersForWalkInTicket(), searchJobsForDeliveryTicket(), splitStructureForShipping(), unsplitStructure(), DeliveryTicketEditor(), addExtraCustomLine() (+50 more)

### Community 13 - "warn"
Cohesion: 0.03
Nodes (35): addPageError(), CFF, CFFCompiler, CFFDict, CFFFDSelect, CFFIndex, CFFOffsetTracker, CFFParser (+27 more)

### Community 14 - "drill-sheet-template-pdf.ts"
Cohesion: 0.04
Nodes (71): DrillSheetPreviewMeta, ComputedOpening, DrillSheetResult, appendDrillSheetFillablePage(), BORDER, drawField(), feet(), FieldContext (+63 more)

### Community 15 - "QuoteForm"
Cohesion: 0.06
Nodes (62): loadJobCustomStructureImportCandidates(), toPlainNumberString(), createDefaultCustomStructureRow(), createLineId(), QuoteForm(), addCategoryLine(), addLineItem(), addLineItems() (+54 more)

### Community 16 - "quote-form.tsx"
Cohesion: 0.04
Nodes (64): QuoteSaveDestination, JobCustomStructureImportCandidate, CustomStructureCostBreakdown(), addItem(), CustomStructureCostBreakdownProps, CustomStructureDetailBreakdown(), CustomStructurePricingFooter(), CustomStructurePricingFooterProps (+56 more)

### Community 17 - "puppeteer-browser.ts"
Cohesion: 0.25
Nodes (11): acquirePageSlot(), getSharedBrowser(), getWindowsBrowserPaths(), globalForBrowser, launchBrowser(), pageWaiters, pathExists(), releasePageSlot() (+3 more)

### Community 18 - "quotes/actions.ts"
Cohesion: 0.07
Nodes (45): assertGalleyFamiliesExist(), computeQuoteFinancials(), createQuote(), CreateQuoteLineItemInput, DeleteQuoteResult, isQuoteNumberConflict(), parseOptionalDate(), QUOTE_LINE_TYPES (+37 more)

### Community 19 - "users/actions.ts"
Cohesion: 0.10
Nodes (30): ProfilePage(), getCustomerForQuoteForm(), searchCustomersForQuoteForm(), searchJobsForQuoteForm(), EditQuotePage(), EditQuotePageProps, NewQuotePage(), NewQuotePageProps (+22 more)

### Community 20 - "product-form.tsx"
Cohesion: 0.07
Nodes (29): CastingComponentPickerOption, CastingSupplierOption, drainRingDiameterOptions, ProductFormProps, ProductFormValues, bulkPasteColumnHeaders, bulkPasteExample, BulkProductPasteRow (+21 more)

### Community 21 - "product-kinds.ts"
Cohesion: 0.07
Nodes (43): findExistingProductCodesAction(), importProducts(), BulkPasteForm(), handleImport(), handleParsePreview(), lookUpExistingCodes(), BulkPasteFormProps, formatMissingTaxonomySummary() (+35 more)

### Community 22 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 23 - ".createDocumentHandler"
Cohesion: 0.03
Nodes (32): 835(), AbortException, BasePDFStream, clearGlobalCaches(), fs, JBig2CCITTFaxImage, Jbig2Error, LocalPdfManager (+24 more)

### Community 24 - ".getTextContent"
Cohesion: 0.03
Nodes (40): BaseLocalCache, BaseShading, buildMeshVertexData(), ColorSpaceUtils, DefaultAppearanceEvaluator, DummyShading, FunctionBasedShading, getB() (+32 more)

### Community 25 - "rect-sheet-persistence.ts"
Cohesion: 0.04
Nodes (99): createDrillSheet(), createRectSheet(), deleteDrillSheet(), updateDrillSheet(), updateRectSheet(), upgradeRectSheetFromPlaceholder(), DrillSheetDetailPage(), DrillSheetDetailPageProps (+91 more)

### Community 26 - "Glyph"
Cohesion: 0.08
Nodes (6): CompositeGlyph, Contour, GlyfTable, Glyph, GlyphHeader, SimpleGlyph

### Community 27 - "OptionObject"
Cohesion: 0.02
Nodes (36): ADBE_JSConsole, ADBE_JSDebugger, AutoSave, config_Attributes, config_Type, config_Validate, Conformance, Destination (+28 more)

### Community 28 - "quote-pdf-html.ts"
Cohesion: 0.39
Nodes (7): CompanyProfile, buildQuotePdfHtml(), escapeHtml(), fieldBlock(), notesBlock(), isCategoryLineItem(), QuoteDetailView

### Community 29 - "galley-actions.ts"
Cohesion: 0.14
Nodes (25): injectGalleyFamilyOptions(), applyGalleyBreakdown(), ApplyGalleyBreakdownResult, BREAKDOWN_STATUSES, BreakdownDialog(), submit(), formatMixSummary(), GalleyBreakdownBanner() (+17 more)

### Community 30 - "delivery-ticket-pdf-line-items.ts"
Cohesion: 0.07
Nodes (50): COL_DESC_WIDTH, COL_DESC_X, COL_ITEM_NUM_WIDTH, COL_ITEM_NUM_X, COL_QTY_WIDTH, COL_QTY_X, DEFAULT_TABLE_LAYOUT, DeliveryTicketTableLayout (+42 more)

### Community 31 - "drain-ring-matrix-utils.ts"
Cohesion: 0.07
Nodes (41): applyAutoRingAssignment(), setAdsPipeCount(), setDrainRingCount(), DrainRingMatrixRows(), DrainRingMatrixRowsProps, DrainRingStyleTable(), DrainRingStyleTableProps, FEET_STAT_COLUMNS (+33 more)

### Community 32 - "delivery-tickets/pdf-actions.ts"
Cohesion: 0.10
Nodes (31): DeliveryTicketPdfPreviewResult, generateDeliveryTicketPdf(), GenerateDeliveryTicketPdfResult, getDeliveryTicketPdfPreviewBase64(), loadTicketForPdf(), printDeliveryTicketDirect(), PrintDeliveryTicketDirectResult, saveDeliverySchedulePdf() (+23 more)

### Community 33 - "drill-sheet-preview.tsx"
Cohesion: 0.11
Nodes (41): CalcRow(), DrillSheetPreview(), DrillSheetPreviewProps, feet(), HeaderRow(), PlanDiagram(), PreviewPanel(), angleToClockPosition() (+33 more)

### Community 34 - "scripts"
Cohesion: 0.11
Nodes (19): scripts, build, db:seed, db:sync-files, deploy:build, deploy:check, deploy:start, deploy:update (+11 more)

### Community 35 - "job-detail-content.tsx"
Cohesion: 0.06
Nodes (48): toggleJobFavorite(), listCustomersForBidList(), JobTabContent(), JobTabContentProps, JobDrillSheetsPdfButtons(), MarkAllSubmittedButton(), ChevronIcon(), JobDeliveriesTable() (+40 more)

### Community 36 - "build"
Cohesion: 0.11
Nodes (18): build, appId, directories, extraResources, icon, nsis, productName, publish (+10 more)

### Community 37 - "LocaleSetNamespace"
Cohesion: 0.03
Nodes (24): CalendarSymbols, CurrencySymbol, CurrencySymbols, DatePattern, DatePatterns, Day, DayNames, Era (+16 more)

### Community 38 - "sheet-pdfs/actions.ts"
Cohesion: 0.11
Nodes (33): createSheetPdfSetAction(), deleteSheetPdfSetAction(), deleteSheetPdfSetFileAction(), parseBooleanField(), renameSheetPdfSetAction(), revalidate(), uploadSheetPdfSetFileAction(), CIRCULAR_SLOT_DEFINITIONS (+25 more)

### Community 39 - "invoices/actions.ts"
Cohesion: 0.08
Nodes (47): computeInvoiceFinancials(), deleteDraftInvoice(), DraftInvoiceLineInput, EDITABLE_INVOICE_STATUSES, finalizeAllDraftInvoices(), finalizeInvoices(), getInvoiceTabCounts(), InvoiceListRow (+39 more)

### Community 40 - "prisma.ts"
Cohesion: 0.04
Nodes (72): JobDetailPage(), JobDetailPageProps, resolveTab(), VALID_TABS, DailyProductionPage(), DailyProductionPageProps, BulkProductsPage(), EditProductPage() (+64 more)

### Community 41 - "rect-sheet-detail-view.tsx"
Cohesion: 0.11
Nodes (28): aboveFloorText(), fmtElevation(), InfoRow(), placementText(), RectSheetDetailView(), RectSheetDetailViewProps, Stat(), wholeInches() (+20 more)

### Community 42 - "drill-sheet.ts"
Cohesion: 0.06
Nodes (47): annotateOpeningSections(), buildSolverHoles(), compareCost(), computeBaseTopToOpeningBottomInches(), computeDefaultSumpFeet(), computeDrillSheet(), ComputedSection, ComputedWeights (+39 more)

### Community 43 - ".success"
Cohesion: 0.05
Nodes (39): applyAssist(), ariaLabel(), Caption, CheckButton, checkDimensions(), ChoiceList, computeBbox(), Corner (+31 more)

### Community 44 - "inventory/page.tsx"
Cohesion: 0.03
Nodes (114): AGGREGATE_SORT_COLUMNS, CONTACT_SORT_COLUMNS, ContactSortColumn, CUSTOMER_SORT_FIELDS, CustomerSortColumn, CustomersPage(), isAggregateSortColumn(), loadCustomerAggregates() (+106 more)

### Community 46 - "structure-import.ts"
Cohesion: 0.20
Nodes (20): CONNECTION_ALIASES, isBlank(), numberIssue(), parseBooleanCell(), parseConnectionCell(), parseDiametersCell(), parseSizesCell(), parseStatusCell() (+12 more)

### Community 47 - "rect-structure-workbook.tsx"
Cohesion: 0.03
Nodes (99): completeRectDrillSheets(), buildCommittedPreview(), CommittedOpeningNumbers, CommittedPreviewNumbers, connectionOptions, createOpening(), DiameterConfigOption, DrillSheetCastingOption (+91 more)

### Community 48 - "rate-lookup.tsx"
Cohesion: 0.13
Nodes (19): lookupShippingRateAtPoint(), ShippingLookupResult, AddressAutocomplete(), closeDropdown(), handleContainerBlur(), AddressAutocompleteProps, DEFAULT_CENTER, LookupSuccess (+11 more)

### Community 50 - "XMLParserBase"
Cohesion: 0.13
Nodes (3): XFAParser, XMLParserBase, skipWs()

### Community 51 - "auth/constants.ts"
Cohesion: 0.05
Nodes (64): getActiveLoginUsers(), getActiveUserForLogin(), LoginUserOption, parsePasswordFields(), signInWithPassword(), signOut(), LoginPage(), LoginForm() (+56 more)

### Community 52 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, leaflet, next, nodemailer, pdf-lib, @pdf-lib/fontkit, pdf-to-printer, pdfjs-dist (+11 more)

### Community 53 - "customer-utils.ts"
Cohesion: 0.06
Nodes (38): checkBulkContactDbState(), importContacts(), BulkContactPasteForm(), handleImport(), handleParsePreview(), parseBulkContactPaste(), handleParsePreview(), parseBulkPaste() (+30 more)

### Community 54 - "structures/actions.ts"
Cohesion: 0.09
Nodes (38): assertDiametersHaveMolds(), createStructureTemplate(), duplicateStructureTemplate(), handlePrismaError(), parseTemplatePayload(), resolvePriceListIdForTemplateSave(), saveRectPriceEntry(), updateStructureTemplate() (+30 more)

### Community 55 - "bulk-load-planner.tsx"
Cohesion: 0.07
Nodes (53): DeliveryTicketLineInput, discardSavedLoadPlan(), PlannedLoadInput, saveLoadPlanForLater(), savePlannedLoads(), SavePlannedLoadsInput, buildRows(), BulkLoadPlanner() (+45 more)

### Community 57 - "contact-actions.ts"
Cohesion: 0.10
Nodes (38): addCustomerContact(), BulkContactDbState, BulkContactImportRow, CONTACT_ROLES, CustomerContactInput, deleteCustomerContact(), ImportContactsResult, loadContactRows() (+30 more)

### Community 64 - "decodeScan"
Cohesion: 0.19
Nodes (13): buildComponentData(), decodeScan(), decodeBlock(), decodeHuffman(), decodeMcu(), readBit(), receive(), receiveAndExtend() (+5 more)

### Community 65 - "quote-mapper.ts"
Cohesion: 0.07
Nodes (37): QUOTE_LIST_SELECT, QuotesPage(), startOfToday(), statusWhereFor(), formatQuoteYards(), QuotesSummarySection(), tileToneClassName, formatYards() (+29 more)

### Community 66 - "Handy Commands — Precast App"
Cohesion: 0.15
Nodes (13): App (Next.js), Browse data, Daily workflow, Database backups, Electron desktop client, Git / GitHub (optional), Handy Commands — Precast App, Office deployment (Windows server) (+5 more)

### Community 67 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, electron, electron-builder, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx (+8 more)

### Community 68 - "delivery-tickets/actions.ts"
Cohesion: 0.07
Nodes (39): assertQuoteLinkable(), buildLineCreates(), buildLinesPayload(), createDeliveryTicket(), DeliveryTicketActionResult, GenerateTicketSubmittalResult, parseDate(), resolveTicketCustomerId() (+31 more)

### Community 69 - "delivery-ticket-utils.ts"
Cohesion: 0.09
Nodes (25): deliveryDateFilterOptions, DeliveryFilterOptions, deliveryTicketCustomerOptions, DeliveryTicketDetailLineItem, deliveryTicketDriverOptions, DeliveryTicketFormLineItem, deliveryTicketInputClassName, deliveryTicketJobOptions (+17 more)

### Community 70 - "PsWasmCompiler"
Cohesion: 0.06
Nodes (21): ast_Parser, encodeASCIIString(), _nodesEqual(), PsArgNode, PsBinaryNode, PsBlock, PsConstNode, PsIf (+13 more)

### Community 71 - "quote-pdf-line-items.ts"
Cohesion: 0.07
Nodes (45): COL_DESC_WIDTH, COL_DESC_X, COL_ITEM_NUM_WIDTH, COL_ITEM_NUM_X, COL_QTY_WIDTH, COL_QTY_X, COL_TOTAL_WIDTH, COL_TOTAL_X (+37 more)

### Community 72 - "submittal-package.ts"
Cohesion: 0.11
Nodes (27): getQuotePdfFallbackDir(), getSubmittalsJobSubfolder(), dedupeSharedPdfObjects(), isSkipped(), rewriteRefs(), SKIP_TYPES, structuralKey(), TYPE_KEY (+19 more)

### Community 73 - "delivery-tickets/[id]/edit/page.tsx"
Cohesion: 0.09
Nodes (29): EDIT_ORIGINS, EditDeliveryTicketPage(), EditDeliveryTicketPageProps, NewDeliveryTicketPage(), NewDeliveryTicketPageProps, TICKET_ORIGINS, listJobsWithQuotes(), DispatcherWeekCalendar (+21 more)

### Community 74 - "casting-utils.ts"
Cohesion: 0.13
Nodes (12): CastingAssemblyBomImportRow, castingAssemblyBomRoleOrder, castingAssemblyOptionalBomRoles, castingAssemblyRequiredBomRoles, CastingBomRowInput, CastingComponentLookup, CastingComponentOption, castingPieceRoleFormOptions (+4 more)

### Community 75 - "ref_fs"
Cohesion: 0.06
Nodes (65): renderPage(), blankOr(), buildDeliveryTicketFormData(), computeTotalPieces(), DbCustomer, DbDeliveryTicketForPdf, DbJob, DELIVERY_TICKET_PDF_INCLUDE (+57 more)

### Community 76 - "production-entry-form.tsx"
Cohesion: 0.06
Nodes (42): GlobalError(), isStaleDeploymentError(), RootLayout(), NotFound(), saveProductionEntry(), FormTypeahead(), closeDropdown(), handleContainerBlur() (+34 more)

### Community 77 - "app-settings.ts"
Cohesion: 0.05
Nodes (77): DeliveryTicketPreviewPage(), DeliveryTicketPreviewPageProps, PREVIEW_ORIGINS, DeliveryTicketSubmittalPreviewPage(), DeliveryTicketSubmittalPreviewPageProps, testJobsRootWriteAccessAction(), testStockSubmittalsRootWriteAccessAction(), BillingSettingsPage() (+69 more)

### Community 78 - "pipe-modal.tsx"
Cohesion: 0.10
Nodes (33): createDefaultQuoteRow(), createRowId(), PipeModal(), handleAddQuoteLines(), handleAddUnitPricesToDescription(), handleClose(), resetModal(), PipeModalMode (+25 more)

### Community 79 - "Datasets"
Cohesion: 0.20
Nodes (3): Datasets, datasets_Data, DatasetsNamespace

### Community 80 - "delivery-fulfillment.ts"
Cohesion: 0.08
Nodes (47): CandidateDraft, EmptyState(), mapDraftToCells(), PlanLoadsPage(), PlanLoadsPageProps, getQuoteFulfillmentForTicket(), getQuoteFulfillmentWithOpenLoads(), DraftLoadColumn (+39 more)

### Community 81 - "job-progress.ts"
Cohesion: 0.11
Nodes (26): mapStructure(), needsDrillSheetWhere, ProductionPage(), structureInclude, JobProgressLine, JobProgressSummary, JobProgressView, JobStructureProgressLine (+18 more)

### Community 82 - "navigateAfterAction"
Cohesion: 0.06
Nodes (46): deleteProductCategory(), deleteProductSubcategory(), BulkPasteForm(), handleImport(), AssemblyOption, createRow(), prefillRowsFromPurchaseOrder(), ProductOption (+38 more)

### Community 83 - "calibrate-rect-templates.ts"
Cohesion: 0.09
Nodes (25): Align, ALIGNMENTS, BLACK, calibrateVariant(), EXPLODED_SPECS, extractTextItems(), findItem(), HEADER_SPECS (+17 more)

### Community 84 - "AGENTS.md"
Cohesion: 0.38
Nodes (4): Codebase exploration: use graphify first, Prisma / Database Rules, Project context, This is NOT the Next.js you know

### Community 85 - "walk-ins-board.tsx"
Cohesion: 0.24
Nodes (14): MarkPickedUpControl(), handleConfirm(), BadgeVariant, CalledInPickupCard(), CompletedPickupCard(), dateLine(), itemsPaymentLine(), jobNameLine() (+6 more)

### Community 86 - "vitest"
Cohesion: 0.12
Nodes (20): batchConvertDeliveredTicketsToInvoices(), BatchInvoiceConversionResult, CastingSetCharge, castingSetsStarted(), convertDeliveryTicketToInvoice(), InvoiceAlreadyExistsError, invoiceDueDateFromDelivery(), mapDeliveryLineTypeToInvoiceLineType() (+12 more)

### Community 87 - "jobs/actions.ts"
Cohesion: 0.05
Nodes (60): BulkImportRow, checkBulkCustomerDbDuplicates(), createCustomer(), CUSTOMER_STATUSES, CustomerRecordInput, deleteCustomer(), findSimilarCustomers(), importCustomers() (+52 more)

### Community 88 - ".parse"
Cohesion: 0.08
Nodes (12): 14(), 291(), 750(), 981(), buildPostScriptWasmFunction(), DataHandler, interpolate(), parsePostScriptFunction() (+4 more)

### Community 89 - "job-structure-documents-service.ts"
Cohesion: 0.16
Nodes (20): pathExists(), resolveUniqueFilePath(), sanitizeFileName(), assertPathUnderJobFolder(), assertPathUnderRoot(), normalizePath(), pathsEqual(), pathStartsWith() (+12 more)

### Community 90 - "DecodeStream"
Cohesion: 0.04
Nodes (11): AsciiHexStream, CCITTFaxStream, DecodeStream, DecryptStream, Jbig2Stream, JpxError, JpxImage, JpxStream (+3 more)

### Community 91 - "IntegerObject"
Cohesion: 0.05
Nodes (13): AdjustData, AdobeExtensionLevel, CompressObjectStream, Copies, CurrentPage, IntegerObject, Level, MsgId (+5 more)

### Community 92 - "job-structure-import-dialog.tsx"
Cohesion: 0.11
Nodes (27): JobStructureImportEntry, buildPreview(), Cell, detectShape(), ImportOptions, JobStructureImportButton(), handleFile(), handleImport() (+19 more)

### Community 93 - "withDatabaseRetry"
Cohesion: 0.04
Nodes (114): GET(), GET(), RouteContext, importContactsOrThrow(), CustomerDetailPage(), CustomerDetailPageProps, updateTicketDriver(), updateTicketTrailer() (+106 more)

### Community 94 - "files/actions.ts"
Cohesion: 0.23
Nodes (20): ExplorerOpenResult, openJobFolderCategory(), syncAllFiles(), SyncAllFilesResult, assertJobFolderPath(), assertPathUnderJobRoot(), getJobFileForOpen(), isJobFolderCategory() (+12 more)

### Community 95 - "quote-revision.ts"
Cohesion: 0.09
Nodes (35): CreateQuoteInput, contactToSnapshot(), getDefaultContactForRole(), getPrimaryContactForCustomer(), findAncestorLineWithStructure(), linkJobStructuresFromQuoteInTransaction(), mapLineTypeToStructureType(), STRUCTURE_LINE_TYPES (+27 more)

### Community 97 - "input.tsx"
Cohesion: 0.40
Nodes (3): inputClassName, InputProps, textareaClassName

### Community 98 - "Precast Ops desktop updates"
Cohesion: 0.40
Nodes (4): Precast Ops desktop updates, Publish a desktop update (from the dev PC), Verify (from any office PC), Which machine does what

### Community 99 - "job-detail-mapper.ts"
Cohesion: 0.08
Nodes (30): buildBiddingSummary(), buildJobOverview(), defaultContactIdForBidder(), deliveryItemStatusVariant(), deliveryStatusVariant(), DeliveryTicketLineItemSummary, formatDate(), formatProjectAddress() (+22 more)

### Community 100 - "job-bidding-panel.tsx"
Cohesion: 0.16
Nodes (22): addJobBidder(), awardJob(), generateQuotesFromMaster(), removeJobBidder(), buildContactMapForGenerate(), buildDefaultContactMap(), JobBiddingPanel(), handleAddBidder() (+14 more)

### Community 101 - "Builder"
Cohesion: 0.15
Nodes (3): Builder, Root, UnknownNamespace

### Community 102 - "invoice-pdf-fill.ts"
Cohesion: 0.07
Nodes (47): fillAcroFormFields(), fitTermsField(), buildInvoicePageBytes(), drawDraftWatermark(), ensureInvoiceTemplateExists(), fillAcroFormFields(), getInvoiceContinuationTemplatePath(), getInvoiceTemplatePath() (+39 more)

### Community 104 - "SimpleDOMNode"
Cohesion: 0.15
Nodes (3): DatasetXMLParser, SimpleDOMNode, SimpleXMLParser

### Community 105 - "structure-workbook.tsx"
Cohesion: 0.10
Nodes (32): JobSheetImportCandidate, PlanSheetRecord, DrillSheetTemplateOption, JobSheetImportDialog(), JobSheetImportDialogProps, pipeSizesForMaterial(), StructureWorkbookDefaultsPanel(), StructureWorkbookDefaultsPanelProps (+24 more)

### Community 106 - "product-taxonomy.server.ts"
Cohesion: 0.14
Nodes (22): chipClassName(), StockProductPicker(), StockProductPickerProps, ensureTaxonomyForBulkImport(), fetchActiveProductTaxonomy(), resolveTaxonomyByNamesForImport(), validateTaxonomySelection(), analyzeTaxonomyByNames() (+14 more)

### Community 108 - "generate-invoice-templates.ts"
Cohesion: 0.12
Nodes (25): CONT_TABLE_BOTTOM_Y, MAIN_TABLE_BOTTOM_Y, addTextField(), BLACK, BOTTOM_BOX, buildTemplate(), Ctx, drawBox() (+17 more)

### Community 110 - "send-actions.ts"
Cohesion: 0.06
Nodes (59): findSupersededBy(), getSendQuoteDefaults(), getSendQuoteEmailConfigured(), OpenOutlookDraftResult, openQuoteInOutlook(), sendQuote(), SendQuoteDefaults, SendQuoteInput (+51 more)

### Community 111 - "XhtmlObject"
Cohesion: 0.04
Nodes (22): B, Body, Br, Button, fixURL(), hl, Html, $i (+14 more)

### Community 112 - "job-utils.ts"
Cohesion: 0.08
Nodes (26): updateJobCustomerAction(), updateJobStatusAction(), JobCustomerOption, JobFormProps, JobFormValues, AssignableCustomer, JobCustomerEditor(), choose() (+18 more)

### Community 114 - "job-files-browser.tsx"
Cohesion: 0.07
Nodes (47): listJobFilesAction(), openJobFile(), syncJobFilesAction(), openJobFolder(), deleteProductDocumentAction(), openProductDocument(), scanProductDocumentsAction(), uploadProductDocumentAction() (+39 more)

### Community 115 - "zones.ts"
Cohesion: 0.20
Nodes (13): ClickCapture(), FlyToPin(), ZoneMap(), ZoneMapProps, haversineMiles(), LatLng, pointInPolygon(), PolygonRing (+5 more)

### Community 117 - "plan-sheet-actions.ts"
Cohesion: 0.23
Nodes (13): getPlanSheetForQuote(), listJobConstructionPlanPdfs(), mapPlanSheetRow(), pathExists(), savePlanSheetMarkup(), selectJobPlanSheet(), uploadPlanSheet(), StructureWorkbookPlanPicker() (+5 more)

### Community 118 - "windows-explorer.ts"
Cohesion: 0.11
Nodes (36): generateDrillSheetPdf(), GenerateDrillSheetPdfResult, generateJobDrillSheetsPdf(), GenerateJobDrillSheetsPdfResult, generateRectSheetPdf(), getJobsRoot(), buildDrillSheetPdfBaseName(), resolveDrillSheetPdfDirectory() (+28 more)

### Community 119 - "operations/actions.ts"
Cohesion: 0.04
Nodes (74): approveStructureForProduction(), BULK_STRUCTURE_STATUSES, BulkStructureStatus, cancelTicketFromReconcile(), collectDeliveredUninvoicedTicketIds(), confirmDeliveryDayReconciliation(), DailyProductionSaveInput, deliverAllTicketsForDay() (+66 more)

### Community 120 - "product-export.ts"
Cohesion: 0.12
Nodes (31): listStockProductsForTicket(), DetailField(), ProductDetailPage(), ProductDetailPageProps, searchProductsForQuoteForm(), normalizeAdsPipeJointType(), DbClient, DerivedAssemblyValues (+23 more)

### Community 121 - "money-rules.ts"
Cohesion: 0.18
Nodes (15): Decimal, DecimalInstance, DecimalLike, toDecimal(), ComputedMoneyTotals, computeMoneyTotals(), MoneyLineInput, roundUnitPrice() (+7 more)

### Community 122 - "Office deployment — single Windows server + UNC job folders"
Cohesion: 0.11
Nodes (18): Architecture, End-to-end smoke test, Firewall, Important behavior, Install prerequisites, Office deployment — single Windows server + UNC job folders, Ongoing maintenance, Phase 1 — Prepare the Windows server (+10 more)

### Community 123 - "Office rollout checklist"
Cohesion: 0.12
Nodes (17): 1. Server URL for the desktop app, 2. First install on each staff PC, 3. Staff expectations, 4. Role walkthrough (recommended), 5. Backups, 6. Support contacts, 7. Post-rollout verification (first week), Database (nightly recommended) (+9 more)

### Community 124 - "app_generated_prisma_client"
Cohesion: 0.04
Nodes (88): GET(), parseCopyParam(), RouteContext, GET(), RouteContext, GET(), rectPreviewResponse(), RouteContext (+80 more)

### Community 125 - "react"
Cohesion: 0.04
Nodes (89): revalidateFilesPaths(), uploadJobFileAction(), createJobFolder(), deleteJobStructureDocumentAction(), openJobStructureDocument(), openJobStructureSubmittalsFolder(), uploadJobStructureDocumentAction(), bulkDeleteJobStructures() (+81 more)

### Community 126 - ".process"
Cohesion: 0.10
Nodes (8): addHex(), BinaryCMapReader, BinaryCMapStream, createBuiltInCMap(), hexToInt(), hexToStr(), IdentityCMap, incHex()

### Community 127 - "import-rect-sheet-pdfs.ts"
Cohesion: 0.13
Nodes (23): BASE_SLAB_ONLY_FIELDS, RECT_ELEVATION_WALL_MARKER_FIELD, RECT_EXPLODED_CENTER_MARKER_FIELD, RECT_EXPLODED_MARKER_FIELD, RECT_OPENING_ROWS, RECT_TOP_SLAB_MARKER_FIELD, RECT_WEIGHT_PIECE_LINES, TOP_SLAB_ONLY_FIELDS (+15 more)

### Community 128 - ".get"
Cohesion: 0.03
Nodes (42): addPageDict(), appendIfJavaScriptDict(), parseNestedOrder(), parseOnOff(), parseOrder(), _collectAction(), collectActions(), _collectJS() (+34 more)

### Community 129 - "getStringOption"
Cohesion: 0.04
Nodes (15): Acrobat, Color, Data, Fill, getFloat(), getInteger(), getKeyword(), getMeasurement() (+7 more)

### Community 130 - "format.ts"
Cohesion: 0.11
Nodes (29): DeliveryTicketDetailView, ticketNumberLabel(), DeliveryScheduleTicket, JobDeliverySchedule, SCHEDULE_TICKET_SELECT, buildDeliverySchedulePdfHtml(), DeliveryScheduleVariant, escapeHtml() (+21 more)

### Community 131 - "app_generated_prisma_client_prismaclient"
Cohesion: 0.12
Nodes (25): DEFAULT_APP_SETTINGS_DATA, DEFAULT_SEED_LOGO_PDF_PATH, convertPdfToPng(), IMAGE_MIME_TYPES, pathExists(), pathToLocalFileUrl(), rasterizeImageBufferToPng(), saveCompanyLogo() (+17 more)

### Community 134 - "Deployment server info checklist"
Cohesion: 0.22
Nodes (9): Database, Deployment server info checklist, Electron client, File shares (UNC), Network, PDF generation, Post-deploy verification, Server (+1 more)

### Community 136 - "delivery-ticket-pdf-html.ts"
Cohesion: 0.17
Nodes (20): getCompanyProfile(), getCompanyLogoDataUri(), DeliveryTicketCopySettings, DeliveryTicketPdfView, getDeliveryTicketCopyTitles(), addressBlockHtml(), buildDeliveryTicketPdfHtml(), escapeHtml() (+12 more)

### Community 137 - "Troubleshooting"
Cohesion: 0.33
Nodes (6): `P1001` — Can't reach database server, Password authentication failed, Port 3000 already in use, Prisma Studio — "Could not load schema metadata", Quote PDF — "Could not find Chrome" / browser not found, Troubleshooting

### Community 138 - "unreachable"
Cohesion: 0.07
Nodes (5): BasePdfManager, BasePDFStreamRangeReader, BaseStream, Pattern, unreachable()

### Community 139 - "structure-workbook-plan-takeoff.tsx"
Cohesion: 0.10
Nodes (29): pipeSizesForMaterial(), uniquePipeMaterials(), bearingFromDelta(), commitRow(), DragState, pdfToScreen(), PipePopup(), polarToScreenPoint() (+21 more)

### Community 141 - "Precast Ops"
Cohesion: 0.40
Nodes (5): Desktop shell (optional), Local development, Office deployment, Precast Ops, Project docs

### Community 142 - "Util"
Cohesion: 0.11
Nodes (4): looksLikeUnsigned16BitNegative(), recoverSigned16BitBBox(), TranslatedFont, Util

### Community 150 - "stringToBytes"
Cohesion: 0.11
Nodes (10): ARCFourCipher, calculateMD5(), CipherTransform, CipherTransformFactory, computeIDs(), PasswordException, stringToBytes(), utf8PasswordToBytes() (+2 more)

### Community 151 - "printPdfUrl"
Cohesion: 0.07
Nodes (40): printDeliveryTicketSubmittalsDirect(), DraftBatchPreviewPage(), generateQuotePdf(), renderPage(), DeliveryTicketSubmittalPdfCanvasPreview(), renderPage(), DeliveryTicketSubmittalPdfCanvasPreviewProps, getDeliveryTicketSubmittalPreviewPrintUrl() (+32 more)

### Community 152 - "job-structure-detail-mapper.ts"
Cohesion: 0.14
Nodes (18): buildWorkflowSteps(), deriveNeedsDrillSheet(), formatDate(), formatFileSize(), formatQuantity(), JobStructureDetailView, JobStructureDocumentRow, JobStructureWithRelations (+10 more)

### Community 154 - "AESBaseCipher"
Cohesion: 0.13
Nodes (7): AES128Cipher, AES256Cipher, AESBaseCipher, isArrayEqual(), PDF17, PDF20, PDFBase

### Community 155 - "purchase-orders/actions.ts"
Cohesion: 0.05
Nodes (70): resolveReceivingCategory(), InventoryReceiptsPage(), InventoryReceiptsPageProps, createPurchaseOrder(), getPurchaseOrderForReceiving(), listOpenPurchaseOrdersForReceiving(), parseDate(), parseLinesFromFormData() (+62 more)

### Community 156 - "drain-ring-utils.ts"
Cohesion: 0.18
Nodes (14): ProductForm(), handleCategoryChange(), handleProductKindChange(), handleProductTypeChange(), handleRingDiameterChange(), assertSanitaryDrainRingAllowed(), diameterSupportsSanitaryDrainRing(), DRAIN_RING_SANITARY_DIAMETERS (+6 more)

### Community 157 - "render-example-sheets.ts"
Cohesion: 0.18
Nodes (12): puppeteer, findBrowser(), HTML_PATH, main(), EXAMPLES, findBrowser(), HTML(), main() (+4 more)

### Community 158 - "ring-builder-modal.tsx"
Cohesion: 0.07
Nodes (55): createDefaultHeightPoolRow(), createRowId(), formatRingBuilderUnitPrice(), HeightPoolRow, initOtherInputs(), OtherProductInput, OtherSection(), RingBuilderModal() (+47 more)

### Community 160 - "rect-structure-import.ts"
Cohesion: 0.18
Nodes (16): RectImportDialog(), handlePasteParse(), RectImportDialogProps, Cell, cellText(), findHeaderRow(), gridFromTsv(), normalizeHeader() (+8 more)

### Community 161 - "quote-line-items-table.tsx"
Cohesion: 0.18
Nodes (17): autoResizeTextarea(), CellKeyDownHandler, DragHandleCell(), formatUnitPriceDisplay(), LineNumberCell(), MoveRemoveButtons(), QuoteLineDescriptionTextarea(), QuoteLineItemRow (+9 more)

### Community 162 - "customer-mapper.ts"
Cohesion: 0.26
Nodes (16): CustomerRowAggregates, customerStatusLabels, formatCustomerDate(), formatDate(), invoiceStatusVariant(), jobStatusVariant(), mapCustomerToDetailView(), mapCustomerToRow() (+8 more)

### Community 163 - "template_Value"
Cohesion: 0.11
Nodes (5): Draw, Field, Image, _setValue(), template_Value

### Community 165 - "main.mjs"
Cohesion: 0.06
Nodes (43): __dirname, getUserConfigPath(), loadConfig(), readJsonFile(), validateServerUrl(), buildApplicationMenu(), checkForNewServerBuild(), clearWebCache() (+35 more)

### Community 168 - "ref_path"
Cohesion: 0.10
Nodes (39): saveUploadedPlanPdf(), getQuotePdfJobSubfolder(), getStockSubmittalsRoot(), DRILL_SHEET_PDF_FALLBACK_DIR, DRILL_SHEET_PDF_JOB_SUBFOLDER, buildPlanSheetBaseName(), PLAN_SHEET_FALLBACK_DIR, PLAN_SHEET_JOB_SUBFOLDER (+31 more)

### Community 169 - "GroupMemberReorderTable"
Cohesion: 0.33
Nodes (8): GroupEditor(), ProductGroupsPage(), GroupMemberReorderTable(), clearDrag(), insertionIndexFor(), onRowDragOver(), onRowDrop(), ReloadOnSubmitForm()

### Community 172 - ".push"
Cohesion: 0.03
Nodes (57): addChildren(), AnnotationFactory, ButtonWidgetAnnotation, CaretAnnotation, ChoiceWidgetAnnotation, CircleAnnotation, core_utils_numberToString(), createImage() (+49 more)

### Community 173 - "ExclGroup"
Cohesion: 0.06
Nodes (9): addHTML(), Area, createLine(), ExclGroup, flushHTML(), getAvailableSpace(), getContainedChildren(), Subform (+1 more)

### Community 174 - "ChunkedStream"
Cohesion: 0.10
Nodes (4): arrayBuffersToBytes(), ChunkedStream, ChunkedStreamManager, MissingDataException

### Community 175 - "StringObject"
Cohesion: 0.02
Nodes (43): Amd, AppearanceFilter, Base, Certificate, config_Picture, connection_set_Uri, ConnectionSet, ConnectionSetNamespace (+35 more)

### Community 176 - "invoice-mapper.ts"
Cohesion: 0.53
Nodes (5): formatDate(), formatMoney(), InvoiceDetailView, mapDbInvoiceToDetailView(), statusVariant()

### Community 179 - "FormatError"
Cohesion: 0.04
Nodes (34): Ascii85Stream, bytesToString(), Cmd, document_find(), EvaluatorPreprocessor, expectInt(), expectString(), extendCMap() (+26 more)

### Community 180 - "test-db.ts"
Cohesion: 0.46
Nodes (4): globalSetup(), url, assertIsTestDatabaseUrl(), getTestDatabaseUrl()

### Community 181 - "FontFinder"
Cohesion: 0.16
Nodes (4): FontFinder, FontInfo, FontSelector, makeObj()

### Community 186 - "package.json"
Cohesion: 0.10
Nodes (19): eslintConfig, main, name, private, version, electron-builder, eslint, eslint-config-next (+11 more)

### Community 187 - "next"
Cohesion: 0.04
Nodes (92): BulkCustomersPage(), BulkContactsPage(), EditCustomerPage(), EditCustomerPageProps, CustomerNotFound(), NewCustomerPage(), DeliveryTicketsPage(), startOfToday() (+84 more)

### Community 189 - "customer-export.ts"
Cohesion: 0.24
Nodes (8): customerStatusFormOptions, customerExportHeaders, customerStatusLabels, CustomerWithContacts, mapCustomerToExportRow(), roleContactName(), formatExportDate(), formatOptionalString()

### Community 190 - "[...file]/route.ts"
Cohesion: 0.20
Nodes (6): dynamic, GET(), readBuildId(), CONTENT_TYPES, RouteContext, UPDATES_DIR

### Community 191 - "structure-template-pdf-service.ts"
Cohesion: 0.40
Nodes (8): assertPathUnderRoot(), deleteTemplatePdf(), getStructureTemplatePdfsRoot(), readTemplatePdfBytes(), StructureTemplatePdfRecord, TemplatePdfVariant, main(), uniqueSetName()

### Community 192 - "print-pdf-url.ts"
Cohesion: 0.18
Nodes (15): listPrintersForClient(), printServerPdfForClient(), ServerPrintResult, attachHiddenIframe(), cleanupAfterPrint(), pickPrinter(), printBlobAsPdfFrame(), printViaServerWithPicker() (+7 more)

### Community 194 - "client-path-mapping.ts"
Cohesion: 0.33
Nodes (7): ClientPathMapping, getClientPathMappings(), stripTrailingSeparators(), toClientOpenPath(), translateToClientPath(), JOBS, STOCK

### Community 195 - "ShippingZonesManager"
Cohesion: 0.29
Nodes (7): emptyForm(), ShippingZonesManager(), handleMapClick(), removeZone(), saveYard(), update(), ZoneMap

### Community 196 - "custom-structure-import.ts"
Cohesion: 0.14
Nodes (20): importCustomJobStructures(), JobStructureImportResult, JobCustomStructureImportButton(), handleFile(), handleImport(), parseGrid(), Cell, cellText() (+12 more)

### Community 197 - "walk-ins/page.tsx"
Cohesion: 0.38
Nodes (6): ACTIVE_PICKUP_STATUSES, formatDate(), toRow(), WALK_IN_SELECT, WalkInRecord, WalkInsPage()

### Community 198 - "scanAllProductSubmittalsAction"
Cohesion: 0.83
Nodes (3): scanAllProductSubmittalsAction(), ScanSubmittalsButton(), handleScan()

### Community 199 - "overrides"
Cohesion: 0.50
Nodes (4): postcss, overrides, @hono/node-server, next

### Community 203 - "delivery-ticket-detail-content.tsx"
Cohesion: 0.12
Nodes (23): generateDeliveryTicketSubmittalPackage(), convertTicketToInvoice(), DeliveryTicketDetailContent(), DeliveryTicketDetailContentProps, formatLineType(), isBlank(), OptionalField(), paymentMethodLabel() (+15 more)

### Community 204 - "product-mapper.ts"
Cohesion: 0.16
Nodes (18): ProductRow, formatProductKindBadgeLabel(), categoryVariant(), documentTypeLabel(), formatDecimal(), formatDocumentDate(), formatFileSize(), formatYesNo() (+10 more)

### Community 209 - "generate-circular-import-template.mjs"
Cohesion: 0.06
Nodes (34): handleFile(), handleFile(), xlsx, colWidths, EXAMPLE_ROWS, exampleSheet, HEADERS, INSTRUCTIONS (+26 more)

### Community 227 - "rect-bulk-grid.tsx"
Cohesion: 0.09
Nodes (43): BulkSheetRowInput, BulkSheetRowResult, RectSheetFormValues, circularPayloadFromValues(), rectPayloadFromValues(), focusGridCell(), formatBrickInches(), formatElevation() (+35 more)

### Community 242 - ".checkAndRepair"
Cohesion: 0.04
Nodes (35): adjustMapping(), amendFallbackToUnicode(), CFFCharset, CFFFont, CFFHeader, convertCidString(), createCmapTable(), createNameTable() (+27 more)

### Community 243 - "ConfigNamespace"
Cohesion: 0.01
Nodes (64): Acrobat7, AddSilentPrint, AddViewerPreferences, Agent, BatchOutput, Cache, Change, Common (+56 more)

### Community 248 - "LabCS"
Cohesion: 0.14
Nodes (3): CalGrayCS, DeviceCmykCS, LabCS

### Community 256 - "calculateSHA512"
Cohesion: 0.21
Nodes (10): calculateSHA384(), calculateSHA512(), ch(), littleSigma(), littleSigmaPrime(), maj(), NullCipher, sigma() (+2 more)

### Community 260 - "SectionCard"
Cohesion: 0.05
Nodes (104): where, ProductInventoryPage(), ProductInventoryPageProps, CompactTable(), Home(), CastingSuppliersPage(), CastingSuppliersPageProps, StructureDiametersSettingsPage() (+96 more)

### Community 261 - "ColorSpace"
Cohesion: 0.07
Nodes (6): AlternateCS, ColorSpace, DeviceGrayCS, DeviceRgbaCS, DeviceRgbCS, PatternCS

### Community 311 - "Phase 6 — Electron client (staff PCs)"
Cohesion: 0.25
Nodes (8): A. Server app updates (quotes, jobs, UI — most changes), B. Desktop shell updates (Electron auto-update), Build the installer, C. Server URL change only, Client updates (auto-update from server), Install on each desk PC, Local development with Electron, Phase 6 — Electron client (staff PCs)

### Community 315 - "util_shadow"
Cohesion: 0.03
Nodes (12): AppearanceStreamEvaluator, Catalog, CmykICCBasedCS, FeatureTest, fetchSync(), InfoUtils, JpegStream, LocalColorSpaceCache (+4 more)

### Community 330 - "allowScripts"
Cohesion: 0.25
Nodes (8): allowScripts, electron@35.7.5, esbuild@0.28.1, prisma@7.8.0, @prisma/engines@7.8.0, puppeteer@25.1.0, sharp@0.34.5, unrs-resolver@1.12.2

### Community 333 - "Security posture: internal, trusted-network tool"
Cohesion: 0.67
Nodes (3): Authentication today, Authorization, Security posture: internal, trusted-network tool

### Community 336 - ".getUint16"
Cohesion: 0.08
Nodes (12): buildHuffmanTable(), convertBlackAndWhiteToRGBA(), convertToRGBA(), findNextFileMarker(), readOpenTypeHeader(), ii, ImageResizer, PDFImage (+4 more)

### Community 347 - "oi"
Cohesion: 0.48
Nodes (5): mi(), receiveInstance(), updateMemoryViews(), oi(), receiveInstance()

## Knowledge Gaps
- **1358 isolated node(s):** `dynamic`, `RouteContext`, `RouteContext`, `RouteContext`, `RouteContext` (+1353 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 2397 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **49 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `util_shadow()` connect `util_shadow` to `.get`, `pdf.worker.min.mjs`, `ColorSpace`, `unreachable`, `warn`, `Util`, `stringToBytes`, `.createDocumentHandler`, `.getTextContent`, `.success`, `.push`, `XMLParserBase`, `FormatError`, `.getUint16`, `navigateAfterAction`, `.parse`, `DecodeStream`, `.checkAndRepair`, `LabCS`?**
  _High betweenness centrality (0.139) - this node is a cross-community bridge._
- **Why does `reloadAfterAction()` connect `react` to `SectionCard`, `galley-actions.ts`, `job-detail-content.tsx`, `sheet-pdfs/actions.ts`, `invoices/actions.ts`, `GroupMemberReorderTable`, `rect-structure-workbook.tsx`, `structures/actions.ts`, `ShippingZonesManager`, `delivery-tickets/actions.ts`, `custom-structure-import.ts`, `delivery-ticket-detail-content.tsx`, `navigateAfterAction`, `walk-ins-board.tsx`, `job-structure-import-dialog.tsx`, `withDatabaseRetry`, `job-bidding-panel.tsx`, `send-actions.ts`, `job-utils.ts`, `job-files-browser.tsx`, `operations/actions.ts`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Why does `handleSubmit()` connect `navigateAfterAction` to `purchase-orders/actions.ts`, `react`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **What connects `dynamic`, `RouteContext`, `RouteContext` to the rest of the system?**
  _1358 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app/products/actions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08421985815602837 - nodes in this community are weakly interconnected._
- **Should `rect-structure.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0898989898989899 - nodes in this community are weakly interconnected._
- **Should `pdf.worker.min.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.009377319031235242 - nodes in this community are weakly interconnected._