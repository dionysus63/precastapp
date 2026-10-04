# Graph Report - precastapp  (2026-10-04)

## Corpus Check
- 764 files · ~485,497 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 3, .mdc 2, .example 1)

## Summary
- 8936 nodes · 26529 edges · 206 communities (168 shown, 38 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 228 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `417f0119`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app/products/actions.ts
- rect-structure.ts
- _
- OptionObject
- TemplateNamespace
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
- company-logo.ts
- quotes/actions.ts
- Option01
- product-form.tsx
- product-kinds.ts
- compilerOptions
- .createDocumentHandler
- .getTextContent
- rect-sheet-persistence.ts
- Glyph
- customers/actions.ts
- production-entry-form.tsx
- galley-actions.ts
- delivery-ticket-pdf-line-items.ts
- drain-ring-matrix-utils.ts
- drill-sheets/pdf-actions.ts
- drill-sheet-preview.tsx
- scripts
- job-detail-mapper.ts
- build
- FormatError
- translatePrismaError
- quote-line-items-table.tsx
- daily-production-entry.tsx
- rect-sheet-detail-view.tsx
- drill-sheet.ts
- .success
- products-list.tsx
- .getObj
- structure-bulk-import-form.tsx
- drill-sheet-form.tsx
- shipping/actions.ts
- XMLParserBase
- auth/constants.ts
- dependencies
- schedule/page.tsx
- price-list-service.ts
- BulkLoadPlanner
- postcss.config.mjs
- contact-actions.ts
- inventory/page.tsx
- quote-mapper.ts
- Handy Commands — Precast App
- devDependencies
- withDatabaseRetry
- delivery-ticket-utils.ts
- PsWasmCompiler
- quote-pdf-line-items.ts
- rect-sheet-detail.ts
- casting-ticket-lines.ts
- settings/actions.ts
- delivery-ticket-pdf-fill.ts
- reconcile-day.tsx
- getAppSettings
- pipe-modal.tsx
- XmlObject
- delivery-fulfillment.ts
- structure-utils.ts
- randomId
- calibrate-rect-templates.ts
- AGENTS.md
- walk-ins-board.tsx
- app_generated_prisma_client_prisma
- rect-structure-workbook.tsx
- .push
- jobs/actions.ts
- structure-workbook.tsx
- IntegerObject
- job-structure-import-dialog.tsx
- shipping-zones/actions.ts
- files/actions.ts
- calculateSHA256
- AnnotationBorderStyle
- input.tsx
- Precast Ops desktop updates
- invoice-pdf-fill.ts
- bid-actions.ts
- createRowId
- quote-pdf-data.ts
- app-settings.ts
- rect-structure-import.ts
- product-taxonomy.server.ts
- generate-invoice-templates.ts
- send-actions.ts
- XhtmlObject
- delivery-ticket-editor.tsx
- job-files-browser.tsx
- rect-pdf-set-service.ts
- plan-sheet-actions.ts
- windows-explorer.ts
- bulk-attach-board.tsx
- product-export.ts
- money-rules.ts
- Office deployment — single Windows server + UNC job folders
- Office rollout checklist
- next
- react
- printPdfUrl
- app/products/page.tsx
- .get
- LocaleSetNamespace
- delivery-tickets/pdf-actions.ts
- resolveDatabaseUrl
- Deployment server info checklist
- delivery-ticket-pdf-html.ts
- Troubleshooting
- .constructor
- structure-workbook-plan-takeoff.tsx
- Precast Ops
- ProductDocumentsSection
- .constructor
- todays-loads-panel.tsx
- delivery-dispatch-utils.ts
- outlook-draft.ts
- electron/package.json
- purchase-orders/actions.ts
- passArray8ToWasm0
- ref_path
- ring-builder-modal.tsx
- [...file]/route.ts
- prisma
- Job Structure Production Workflow
- customer-mapper.ts
- copy-pdf-worker.mjs
- signature_Signature
- main.mjs
- Stylesheet
- product-submittals-service.ts
- TextState
- Dict
- ExclGroup
- ChunkedStream
- StringObject
- invoice-mapper.ts
- warn
- NullOptimizer
- package.json
- DashboardShell
- print-pdf-url.ts
- submittal-package.ts
- job-folders.ts
- custom-structure-import.ts
- delivery-ticket-detail-content.tsx
- product-mapper.ts
- delivery-ticket-pdf-data.ts
- generate-circular-import-template.mjs
- circular-bulk-grid.tsx
- .checkAndRepair
- XFAObject
- CalRGBCS
- xdp_Xdp
- calculateSHA512
- SectionCard
- JpegImage
- SingleIntersector
- process-app-icon.ps1
- unreachable
- Color
- Phase 6 — Electron client (staff PCs)
- shadow
- allowScripts
- Security posture: internal, trusted-network tool
- assert
- ta

## God Nodes (most connected - your core abstractions)
1. `_` - 1180 edges
2. `withDatabaseRetry()` - 349 edges
3. `requirePermission()` - 335 edges
4. `XFAObject` - 206 edges
5. `next` - 200 edges
6. `SectionCard()` - 195 edges
7. `warn()` - 173 edges
8. `DashboardShell()` - 162 edges
9. `react` - 154 edges
10. `ConfigNamespace` - 141 edges

## Surprising Connections (you probably didn't know these)
- `Authentication today` --references--> `signInWithPassword()`  [INFERRED]
  AGENTS.md → app/login/actions.ts
- `Quote → JobStructure linking` --references--> `linkJobStructuresFromQuote()`  [INFERRED]
  docs/STRUCTURE_PRODUCTION_WORKFLOW.md → lib/job-structure-workflow.ts
- `handleDiscardSavedPlan()` --calls--> `discardSavedLoadPlan()`  [EXTRACTED]
  components/delivery-tickets/bulk-load-planner.tsx → app/delivery-tickets/actions.ts
- `AllDeliveryTicketsPage()` --indirect_call--> `mapDbDeliveryTicketToListRow()`  [INFERRED]
  app/delivery-tickets/all/page.tsx → lib/delivery-ticket-mapper.ts
- `JobsPage()` --indirect_call--> `mapJobToRow()`  [INFERRED]
  app/jobs/page.tsx → lib/job-mapper.ts

## Import Cycles
- None detected.

## Communities (206 total, 38 thin omitted)

### Community 0 - "app/products/actions.ts"
Cohesion: 0.07
Nodes (53): assertAllAssemblyComponentCodesExist(), BulkImportRow, bulkImportUpdateData(), collectAssemblyBomImportRows(), collectReferencedComponentCodes(), createFormProfileReader(), createProduct(), findExistingProductCodesAction() (+45 more)

### Community 1 - "rect-structure.ts"
Cohesion: 0.09
Nodes (36): annotateRectOpeningSections(), ComputedRectSection, computeHorizontalGeometry(), computeRectDefaultSumpFeet(), computeRectPricing(), computeRectStructure(), computeRectWallHeightFeet(), computeVerticalGeometry() (+28 more)

### Community 2 - "_"
Cohesion: 0.01
Nodes (323): _, 1072(), 1108(), 1148(), 116(), 1291(), 1385(), 1548() (+315 more)

### Community 3 - "OptionObject"
Cohesion: 0.02
Nodes (36): ADBE_JSConsole, ADBE_JSDebugger, Attributes, AutoSave, config_Validate, Conformance, Destination, DigestMethod (+28 more)

### Community 5 - "TemplateNamespace"
Cohesion: 0.01
Nodes (70): Arc, Barcode, Bind, Border, Break, BreakAfter, BreakBefore, Calculate (+62 more)

### Community 6 - ".getOperatorList"
Cohesion: 0.04
Nodes (26): 4576(), addCachedImageOps(), adjustWidths(), CheckedOperatorList, EvalState, fetchBinaryData(), generateFont(), getFamilyName() (+18 more)

### Community 7 - "structure-workbook.ts"
Cohesion: 0.11
Nodes (42): groupToneClasses(), pipeSizesForMaterial(), RowOpeningsEditor(), RowPenetrationsEditor(), StructureWorkbookGrid(), StructureWorkbookGridProps, uniquePipeMaterials(), applyDefaultsToBlankRow() (+34 more)

### Community 9 - "rect-structure-workbook.ts"
Cohesion: 0.08
Nodes (36): RectStructureWorkbook(), addRows(), duplicateSelected(), handleApply(), handleModeChange(), importRows(), repriceAllRows(), buildRectApplyLineItems() (+28 more)

### Community 10 - "ContentObject"
Cohesion: 0.02
Nodes (24): AlwaysEmbed, BehaviorOverride, BooleanElement, ContentObject, DateElement, DateTime, DateTimeSymbols, Decimal (+16 more)

### Community 11 - "rect-template-pdf.ts"
Cohesion: 0.09
Nodes (40): sectionJointHeightsFeet(), baseOffsetText(), BLACK, buildFlaps(), buildRectSheetFieldMap(), CalloutLayout, calloutSlotTops(), consumeMarkerField() (+32 more)

### Community 12 - "DeliveryTicketEditor"
Cohesion: 0.06
Nodes (46): DeliveryTicketEditor(), addExtraCustomLine(), addExtraProduct(), addWalkInLine(), applyAutoRingAssignment(), applyPickupListPrices(), buildPayload(), buildSplitDraft() (+38 more)

### Community 13 - ".add"
Cohesion: 0.04
Nodes (21): CFFCompiler, CFFIndex, CFFOffsetTracker, Commands, compileCharString(), bezierCurveTo(), lineTo(), moveTo() (+13 more)

### Community 14 - "drill-sheet-template-pdf.ts"
Cohesion: 0.05
Nodes (71): DrillSheetPreviewMeta, ComputedOpening, DrillSheetResult, appendDrillSheetFillablePage(), BORDER, drawField(), feet(), FieldContext (+63 more)

### Community 15 - "QuoteForm"
Cohesion: 0.06
Nodes (62): loadJobCustomStructureImportCandidates(), toPlainNumberString(), createDefaultCustomStructureRow(), createLineId(), QuoteForm(), addCategoryLine(), addLineItem(), addLineItems() (+54 more)

### Community 16 - "quote-form.tsx"
Cohesion: 0.03
Nodes (73): QuoteSaveDestination, reloadQuoteFormPriceOptions(), JobCustomStructureImportCandidate, collectRingOtherSubcategories(), formatJobAddress(), loadPipeProductsForQuoteForm(), loadQuoteFormPriceOptions(), mapPipeProductToQuoteOption() (+65 more)

### Community 17 - "company-logo.ts"
Cohesion: 0.12
Nodes (27): GET(), geistMono, geistSans, generateMetadata(), RootLayout(), CompanySettingsPage(), DEFAULT_APP_SETTINGS_DATA, COMPANY_LOGO_FILENAME (+19 more)

### Community 18 - "quotes/actions.ts"
Cohesion: 0.05
Nodes (69): assertGalleyFamiliesExist(), computeQuoteFinancials(), createQuote(), CreateQuoteInput, CreateQuoteLineItemInput, DeleteQuoteResult, isQuoteNumberConflict(), parseOptionalDate() (+61 more)

### Community 19 - "Option01"
Cohesion: 0.03
Nodes (20): AddSilentPrint, AddViewerPreferences, Change, CompressLogicalStructure, config_Encrypt, ContentCopy, DocumentAssembly, Embed (+12 more)

### Community 20 - "product-form.tsx"
Cohesion: 0.05
Nodes (45): CastingComponentPickerOption, CastingSupplierOption, drainRingDiameterOptions, ProductForm(), handleCategoryChange(), handleProductKindChange(), handleProductTypeChange(), handleRingDiameterChange() (+37 more)

### Community 21 - "product-kinds.ts"
Cohesion: 0.07
Nodes (33): parseBulkPaste(), presetPreviewColumns(), formatSanitaryDrainRingDiametersLabel(), isRecognizedBulkRingStyle(), BulkImportPreset, bulkImportPresetLabels, bulkImportPresets, bulkPasteAdsPipeBaseHeaders (+25 more)

### Community 22 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 23 - ".createDocumentHandler"
Cohesion: 0.04
Nodes (28): AbortException, arrayBuffersToBytes(), BasePdfManager, BasePDFStream, JpxError, ln, LocalPdfManager, MessageHandler (+20 more)

### Community 24 - ".getTextContent"
Cohesion: 0.06
Nodes (21): BaseLocalCache, DataHandler, GlobalColorSpaceCache, LocalGStateCache, LocalImageCache, LocalTilingPatternCache, addFakeSpaces(), appendEOL() (+13 more)

### Community 25 - "rect-sheet-persistence.ts"
Cohesion: 0.13
Nodes (35): BulkSheetRowInput, bulkUpdateDrillSheets(), bulkUpdateRectSheets(), runBulkUpdate(), buildCalcData(), buildCastingCreate(), buildOpeningsCreate(), buildSectionsCreate() (+27 more)

### Community 26 - "Glyph"
Cohesion: 0.08
Nodes (6): CompositeGlyph, Contour, GlyfTable, Glyph, GlyphHeader, SimpleGlyph

### Community 27 - "customers/actions.ts"
Cohesion: 0.08
Nodes (40): BulkImportRow, checkBulkCustomerDbDuplicates(), createCustomer(), CUSTOMER_STATUSES, CustomerRecordInput, deleteCustomer(), importCustomers(), ImportCustomersResult (+32 more)

### Community 28 - "production-entry-form.tsx"
Cohesion: 0.07
Nodes (37): GlobalError(), isStaleDeploymentError(), searchInventoryProducts(), NotFound(), saveProductionEntry(), FormTypeahead(), closeDropdown(), handleContainerBlur() (+29 more)

### Community 29 - "galley-actions.ts"
Cohesion: 0.14
Nodes (25): injectGalleyFamilyOptions(), applyGalleyBreakdown(), ApplyGalleyBreakdownResult, BREAKDOWN_STATUSES, BreakdownDialog(), submit(), formatMixSummary(), GalleyBreakdownBanner() (+17 more)

### Community 30 - "delivery-ticket-pdf-line-items.ts"
Cohesion: 0.07
Nodes (49): COL_DESC_WIDTH, COL_DESC_X, COL_ITEM_NUM_WIDTH, COL_ITEM_NUM_X, COL_QTY_WIDTH, COL_QTY_X, DEFAULT_TABLE_LAYOUT, DeliveryTicketTableLayout (+41 more)

### Community 31 - "drain-ring-matrix-utils.ts"
Cohesion: 0.08
Nodes (37): DrainRingMatrixRows(), DrainRingMatrixRowsProps, DrainRingStyleTable(), DrainRingStyleTableProps, FEET_STAT_COLUMNS, ringStockClassName(), ringStockLabel(), allocateRingsAcrossPools() (+29 more)

### Community 32 - "drill-sheets/pdf-actions.ts"
Cohesion: 0.10
Nodes (37): DrillSheetPreviewPage(), generateDrillSheetPdf(), GenerateDrillSheetPdfResult, generateJobDrillSheetsPdf(), GenerateJobDrillSheetsPdfResult, generateRectSheetPdf(), DrillSheetPdfCanvasPreview(), loadPdf() (+29 more)

### Community 33 - "drill-sheet-preview.tsx"
Cohesion: 0.11
Nodes (41): CalcRow(), DrillSheetPreview(), DrillSheetPreviewProps, feet(), HeaderRow(), PlanDiagram(), PreviewPanel(), angleToClockPosition() (+33 more)

### Community 34 - "scripts"
Cohesion: 0.11
Nodes (19): scripts, build, db:seed, db:sync-files, deploy:build, deploy:check, deploy:start, deploy:update (+11 more)

### Community 35 - "job-detail-mapper.ts"
Cohesion: 0.03
Nodes (120): updateJobCustomerAction(), updateJobStatusAction(), listCustomersForBidList(), JobTabContent(), JobTabContentProps, JobDetailPage(), JobDetailPageProps, resolveTab() (+112 more)

### Community 36 - "build"
Cohesion: 0.11
Nodes (18): build, appId, directories, extraResources, icon, nsis, productName, publish (+10 more)

### Community 37 - "FormatError"
Cohesion: 0.04
Nodes (22): CFF, CFFCharset, CFFDict, CFFFDSelect, CFFHeader, CFFParser, CFFPrivateDict, CFFStrings (+14 more)

### Community 38 - "translatePrismaError"
Cohesion: 0.17
Nodes (21): createSheetPdfSetAction(), deleteSheetPdfSetAction(), deleteSheetPdfSetFileAction(), parseBooleanField(), renameSheetPdfSetAction(), revalidate(), uploadSheetPdfSetFileAction(), SHAPE_LABELS (+13 more)

### Community 39 - "quote-line-items-table.tsx"
Cohesion: 0.09
Nodes (37): CustomStructureCostBreakdown(), addItem(), CustomStructureCostBreakdownProps, CustomStructureDetailBreakdown(), CustomStructurePricingFooter(), CustomStructurePricingFooterProps, buildCreateQuoteInput(), autoResizeTextarea() (+29 more)

### Community 40 - "daily-production-entry.tsx"
Cohesion: 0.17
Nodes (16): saveDailyProductionDay(), DailyProductionPage(), DailyProductionPageProps, DailyProductionEntry(), save(), DailyProductionEntryProps, localToday(), shiftDate() (+8 more)

### Community 41 - "rect-sheet-detail-view.tsx"
Cohesion: 0.11
Nodes (28): aboveFloorText(), fmtElevation(), InfoRow(), placementText(), RectSheetDetailView(), RectSheetDetailViewProps, Stat(), wholeInches() (+20 more)

### Community 42 - "drill-sheet.ts"
Cohesion: 0.07
Nodes (38): annotateOpeningSections(), buildSolverHoles(), compareCost(), computeDefaultSumpFeet(), computeDrillSheet(), ComputedSection, ComputedWeights, computeInvertToTopFeet() (+30 more)

### Community 43 - ".success"
Cohesion: 0.03
Nodes (48): applyAssist(), ariaLabel(), bf, Caption, CheckButton, checkDimensions(), ChoiceList, computeBbox() (+40 more)

### Community 44 - "products-list.tsx"
Cohesion: 0.04
Nodes (75): InvoiceListRow, toggleJobFavorite(), PaginationControls(), PaginationControlsProps, useDebouncedSearchParam(), useListQuery(), ContactDirectoryRow, ContactsDirectory() (+67 more)

### Community 45 - ".getObj"
Cohesion: 0.03
Nodes (32): addHex(), BinaryCMapReader, BinaryCMapStream, CMap, CMapFactory, Cmd, createBuiltInCMap(), expectInt() (+24 more)

### Community 46 - "structure-bulk-import-form.tsx"
Cohesion: 0.12
Nodes (36): buildCastingResolver(), CastingResolution, importPipeOpenings(), importRectOpenings(), ImportRowInput, ImportRowMessage, importStructureTemplates(), importTemplates() (+28 more)

### Community 47 - "drill-sheet-form.tsx"
Cohesion: 0.11
Nodes (24): buildCommittedPreview(), CommittedOpeningNumbers, CommittedPreviewNumbers, connectionOptions, createOpening(), DiameterConfigOption, DrillSheetCastingOption, DrillSheetForm() (+16 more)

### Community 48 - "shipping/actions.ts"
Cohesion: 0.10
Nodes (35): lookupShippingRate(), lookupShippingRateAtPoint(), resolveShippingRateForPoint(), ShippingLookupResult, ShippingLookupSuccess, suggestShippingAddresses(), AddressAutocomplete(), closeDropdown() (+27 more)

### Community 50 - "XMLParserBase"
Cohesion: 0.06
Nodes (7): DatasetXMLParser, MetadataParser, SimpleDOMNode, SimpleXMLParser, XFAParser, XMLParserBase, skipWs()

### Community 51 - "auth/constants.ts"
Cohesion: 0.06
Nodes (50): findSimilarCustomers(), CustomerFormProps, CustomerFormValues, customerInputClassName, customerStatusFormOptions, Header(), HeaderProps, NAV_ICON_PATHS (+42 more)

### Community 52 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, leaflet, next, nodemailer, pdf-lib, @pdf-lib/fontkit, pdf-to-printer, pdfjs-dist (+11 more)

### Community 53 - "schedule/page.tsx"
Cohesion: 0.14
Nodes (21): DeliveryTicketsPage(), startOfToday(), EDITABLE_STATUSES, EmptyState(), ScheduleLoadsPage(), ScheduleLoadsPageProps, ACTIVE_PICKUP_STATUSES, formatDate() (+13 more)

### Community 54 - "price-list-service.ts"
Cohesion: 0.05
Nodes (57): createPriceList(), createPriceListFormAction(), updatePriceListSettings(), assertDiametersHaveMolds(), createStructureTemplate(), deleteStructureTemplate(), duplicateStructureTemplate(), handlePrismaError() (+49 more)

### Community 55 - "BulkLoadPlanner"
Cohesion: 0.13
Nodes (30): buildRows(), BulkLoadPlanner(), addLoad(), autoRingCount(), buildLoadLines(), buildPayload(), castingGroupIsEven(), castingSetsForLoad() (+22 more)

### Community 57 - "contact-actions.ts"
Cohesion: 0.10
Nodes (36): addCustomerContact(), BulkContactDbState, BulkContactImportRow, CONTACT_ROLES, CustomerContactInput, deleteCustomerContact(), ImportContactsResult, loadContactRows() (+28 more)

### Community 64 - "inventory/page.tsx"
Cohesion: 0.06
Nodes (61): AGGREGATE_SORT_COLUMNS, CONTACT_SORT_COLUMNS, ContactSortColumn, CUSTOMER_SORT_FIELDS, CustomerSortColumn, CustomersPage(), isAggregateSortColumn(), loadCustomerAggregates() (+53 more)

### Community 65 - "quote-mapper.ts"
Cohesion: 0.05
Nodes (57): mapStructure(), needsDrillSheetWhere, ProductionPage(), structureInclude, QuotePreviewPage(), QuotePreviewPageProps, QUOTE_LIST_SELECT, QuotesPage() (+49 more)

### Community 66 - "Handy Commands — Precast App"
Cohesion: 0.15
Nodes (13): App (Next.js), Browse data, Daily workflow, Database backups, Electron desktop client, Git / GitHub (optional), Handy Commands — Precast App, Office deployment (Windows server) (+5 more)

### Community 67 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, electron, electron-builder, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx (+8 more)

### Community 68 - "withDatabaseRetry"
Cohesion: 0.04
Nodes (110): GET(), checkBulkContactDbState(), assertQuoteLinkable(), buildLineCreates(), buildLinesPayload(), createDeliveryTicket(), DeliveryTicketActionResult, discardSavedLoadPlan() (+102 more)

### Community 69 - "delivery-ticket-utils.ts"
Cohesion: 0.08
Nodes (31): setStandardLineQuantity(), toggleLine(), mapFulfillmentToLine(), mergeFulfillmentIntoLine(), deliveryDateFilterOptions, DeliveryFilterOptions, deliveryTicketCustomerOptions, DeliveryTicketDetailLineItem (+23 more)

### Community 70 - "PsWasmCompiler"
Cohesion: 0.05
Nodes (26): ast_Parser, buildPostScriptWasmFunction(), encodeASCIIString(), lexer_Lexer, _nodesEqual(), parsePostScriptFunction(), PsArgNode, PsBinaryNode (+18 more)

### Community 71 - "quote-pdf-line-items.ts"
Cohesion: 0.08
Nodes (46): toWinAnsiText(), COL_DESC_WIDTH, COL_DESC_X, COL_ITEM_NUM_WIDTH, COL_ITEM_NUM_X, COL_QTY_WIDTH, COL_QTY_X, COL_TOTAL_WIDTH (+38 more)

### Community 72 - "rect-sheet-detail.ts"
Cohesion: 0.10
Nodes (31): DrillSheetDetailPage(), DrillSheetDetailPageProps, loadJobSheetNav(), RectSheetDetail(), DeleteDrillSheetButton(), DeleteDrillSheetButtonProps, DrillSheetJobNav(), JobSheetNavEntry (+23 more)

### Community 73 - "casting-ticket-lines.ts"
Cohesion: 0.25
Nodes (8): CastingCollapseMeta, CastingCollapsibleLine, CastingExplodeComponent, CastingExplodedPiece, collapseCastingTicketLines(), perSetByProduct(), setWeightFor(), META

### Community 74 - "settings/actions.ts"
Cohesion: 0.11
Nodes (37): clearAllCustomersFormAction(), clearAllDeliveryTicketsFormAction(), clearAllJobsFormAction(), clearAllProductsFormAction(), clearAllQuotesFormAction(), clearAllStructuresFormAction(), DataResetStats, getDataResetStats() (+29 more)

### Community 75 - "delivery-ticket-pdf-fill.ts"
Cohesion: 0.14
Nodes (25): DeliveryTicketContentPage, DeliveryTicketPdfFillOptions, buildContentPageBytes(), buildCopyPdfBytes(), fillAcroFormFields(), fitTermsField(), generateDeliveryTicketCopyPdfBytes(), generateDeliveryTicketPdfBytes() (+17 more)

### Community 76 - "reconcile-day.tsx"
Cohesion: 0.08
Nodes (35): deleteProductCategory(), deleteProductSubcategory(), CustomerDetailContent(), CustomerDetailContentProps, sectionCount(), StatTile(), DeleteCustomerButton(), DeleteCustomerButtonProps (+27 more)

### Community 77 - "getAppSettings"
Cohesion: 0.11
Nodes (42): checkJobsRootReadAccess(), ensureYearSequencesAction(), getDocumentNumberingPreview(), syncAllJobFilesFromSettingsAction(), testJobsRootWriteAccessAction(), testStockSubmittalsRootWriteAccessAction(), updatePrintingSettingsFormAction(), BillingSettingsPage() (+34 more)

### Community 78 - "pipe-modal.tsx"
Cohesion: 0.11
Nodes (31): createDefaultQuoteRow(), createRowId(), PipeModal(), handleAddQuoteLines(), handleAddUnitPricesToDescription(), handleClose(), resetModal(), PipeModalMode (+23 more)

### Community 79 - "XmlObject"
Cohesion: 0.04
Nodes (9): Builder, Datasets, datasets_Data, DatasetsNamespace, Empty, Root, UnknownNamespace, XFAAttribute (+1 more)

### Community 80 - "delivery-fulfillment.ts"
Cohesion: 0.06
Nodes (51): CandidateDraft, EmptyState(), mapDraftToCells(), PlanLoadsPage(), PlanLoadsPageProps, updateQuoteStatus(), loadCastingComponentOptionsByAssembly(), loadCastingComponentOptionsForAssembly() (+43 more)

### Community 81 - "structure-utils.ts"
Cohesion: 0.09
Nodes (28): JobStructureFormProps, CastingRow, createCastingRow(), createOpeningRow(), OpeningRow, placeholderCastings, placeholderOpenings, StructureStatus (+20 more)

### Community 82 - "randomId"
Cohesion: 0.05
Nodes (57): handleOpenFolder(), AssemblyOption, createRow(), prefillRowsFromPurchaseOrder(), ProductOption, PurchaseReceiptForm(), addLine(), handleSelectPurchaseOrder() (+49 more)

### Community 83 - "calibrate-rect-templates.ts"
Cohesion: 0.05
Nodes (49): BASE_SLAB_ONLY_FIELDS, RECT_ELEVATION_WALL_MARKER_FIELD, RECT_EXPLODED_CENTER_MARKER_FIELD, RECT_EXPLODED_MARKER_FIELD, RECT_OPENING_ROWS, RECT_SHEET_TEMPLATE_FIELD_NAMES, RECT_TOP_SLAB_MARKER_FIELD, RECT_WEIGHT_PIECE_LINES (+41 more)

### Community 84 - "AGENTS.md"
Cohesion: 0.38
Nodes (4): Codebase exploration: use graphify first, Prisma / Database Rules, Project context, This is NOT the Next.js you know

### Community 85 - "walk-ins-board.tsx"
Cohesion: 0.21
Nodes (15): MarkPickedUpControl(), handleConfirm(), MarkPickedUpControlProps, BadgeVariant, CalledInPickupCard(), CompletedPickupCard(), dateLine(), itemsPaymentLine() (+7 more)

### Community 86 - "app_generated_prisma_client_prisma"
Cohesion: 0.09
Nodes (21): allocateDeliveryTicketNumber(), deriveInvoiceNumberFromTicket(), formatTicketNumber(), GLOBAL_DELIVERY_TICKET_SEQUENCE_YEAR, batchConvertDeliveredTicketsToInvoices(), BatchInvoiceConversionResult, CastingSetCharge, castingSetsStarted() (+13 more)

### Community 87 - "rect-structure-workbook.tsx"
Cohesion: 0.08
Nodes (46): completeRectDrillSheets(), createOpening(), createSection(), RectOpeningField, RectSheetCastingOption, RectSheetFormProps, RectSheetOpeningSizeOption, RectSheetTemplateOption (+38 more)

### Community 88 - ".push"
Cohesion: 0.04
Nodes (29): addChildren(), Binder, buildHuffmanTable(), ChoiceWidgetAnnotation, ChunkedStreamManager, createDataNode(), createText(), DefaultAppearanceEvaluator (+21 more)

### Community 89 - "jobs/actions.ts"
Cohesion: 0.09
Nodes (39): allocateJobNumber(), createJobStructure(), deleteJobStructureDocumentAction(), formatJobNumber(), JOB_STATUSES, JobFormCustomerOption, JobStructureExplorerOpenResult, openJobStructureDocument() (+31 more)

### Community 90 - "structure-workbook.tsx"
Cohesion: 0.10
Nodes (32): JobSheetImportCandidate, PlanSheetRecord, DrillSheetTemplateOption, JobSheetImportDialog(), JobSheetImportDialogProps, pipeSizesForMaterial(), StructureWorkbookDefaultsPanel(), StructureWorkbookDefaultsPanelProps (+24 more)

### Community 91 - "IntegerObject"
Cohesion: 0.05
Nodes (13): AdjustData, AdobeExtensionLevel, CompressObjectStream, Copies, CurrentPage, IntegerObject, Level, MsgId (+5 more)

### Community 92 - "job-structure-import-dialog.tsx"
Cohesion: 0.11
Nodes (28): importJobStructuresFromConfigs(), JobStructureImportEntry, buildPreview(), Cell, detectShape(), ImportOptions, JobStructureImportButton(), handleImport() (+20 more)

### Community 93 - "shipping-zones/actions.ts"
Cohesion: 0.15
Nodes (21): createShippingZone(), deleteShippingZone(), revalidateShippingZonePaths(), setYardLocation(), ShippingZoneInput, updateShippingZone(), ValidatedZone, validateZoneInput() (+13 more)

### Community 94 - "files/actions.ts"
Cohesion: 0.20
Nodes (22): ExplorerOpenResult, openJobFolderCategory(), syncAllFiles(), SyncAllFilesResult, pathExists(), resolveUniqueFilePath(), assertJobFolderPath(), assertPathUnderJobRoot() (+14 more)

### Community 95 - "calculateSHA256"
Cohesion: 0.36
Nodes (8): calculate_sha256_ch(), calculate_sha256_littleSigma(), calculate_sha256_littleSigmaPrime(), calculate_sha256_maj(), calculate_sha256_sigma(), calculate_sha256_sigmaPrime(), calculateSHA256(), rotr()

### Community 97 - "input.tsx"
Cohesion: 0.40
Nodes (3): inputClassName, InputProps, textareaClassName

### Community 98 - "Precast Ops desktop updates"
Cohesion: 0.40
Nodes (4): Precast Ops desktop updates, Publish a desktop update (from the dev PC), Verify (from any office PC), Which machine does what

### Community 99 - "invoice-pdf-fill.ts"
Cohesion: 0.15
Nodes (16): buildInvoicePageBytes(), drawDraftWatermark(), ensureInvoiceTemplateExists(), fillAcroFormFields(), getInvoiceContinuationTemplatePath(), getInvoiceTemplatePath(), readInvoiceContinuationTemplateBytes(), readInvoiceTemplateBytes() (+8 more)

### Community 100 - "bid-actions.ts"
Cohesion: 0.18
Nodes (18): addJobBidder(), awardJob(), generateQuotesFromMaster(), removeJobBidder(), buildContactMapForGenerate(), buildDefaultContactMap(), JobBiddingPanel(), handleAddBidder() (+10 more)

### Community 101 - "createRowId"
Cohesion: 0.22
Nodes (14): JobSheetImportCandidates, loadJobSheetImportCandidates(), STATUS_LABELS, DecimalLike, decimalToInput(), lowestInvertText(), mapCircularSheetToWorkbookRow(), mapRectSheetToWorkbookRow() (+6 more)

### Community 102 - "quote-pdf-data.ts"
Cohesion: 0.12
Nodes (28): removeFlattenLeftovers(), QuoteLineItemRecord, QuoteRecord, blankOr(), buildQuoteFormData(), DbQuoteForPdf, formatDateForPdf(), formatMoneyForPdf() (+20 more)

### Community 104 - "app-settings.ts"
Cohesion: 0.08
Nodes (30): updateRolePermissionsFormAction(), RolesSettingsPage(), RolesSettingsPageProps, saveRolePermissions(), EditSettingsUserPage(), NewSettingsUserPage(), RolePermissionsSettingsForm(), deriveOverrides() (+22 more)

### Community 105 - "rect-structure-import.ts"
Cohesion: 0.19
Nodes (16): RectImportDialog(), handleFile(), handlePasteParse(), RectImportDialogProps, Cell, cellText(), findHeaderRow(), gridFromTsv() (+8 more)

### Community 106 - "product-taxonomy.server.ts"
Cohesion: 0.18
Nodes (19): ensureTaxonomyForBulkImport(), fetchActiveProductTaxonomy(), resolveTaxonomyByNamesForImport(), validateTaxonomySelection(), analyzeTaxonomyByNames(), buildCategoryFilterOptions(), buildSubcategoryFilterOptions(), categoryNameMatches() (+11 more)

### Community 108 - "generate-invoice-templates.ts"
Cohesion: 0.12
Nodes (25): CONT_TABLE_BOTTOM_Y, MAIN_TABLE_BOTTOM_Y, addTextField(), BLACK, BOTTOM_BOX, buildTemplate(), Ctx, drawBox() (+17 more)

### Community 110 - "send-actions.ts"
Cohesion: 0.06
Nodes (57): findSupersededBy(), getSendQuoteDefaults(), getSendQuoteEmailConfigured(), OpenOutlookDraftResult, openQuoteInOutlook(), sendQuote(), SendQuoteDefaults, SendQuoteInput (+49 more)

### Community 111 - "XhtmlObject"
Cohesion: 0.04
Nodes (21): a, B, Body, br, Button, fixURL(), Html, _i (+13 more)

### Community 112 - "delivery-ticket-editor.tsx"
Cohesion: 0.05
Nodes (44): DeliveryTicketJobSearchOption, DeliveryTicketLineInput, PlannedLoadInput, SaveDeliveryTicketInput, SavePlannedLoadsInput, ScheduleLoadUpdate, BulkLoadPlannerProps, CategoryRow (+36 more)

### Community 114 - "job-files-browser.tsx"
Cohesion: 0.06
Nodes (55): openJobFile(), revalidateFilesPaths(), syncJobFilesAction(), uploadJobFileAction(), createJobFolder(), openJobFolder(), FileUploadDropzone(), handleFiles() (+47 more)

### Community 115 - "rect-pdf-set-service.ts"
Cohesion: 0.22
Nodes (16): sanitizeFileName(), assertPathUnderRoot(), deleteRectPdfSetFile(), getRectPdfSetsRoot(), PDF_EXTENSIONS, readRectPdfSetFileBytes(), RectSheetPdfSetFileRecord, saveRectPdfSetFile() (+8 more)

### Community 117 - "plan-sheet-actions.ts"
Cohesion: 0.14
Nodes (20): GET(), RouteContext, getPlanSheetForOpen(), listJobConstructionPlanPdfs(), mapPlanSheetRow(), pathExists(), savePlanSheetMarkup(), saveUploadedPlanPdf() (+12 more)

### Community 118 - "windows-explorer.ts"
Cohesion: 0.10
Nodes (34): ClientPathMapping, getClientPathMappings(), stripTrailingSeparators(), toClientOpenPath(), translateToClientPath(), assertDirectoryExists(), assertFileExists(), assertPathAccessible() (+26 more)

### Community 119 - "bulk-attach-board.tsx"
Cohesion: 0.19
Nodes (17): approveStructureForProduction(), BulkAttachPage(), handleConfirm(), BulkAttachBoard(), getTile(), handleFiles(), renderTile(), selectMode() (+9 more)

### Community 120 - "product-export.ts"
Cohesion: 0.08
Nodes (40): GET(), GET(), DeliveryTicketDetailPage(), getDraftInvoiceEditorData(), EditDraftInvoicePage(), PageProps, InvoiceDetailPage(), getSettingsHubStatus() (+32 more)

### Community 121 - "money-rules.ts"
Cohesion: 0.17
Nodes (16): computePreviewTotals(), Decimal, DecimalInstance, DecimalLike, toDecimal(), ComputedMoneyTotals, computeMoneyTotals(), MoneyLineInput (+8 more)

### Community 122 - "Office deployment — single Windows server + UNC job folders"
Cohesion: 0.11
Nodes (18): Architecture, End-to-end smoke test, Firewall, Important behavior, Install prerequisites, Office deployment — single Windows server + UNC job folders, Ongoing maintenance, Phase 1 — Prepare the Windows server (+10 more)

### Community 123 - "Office rollout checklist"
Cohesion: 0.12
Nodes (17): 1. Server URL for the desktop app, 2. First install on each staff PC, 3. Staff expectations, 4. Role walkthrough (recommended), 5. Backups, 6. Support contacts, 7. Post-rollout verification (first week), Database (nightly recommended) (+9 more)

### Community 124 - "next"
Cohesion: 0.04
Nodes (83): GET(), parseCopyParam(), RouteContext, GET(), RouteContext, GET(), rectPreviewResponse(), RouteContext (+75 more)

### Community 125 - "react"
Cohesion: 0.05
Nodes (72): BulkStructureStatus, markStructureMade(), startStructureProduction(), deleteQuote(), setQuoteTaxExempt(), updateQuoteCustomerPo(), addProductGroupMembersFormAction(), GroupEditor() (+64 more)

### Community 126 - "printPdfUrl"
Cohesion: 0.05
Nodes (53): DeliveryTicketPreviewPage(), DeliveryTicketPreviewPageProps, PREVIEW_ORIGINS, DeliveryTicketSubmittalPreviewPage(), DeliveryTicketSubmittalPreviewPageProps, generateDeliveryTicketPdf(), printDeliveryTicketDirect(), printDeliveryTicketSubmittalsDirect() (+45 more)

### Community 127 - "app/products/page.tsx"
Cohesion: 0.09
Nodes (44): listStockProductsForTicket(), EDIT_ORIGINS, EditDeliveryTicketPage(), EditDeliveryTicketPageProps, NewDeliveryTicketPage(), NewDeliveryTicketPageProps, TICKET_ORIGINS, listJobsWithQuotes() (+36 more)

### Community 128 - ".get"
Cohesion: 0.03
Nodes (57): 1181(), 7416(), Annotation, AnnotationFactory, ao, CaretAnnotation, appendIfJavaScriptDict(), addPageDict() (+49 more)

### Community 129 - "LocaleSetNamespace"
Cohesion: 0.03
Nodes (24): CalendarSymbols, CurrencySymbol, CurrencySymbols, DatePattern, DatePatterns, Day, DayNames, Era (+16 more)

### Community 130 - "delivery-tickets/pdf-actions.ts"
Cohesion: 0.10
Nodes (33): GET(), parseVariant(), RouteContext, DeliveryTicketPdfPreviewResult, GenerateDeliveryTicketPdfResult, getDeliveryTicketPdfPreviewBase64(), loadTicketForPdf(), PrintDeliveryTicketDirectResult (+25 more)

### Community 131 - "resolveDatabaseUrl"
Cohesion: 0.21
Nodes (13): decodeApiKey(), PrismaDevPayload, resolveDatabaseUrl(), resolvePrismaDevPayload(), resolveShadowDatabaseUrl(), databaseUrl, shadowDatabaseUrl, pg (+5 more)

### Community 134 - "Deployment server info checklist"
Cohesion: 0.22
Nodes (9): Database, Deployment server info checklist, Electron client, File shares (UNC), Network, PDF generation, Post-deploy verification, Server (+1 more)

### Community 136 - "delivery-ticket-pdf-html.ts"
Cohesion: 0.16
Nodes (20): CompanyProfile, getCompanyProfile(), DeliveryTicketCopySettings, DeliveryTicketPdfView, getDeliveryTicketCopyTitles(), addressBlockHtml(), buildDeliveryTicketPdfHtml(), escapeHtml() (+12 more)

### Community 137 - "Troubleshooting"
Cohesion: 0.33
Nodes (6): `P1001` — Can't reach database server, Password authentication failed, Port 3000 already in use, Prisma Studio — "Could not load schema metadata", Quote PDF — "Could not find Chrome" / browser not found, Troubleshooting

### Community 138 - ".constructor"
Cohesion: 0.11
Nodes (10): BaseShading, buildMeshVertexData(), DummyShading, FunctionBasedShading, getB(), LZWStream, MeshShading, MeshStreamReader (+2 more)

### Community 139 - "structure-workbook-plan-takeoff.tsx"
Cohesion: 0.11
Nodes (28): pipeSizesForMaterial(), uniquePipeMaterials(), bearingFromDelta(), commitRow(), DragState, pdfToScreen(), PipePopup(), polarToScreenPoint() (+20 more)

### Community 141 - "Precast Ops"
Cohesion: 0.40
Nodes (5): Desktop shell (optional), Local development, Office deployment, Precast Ops, Project docs

### Community 142 - "ProductDocumentsSection"
Cohesion: 0.20
Nodes (15): deleteProductDocumentAction(), openProductDocument(), openProductSubmittalsFolder(), revalidateProductPaths(), scanProductDocumentsAction(), uploadProductDocumentAction(), InventorySubmittalsCell(), handleOpen() (+7 more)

### Community 150 - ".constructor"
Cohesion: 0.28
Nodes (3): ARCFourCipher, calculateMD5(), CipherTransformFactory

### Community 151 - "todays-loads-panel.tsx"
Cohesion: 0.18
Nodes (14): UpdateTicketDriverResult, deliveryTicketStatusLabels, DriverSelect(), FleetAssignSelect(), handleChange(), FleetAssignSelectProps, TrailerSelect(), CONFIRM_MESSAGES (+6 more)

### Community 152 - "delivery-dispatch-utils.ts"
Cohesion: 0.24
Nodes (12): DeliveryTicketRow, DispatcherWeekCalendar, DispatcherWeekCalendarProps, getReferenceDateForWeekOffset(), DISPATCH_STATUSES, formatWeekRangeLabel(), getDispatchDays(), getTodaysScheduledLoads() (+4 more)

### Community 153 - "outlook-draft.ts"
Cohesion: 0.31
Nodes (8): RFC-2047, base64Lines(), buildQuoteDraftEml(), encodeHeaderText(), QuoteDraftEmlInput, sanitizeFilename(), buildSample(), fakePdf

### Community 154 - "electron/package.json"
Cohesion: 0.20
Nodes (9): author, dependencies, electron-updater, description, main, name, private, productName (+1 more)

### Community 155 - "purchase-orders/actions.ts"
Cohesion: 0.04
Nodes (87): InventoryProductSearchOption, resolveReceivingCategory(), saveInventoryAdjustment(), savePurchaseReceipt(), InventoryReceiptsPage(), InventoryReceiptsPageProps, createPurchaseOrder(), parseDate() (+79 more)

### Community 156 - "passArray8ToWasm0"
Cohesion: 0.24
Nodes (4): getUint8ArrayMemory0(), Name, passArray8ToWasm0(), __wbg_get_imports()

### Community 157 - "ref_path"
Cohesion: 0.11
Nodes (22): acquirePageSlot(), getSharedBrowser(), getWindowsBrowserPaths(), globalForBrowser, launchBrowser(), pageWaiters, pathExists(), releasePageSlot() (+14 more)

### Community 158 - "ring-builder-modal.tsx"
Cohesion: 0.07
Nodes (55): createDefaultHeightPoolRow(), createRowId(), formatRingBuilderUnitPrice(), HeightPoolRow, initOtherInputs(), OtherProductInput, OtherSection(), RingBuilderModal() (+47 more)

### Community 159 - "[...file]/route.ts"
Cohesion: 0.33
Nodes (3): CONTENT_TYPES, RouteContext, UPDATES_DIR

### Community 160 - "prisma"
Cohesion: 0.07
Nodes (49): getActiveLoginUsers(), getActiveUserForLogin(), LoginUserOption, parsePasswordFields(), signInWithPassword(), signOut(), LoginPage(), ProfilePage() (+41 more)

### Community 161 - "Job Structure Production Workflow"
Cohesion: 0.33
Nodes (5): Dates, Delivery eligibility, Job Structure Production Workflow, Quote → JobStructure linking, Server actions

### Community 162 - "customer-mapper.ts"
Cohesion: 0.06
Nodes (42): importContacts(), BulkContactPasteForm(), handleImport(), handleParsePreview(), parseBulkContactPaste(), parseBulkPaste(), bulkContactColumnHeaders, bulkContactExample (+34 more)

### Community 163 - "copy-pdf-worker.mjs"
Cohesion: 0.33
Nodes (4): projectRoot, scriptDir, workerSource, workerTarget

### Community 165 - "main.mjs"
Cohesion: 0.12
Nodes (26): __dirname, getUserConfigPath(), loadConfig(), readJsonFile(), validateServerUrl(), buildApplicationMenu(), createWindow(), __dirname (+18 more)

### Community 168 - "product-submittals-service.ts"
Cohesion: 0.23
Nodes (21): getStockSubmittalsRoot(), assertPathUnderStockSubmittalsRoot(), assertProductExists(), collectSubmittalFilesForCode(), deleteProductDocument(), getProductDocumentForOpen(), getProductSubmittalDir(), listRootEntries() (+13 more)

### Community 172 - "Dict"
Cohesion: 0.04
Nodes (29): 7642(), 9835(), ButtonWidgetAnnotation, codePointIter(), computeIDs(), createImage(), createImageDict(), createPNGLikeImage() (+21 more)

### Community 173 - "ExclGroup"
Cohesion: 0.05
Nodes (11): addHTML(), Area, createLine(), ExclGroup, flushHTML(), getAvailableSpace(), getContainedChildren(), Image (+3 more)

### Community 175 - "StringObject"
Cohesion: 0.02
Nodes (41): Amd, AppearanceFilter, Base, Certificate, config_Picture, connection_set_Uri, ConnectionSet, ConnectionSetNamespace (+33 more)

### Community 176 - "invoice-mapper.ts"
Cohesion: 0.53
Nodes (5): formatDate(), formatMoney(), InvoiceDetailView, mapDbInvoiceToDetailView(), statusVariant()

### Community 179 - "warn"
Cohesion: 0.03
Nodes (37): Ascii85Stream, AsciiHexStream, BrotliStream, bytesToString(), addPageError(), CCITTFaxStream, parseOperand(), CipherTransform (+29 more)

### Community 186 - "package.json"
Cohesion: 0.08
Nodes (25): eslintConfig, main, name, postcss, overrides, @hono/node-server, next, private (+17 more)

### Community 187 - "DashboardShell"
Cohesion: 0.04
Nodes (88): BulkCustomersPage(), BulkContactsPage(), EditCustomerPage(), EditCustomerPageProps, CustomerNotFound(), CustomerDetailPage(), CustomerDetailPageProps, NewCustomerPage() (+80 more)

### Community 192 - "print-pdf-url.ts"
Cohesion: 0.14
Nodes (15): listPrintersForClient(), printServerPdfForClient(), ServerPrintResult, attachHiddenIframe(), cleanupAfterPrint(), pickPrinter(), printBlobAsPdfFrame(), printViaServerWithPicker() (+7 more)

### Community 193 - "submittal-package.ts"
Cohesion: 0.11
Nodes (27): getSubmittalsJobSubfolder(), dedupeSharedPdfObjects(), isSkipped(), rewriteRefs(), SKIP_TYPES, structuralKey(), TYPE_KEY, buildSubmittalPackageBaseName() (+19 more)

### Community 194 - "job-folders.ts"
Cohesion: 0.42
Nodes (8): getJobSubfolders(), buildJobFolderBaseName(), createJobFoldersForJob(), createJobFolderStructure(), isFolderPathTakenByAnotherJob(), pathExists(), resolveJobFolderPath(), sanitizeFolderName()

### Community 196 - "custom-structure-import.ts"
Cohesion: 0.14
Nodes (20): importCustomJobStructures(), JobStructureImportResult, JobCustomStructureImportButton(), handleFile(), handleImport(), parseGrid(), Cell, cellText() (+12 more)

### Community 203 - "delivery-ticket-detail-content.tsx"
Cohesion: 0.17
Nodes (17): DeliveryTicketDetailContent(), DeliveryTicketDetailContentProps, formatLineType(), isBlank(), OptionalField(), paymentMethodLabel(), PickupInfo, RELATED_PLACEHOLDERS (+9 more)

### Community 204 - "product-mapper.ts"
Cohesion: 0.15
Nodes (19): ProductRow, formatProductKindBadgeLabel(), categoryVariant(), documentTypeLabel(), formatDecimal(), formatDocumentDate(), formatFileSize(), formatYesNo() (+11 more)

### Community 205 - "delivery-ticket-pdf-data.ts"
Cohesion: 0.09
Nodes (38): blankOr(), buildDeliveryTicketFormData(), computeTotalPieces(), DbCustomer, DbDeliveryTicketForPdf, DbJob, DeliveryTicketPdfLineItem, displayOrDash() (+30 more)

### Community 209 - "generate-circular-import-template.mjs"
Cohesion: 0.06
Nodes (32): handleFile(), handleFile(), xlsx, colWidths, EXAMPLE_ROWS, exampleSheet, HEADERS, INSTRUCTIONS (+24 more)

### Community 227 - "circular-bulk-grid.tsx"
Cohesion: 0.08
Nodes (48): BulkSheetRowResult, RectSheetFormValues, circularPayloadFromValues(), rectPayloadFromValues(), focusGridCell(), formatBrickInches(), formatElevation(), formatFeet() (+40 more)

### Community 242 - ".checkAndRepair"
Cohesion: 0.05
Nodes (36): adjustMapping(), amendFallbackToUnicode(), applyStandardFontGlyphMap(), buildToFontChar(), CFFFont, compileFontInfo(), convertCidString(), createCmapTable() (+28 more)

### Community 243 - "XFAObject"
Cohesion: 0.01
Nodes (57): Acrobat, Acrobat7, Agent, Assist, BatchOutput, BindItems, Bookend, Cache (+49 more)

### Community 248 - "CalRGBCS"
Cohesion: 0.09
Nodes (4): CalGrayCS, CalRGBCS, DeviceCmykCS, LabCS

### Community 256 - "calculateSHA512"
Cohesion: 0.09
Nodes (17): AES128Cipher, AES256Cipher, AESBaseCipher, calculateSHA384(), calculateSHA512(), ch(), isArrayEqual(), littleSigma() (+9 more)

### Community 260 - "SectionCard"
Cohesion: 0.05
Nodes (92): DrillSheetsPage(), where, ProductInventoryPage(), ProductInventoryPageProps, DraftInvoiceLineInput, CompactTable(), Home(), PurchaseOrdersPage() (+84 more)

### Community 261 - "JpegImage"
Cohesion: 0.08
Nodes (16): AlternateCS, buildComponentData(), decodeScan(), decodeBlock(), decodeHuffman(), decodeMcu(), readBit(), receive() (+8 more)

### Community 281 - "unreachable"
Cohesion: 0.03
Nodes (12): BasePDFStreamRangeReader, BasePDFStreamReader, BaseStream, ColorSpace, DeviceGrayCS, DeviceRgbCS, JBig2CCITTFaxImage, Jbig2Error (+4 more)

### Community 311 - "Phase 6 — Electron client (staff PCs)"
Cohesion: 0.25
Nodes (8): A. Server app updates (quotes, jobs, UI — most changes), B. Desktop shell updates (Electron auto-update), Build the installer, C. Server URL change only, Client updates (auto-update from server), Install on each desk PC, Local development with Electron, Phase 6 — Electron client (staff PCs)

### Community 315 - "shadow"
Cohesion: 0.02
Nodes (23): AppearanceStreamEvaluator, Catalog, clearGlobalCaches(), CmykICCBasedCS, createValidAbsoluteUrl(), DatasetReader, decodeString(), FeatureTest (+15 more)

### Community 330 - "allowScripts"
Cohesion: 0.25
Nodes (8): allowScripts, electron@35.7.5, esbuild@0.28.1, prisma@7.8.0, @prisma/engines@7.8.0, puppeteer@25.1.0, sharp@0.34.5, unrs-resolver@1.12.2

### Community 333 - "Security posture: internal, trusted-network tool"
Cohesion: 0.67
Nodes (3): Authentication today, Authorization, Security posture: internal, trusted-network tool

### Community 336 - "assert"
Cohesion: 0.12
Nodes (6): assert(), convertBlackAndWhiteToRGBA(), convertToRGBA(), ImageResizer, PDFImage, toRomanNumerals()

### Community 347 - "ta"
Cohesion: 0.22
Nodes (11): 616(), 8745(), 9504(), 9565(), oa(), doRun(), receiveInstance(), updateMemoryViews() (+3 more)

## Knowledge Gaps
- **1343 isolated node(s):** `RouteContext`, `RouteContext`, `RouteContext`, `RouteContext`, `RouteContext` (+1338 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 2405 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **38 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `_` connect `_` to `.get`, `calculateSHA512`, `LocaleSetNamespace`, `OptionObject`, `JpegImage`, `.getOperatorList`, `TemplateNamespace`, `ContentObject`, `.constructor`, `DeliveryTicketEditor`, `.add`, `SingleIntersector`, `Option01`, `.constructor`, `.createDocumentHandler`, `.getTextContent`, `unreachable`, `Glyph`, `passArray8ToWasm0`, `Color`, `signature_Signature`, `FormatError`, `Stylesheet`, `.success`, `Dict`, `.getObj`, `ExclGroup`, `StringObject`, `ChunkedStream`, `TextState`, `XMLParserBase`, `warn`, `NullOptimizer`, `shadow`, `PsWasmCompiler`, `XmlObject`, `assert`, `.push`, `IntegerObject`, `ta`, `calculateSHA256`, `AnnotationBorderStyle`, `XhtmlObject`, `.checkAndRepair`, `XFAObject`, `CalRGBCS`, `xdp_Xdp`?**
  _High betweenness centrality (0.381) - this node is a cross-community bridge._
- **Why does `reloadAfterAction()` connect `react` to `SectionCard`, `ProductDocumentsSection`, `todays-loads-panel.tsx`, `galley-actions.ts`, `job-detail-mapper.ts`, `translatePrismaError`, `daily-production-entry.tsx`, `products-list.tsx`, `structure-bulk-import-form.tsx`, `custom-structure-import.ts`, `settings/actions.ts`, `delivery-ticket-detail-content.tsx`, `reconcile-day.tsx`, `getAppSettings`, `randomId`, `walk-ins-board.tsx`, `jobs/actions.ts`, `job-structure-import-dialog.tsx`, `shipping-zones/actions.ts`, `bid-actions.ts`, `send-actions.ts`, `delivery-ticket-editor.tsx`, `job-files-browser.tsx`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **Why does `handleSubmit()` connect `react` to `randomId`, `purchase-orders/actions.ts`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **What connects `RouteContext`, `RouteContext`, `RouteContext` to the rest of the system?**
  _1343 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app/products/actions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0701344243132671 - nodes in this community are weakly interconnected._
- **Should `rect-structure.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09302325581395349 - nodes in this community are weakly interconnected._
- **Should `_` be split into smaller, more focused modules?**
  _Cohesion score 0.011169652265542677 - nodes in this community are weakly interconnected._