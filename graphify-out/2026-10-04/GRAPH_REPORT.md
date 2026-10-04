# Graph Report - precastapp  (2026-10-04)

## Corpus Check
- 782 files · ~496,678 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 3, .mdc 2, .example 1)

## Summary
- 8941 nodes · 27098 edges · 220 communities (167 shown, 53 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 239 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `22b75ebb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app/products/actions.ts
- rect-structure.ts
- pdf.worker.min.mjs
- LocaleSetNamespace
- XFAObject
- .getOperatorList
- structure-workbook.ts
- rect-structure-workbook.ts
- ContentObject
- rect-template-pdf.ts
- delivery-ticket-editor.tsx
- .parse
- drill-sheet-template-pdf.ts
- QuoteForm
- quote-form.tsx
- company-logo.ts
- drill-sheets/[id]/page.tsx
- IntegerObject
- product-form.tsx
- product-kinds.ts
- compilerOptions
- .createDocumentHandler
- .getTextContent
- rect-sheet-persistence.ts
- Jbig2Stream
- OptionObject
- delivery-tickets/pdf-actions.ts
- galley-actions.ts
- delivery-ticket-pdf-line-items.ts
- print-pdf-url.ts
- users/actions.ts
- drill-sheet-preview.tsx
- scripts
- template_Value
- build
- Job Structure Production Workflow
- returnActionError
- invoices/actions.ts
- delivery-ticket-pdf-pickup.ts
- withDatabaseRetry
- drill-sheet.ts
- .success
- prisma
- ChunkedStreamManager
- import/actions.ts
- drill-sheet-form.tsx
- shipping/actions.ts
- XMLParserBase
- auth/constants.ts
- dependencies
- customer-mapper.ts
- structures/actions.ts
- bulk-load-planner.tsx
- postcss.config.mjs
- customer-name-similarity.ts
- rect-sheet-detail-view.tsx
- quote-mapper.ts
- Handy Commands — Precast App
- devDependencies
- delivery-tickets/actions.ts
- delivery-ticket-utils.ts
- PsWasmCompiler
- quote-pdf-line-items.ts
- job-detail-mapper.ts
- delivery-ticket-detail-content.tsx
- casting-utils.ts
- delivery-ticket-pdf-fill.ts
- navigateAfterAction
- SectionCard
- BulkPasteForm
- import-rect-sheet-pdfs.ts
- delivery-fulfillment.ts
- inventory/page.tsx
- randomId
- calibrate-rect-templates.ts
- AGENTS.md
- quote-utils.ts
- invoicing-service.ts
- XhtmlObject
- ._bindElement
- purchase-orders/actions.ts
- FormatError
- app_generated_prisma_client_prisma
- circular-structure-import.ts
- settings/actions.ts
- plan-sheet-actions.ts
- quotes/actions.ts
- AnnotationBorderStyle
- input.tsx
- Precast Ops desktop updates
- rect-sheet-detail.ts
- bid-actions.ts
- XmlObject
- quote-pdf-fill.ts
- files/actions.ts
- structure-workbook.tsx
- product-taxonomy.server.ts
- generate-invoice-templates.ts
- send-actions.ts
- XhtmlNamespace
- requirePermission
- react
- structure-utils.ts
- quote-form-data.ts
- windows-explorer.ts
- TextMeasure
- price-list-service.ts
- shipping-zones-manager.tsx
- Office deployment — single Windows server + UNC job folders
- Office rollout checklist
- app_generated_prisma_client
- reloadAfterAction
- drill-sheets/pdf-actions.ts
- delivery-ticket-pdf-html.ts
- .get
- getStringOption
- delivery-schedule-pdf-html.ts
- seed.ts
- Deployment server info checklist
- app-settings.ts
- Troubleshooting
- invoice-pdf-fill.ts
- structure-workbook-plan-takeoff.tsx
- Precast Ops
- bulk-attach-board.tsx
- stringToBytes
- printPdfUrl
- .find
- JpegImage
- calculateSHA512
- receiving-utils.ts
- Builder
- ref_fs
- ring-builder-modal.tsx
- structure-template-pdf-service.ts
- job-structure-import-dialog.tsx
- SimpleDOMNode
- product-groups/page.tsx
- FontSelector
- signature_Signature
- main.mjs
- session-keep-alive.tsx
- draft-invoice-cover-html.ts
- submittal-package.ts
- job-sheet-import-actions.ts
- Br
- TextState
- .push
- ExclGroup
- ChunkedStream
- StringObject
- walk-ins-board.tsx
- PageSet
- Html
- CMap
- Stipple
- reconcile/page.tsx
- zone-map.tsx
- NullOptimizer
- $i
- .#Ne
- package.json
- prisma.ts
- .add
- product-export.ts
- BulkContactPasteForm
- custom-structure-import.ts
- outlook-draft.ts
- Stylesheet
- Datasets
- product-mapper.ts
- XFAAttribute
- contentDisposition
- generate-circular-import-template.mjs
- pdf-text.ts
- MetadataParser
- PageArea
- Root
- rect-bulk-grid.tsx
- .checkAndRepair
- ConfigNamespace
- CalRGBCS
- xdp_Xdp
- next
- ColorSpace
- SingleIntersector
- process-app-icon.ps1
- Phase 6 — Electron client (staff PCs)
- warn
- allowScripts
- Security posture: internal, trusted-network tool
- util_assert

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
- `RootLayout()` --calls--> `AppProviders()`  [EXTRACTED]
  app/layout.tsx → components/ui/app-providers.tsx
- `PurchaseOrdersPage()` --indirect_call--> `mapPurchaseOrderListRow()`  [INFERRED]
  app/purchase-orders/page.tsx → lib/purchase-order-mapper.ts
- `QuotesPage()` --indirect_call--> `mapQuoteToRow()`  [INFERRED]
  app/quotes/page.tsx → lib/quote-mapper.ts

## Import Cycles
- None detected.

## Communities (220 total, 53 thin omitted)

### Community 0 - "app/products/actions.ts"
Cohesion: 0.07
Nodes (53): parseCustomerFormData(), parseJobFormData(), parseJobUpdateFormData(), assertAllAssemblyComponentCodesExist(), BulkImportRow, bulkImportUpdateData(), collectAssemblyBomImportRows(), collectReferencedComponentCodes() (+45 more)

### Community 1 - "rect-structure.ts"
Cohesion: 0.09
Nodes (38): SumpMode, annotateRectOpeningSections(), ComputedRectSection, computeHorizontalGeometry(), computeRectDefaultSumpFeet(), computeRectPricing(), computeRectStructure(), computeRectWallHeightFeet() (+30 more)

### Community 2 - "pdf.worker.min.mjs"
Cohesion: 0.01
Nodes (232): 14(), 291(), 463(), 750(), 812(), 835(), 837(), 944() (+224 more)

### Community 3 - "LocaleSetNamespace"
Cohesion: 0.03
Nodes (24): CalendarSymbols, CurrencySymbol, CurrencySymbols, DatePattern, DatePatterns, Day, DayNames, Era (+16 more)

### Community 5 - "XFAObject"
Cohesion: 0.01
Nodes (72): Arc, Assist, Barcode, BatchOutput, Bind, BindItems, Bookend, Break (+64 more)

### Community 6 - ".getOperatorList"
Cohesion: 0.04
Nodes (29): addCachedImageOps(), argIsDict(), CheckedOperatorList, EvalState, fetchBinaryData(), getLookupTableFactory(), getNewAnnotationsMap(), getStandardFontName() (+21 more)

### Community 7 - "structure-workbook.ts"
Cohesion: 0.15
Nodes (28): applyDefaultsToBlankRow(), buildDrillSheetOpeningsInput(), clearWorkbookApplyPayload(), computePenetrationsBootsPrice(), computeWorkbookRowPrice(), ensureRowOpenings(), ensureRowPenetrations(), formatPenetrationsSummary() (+20 more)

### Community 9 - "rect-structure-workbook.ts"
Cohesion: 0.07
Nodes (59): completeRectDrillSheets(), CompleteDrillSheetsClient(), handleCreate(), groupToneClasses(), RectDefaultsPanel(), RectStructureWorkbook(), addRows(), duplicateSelected() (+51 more)

### Community 10 - "ContentObject"
Cohesion: 0.02
Nodes (24): AlwaysEmbed, BehaviorOverride, BooleanElement, ContentObject, DateElement, DateTime, DateTimeSymbols, Decimal (+16 more)

### Community 11 - "rect-template-pdf.ts"
Cohesion: 0.07
Nodes (47): sectionJointHeightsFeet(), baseOffsetText(), BLACK, buildFlaps(), buildRectSheetFieldMap(), CalloutLayout, calloutSlotTops(), consumeMarkerField() (+39 more)

### Community 12 - "delivery-ticket-editor.tsx"
Cohesion: 0.03
Nodes (100): DeliveryTicketJobSearchOption, SaveDeliveryTicketInput, searchCustomersForWalkInTicket(), searchJobsForDeliveryTicket(), splitStructureForShipping(), unsplitStructure(), DeliveryTicketEditor(), addExtraCustomLine() (+92 more)

### Community 13 - ".parse"
Cohesion: 0.05
Nodes (21): CFF, CFFCharset, CFFDict, CFFEncoding, CFFFDSelect, CFFHeader, CFFParser, parseOperand() (+13 more)

### Community 14 - "drill-sheet-template-pdf.ts"
Cohesion: 0.04
Nodes (76): DrillSheetPreviewMeta, ComputedOpening, DrillSheetResult, appendDrillSheetFillablePage(), BORDER, drawField(), feet(), FieldContext (+68 more)

### Community 15 - "QuoteForm"
Cohesion: 0.05
Nodes (64): loadJobCustomStructureImportCandidates(), toPlainNumberString(), createDefaultCustomStructureRow(), createLineId(), QuoteForm(), addCategoryLine(), addLineItem(), addLineItems() (+56 more)

### Community 16 - "quote-form.tsx"
Cohesion: 0.04
Nodes (71): QuoteSaveDestination, createDefaultQuoteRow(), createRowId(), PipeModal(), handleAddQuoteLines(), handleAddUnitPricesToDescription(), handleClose(), resetModal() (+63 more)

### Community 17 - "company-logo.ts"
Cohesion: 0.10
Nodes (35): GET(), geistMono, geistSans, generateMetadata(), RootLayout(), CompanySettingsPage(), COMPANY_LOGO_FILENAME, companyLogoApiUrl() (+27 more)

### Community 18 - "drill-sheets/[id]/page.tsx"
Cohesion: 0.09
Nodes (31): GET(), rectPreviewResponse(), RouteContext, DrillSheetDetailPage(), DrillSheetDetailPageProps, loadJobSheetNav(), RectSheetDetail(), DrillSheetPreviewPage() (+23 more)

### Community 19 - "IntegerObject"
Cohesion: 0.05
Nodes (13): AdjustData, AdobeExtensionLevel, CompressObjectStream, Copies, CurrentPage, IntegerObject, Level, MsgId (+5 more)

### Community 20 - "product-form.tsx"
Cohesion: 0.07
Nodes (34): CastingComponentPickerOption, CastingSupplierOption, drainRingDiameterOptions, ProductForm(), handleCategoryChange(), handleProductKindChange(), handleProductTypeChange(), handleRingDiameterChange() (+26 more)

### Community 21 - "product-kinds.ts"
Cohesion: 0.08
Nodes (34): parseCastingBomPayload(), parseBulkPaste(), parseAdsPipeJointType(), parseCastingPieceRole(), formatSanitaryDrainRingDiametersLabel(), isRecognizedBulkRingStyle(), BulkImportPreset, bulkImportPresetLabels (+26 more)

### Community 22 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 23 - ".createDocumentHandler"
Cohesion: 0.03
Nodes (28): AbortException, AnnotationFactory, BasePdfManager, BasePDFStream, BasePDFStreamRangeReader, BasePDFStreamReader, BaseStream, LocalPdfManager (+20 more)

### Community 24 - ".getTextContent"
Cohesion: 0.08
Nodes (22): BaseLocalCache, GlobalColorSpaceCache, Intersector, LocalGStateCache, LocalImageCache, LocalTilingPatternCache, addFakeSpaces(), appendEOL() (+14 more)

### Community 25 - "rect-sheet-persistence.ts"
Cohesion: 0.08
Nodes (52): createDrillSheet(), createRectSheet(), deleteDrillSheet(), updateDrillSheet(), updateRectSheet(), upgradeRectSheetFromPlaceholder(), upgradeRectSheetFromPlaceholderOrThrow(), BulkSheetRowInput (+44 more)

### Community 26 - "Jbig2Stream"
Cohesion: 0.07
Nodes (7): CCITTFaxStream, JBig2CCITTFaxImage, Jbig2Error, Jbig2Stream, JpxError, JpxImage, WasmImage

### Community 27 - "OptionObject"
Cohesion: 0.02
Nodes (36): ADBE_JSConsole, ADBE_JSDebugger, AutoSave, config_Attributes, config_Type, config_Validate, Conformance, Destination (+28 more)

### Community 28 - "delivery-tickets/pdf-actions.ts"
Cohesion: 0.13
Nodes (24): DeliveryTicketPreviewPage(), DeliveryTicketPreviewPageProps, PREVIEW_ORIGINS, DeliveryTicketPdfPreviewResult, generateDeliveryTicketPdf(), GenerateDeliveryTicketPdfResult, getDeliveryTicketPdfPreviewBase64(), loadTicketForPdf() (+16 more)

### Community 29 - "galley-actions.ts"
Cohesion: 0.14
Nodes (25): injectGalleyFamilyOptions(), applyGalleyBreakdown(), ApplyGalleyBreakdownResult, BREAKDOWN_STATUSES, BreakdownDialog(), submit(), formatMixSummary(), GalleyBreakdownBanner() (+17 more)

### Community 30 - "delivery-ticket-pdf-line-items.ts"
Cohesion: 0.12
Nodes (34): COL_DESC_WIDTH, COL_DESC_X, COL_ITEM_NUM_WIDTH, COL_ITEM_NUM_X, COL_QTY_WIDTH, COL_QTY_X, DEFAULT_TABLE_LAYOUT, DeliveryTicketTableLayout (+26 more)

### Community 31 - "print-pdf-url.ts"
Cohesion: 0.13
Nodes (18): listPrintersForClient(), printServerPdfForClient(), ServerPrintResult, attachHiddenIframe(), cleanupAfterPrint(), pickPrinter(), printBlobAsPdfFrame(), printViaServerWithPicker() (+10 more)

### Community 32 - "users/actions.ts"
Cohesion: 0.17
Nodes (21): ProfilePage(), deleteQuote(), changeMyPassword(), createUser(), deactivateUser(), generateTempPassword(), parseDeniedPermissions(), parseGrantedPermissions() (+13 more)

### Community 33 - "drill-sheet-preview.tsx"
Cohesion: 0.11
Nodes (41): CalcRow(), DrillSheetPreview(), DrillSheetPreviewProps, feet(), HeaderRow(), PlanDiagram(), PreviewPanel(), angleToClockPosition() (+33 more)

### Community 34 - "scripts"
Cohesion: 0.11
Nodes (19): scripts, build, db:seed, db:sync-files, deploy:build, deploy:check, deploy:start, deploy:update (+11 more)

### Community 35 - "template_Value"
Cohesion: 0.10
Nodes (6): Caption, Draw, Field, Image, _setValue(), template_Value

### Community 36 - "build"
Cohesion: 0.11
Nodes (18): build, appId, directories, extraResources, icon, nsis, productName, publish (+10 more)

### Community 37 - "Job Structure Production Workflow"
Cohesion: 0.33
Nodes (5): Dates, Delivery eligibility, Job Structure Production Workflow, Quote → JobStructure linking, Server actions

### Community 38 - "returnActionError"
Cohesion: 0.06
Nodes (59): GET(), RouteContext, allocateJobNumber(), createJob(), createJobFolder(), createJobFolderOrThrow(), createJobOrThrow(), createJobStructure() (+51 more)

### Community 39 - "invoices/actions.ts"
Cohesion: 0.08
Nodes (38): computeInvoiceFinancials(), deleteDraftInvoice(), DraftInvoiceLineInput, EDITABLE_INVOICE_STATUSES, finalizeAllDraftInvoices(), finalizeInvoices(), InvoiceListRow, markInvoicePaid() (+30 more)

### Community 40 - "delivery-ticket-pdf-pickup.ts"
Cohesion: 0.15
Nodes (16): FONT_SIZE, LINE_HEIGHT, ROW_PADDING, applyPickupTicketArtwork(), BAND_CAPTIONS, BAND_COLS, BLACK, centered() (+8 more)

### Community 41 - "withDatabaseRetry"
Cohesion: 0.05
Nodes (93): listStockProductsForTicket(), EDIT_ORIGINS, EditDeliveryTicketPage(), EditDeliveryTicketPageProps, NewDeliveryTicketPage(), NewDeliveryTicketPageProps, TICKET_ORIGINS, saveInventoryAdjustment() (+85 more)

### Community 42 - "drill-sheet.ts"
Cohesion: 0.07
Nodes (38): annotateOpeningSections(), buildSolverHoles(), compareCost(), computeBaseTopToOpeningBottomInches(), computeDefaultSumpFeet(), computeDrillSheet(), ComputedSection, ComputedWeights (+30 more)

### Community 43 - ".success"
Cohesion: 0.04
Nodes (41): applyAssist(), ariaLabel(), Border, CheckButton, checkDimensions(), ChoiceList, computeBbox(), Corner (+33 more)

### Community 44 - "prisma"
Cohesion: 0.09
Nodes (20): decimal(), DiameterConfigPayload, parseDiameterConfigPayload(), parsePrice(), saveStructureDiameterConfigs(), saveStructureDiameterConfigsOrThrow(), combinedMaterial(), decimal() (+12 more)

### Community 45 - "ChunkedStreamManager"
Cohesion: 0.21
Nodes (3): arrayBuffersToBytes(), ChunkedStreamManager, ObjectLoader

### Community 46 - "import/actions.ts"
Cohesion: 0.10
Nodes (39): buildCastingResolver(), CastingResolution, importPipeOpenings(), importPipeOpeningsOrThrow(), importRectOpenings(), importRectOpeningsOrThrow(), ImportRowInput, ImportRowMessage (+31 more)

### Community 47 - "drill-sheet-form.tsx"
Cohesion: 0.11
Nodes (23): buildCommittedPreview(), CommittedOpeningNumbers, CommittedPreviewNumbers, connectionOptions, createOpening(), DiameterConfigOption, DrillSheetForm(), addOpening() (+15 more)

### Community 48 - "shipping/actions.ts"
Cohesion: 0.12
Nodes (29): lookupShippingRate(), lookupShippingRateAtPoint(), resolveShippingRateForPoint(), ShippingLookupResult, ShippingLookupSuccess, suggestShippingAddresses(), AddressAutocomplete(), closeDropdown() (+21 more)

### Community 50 - "XMLParserBase"
Cohesion: 0.13
Nodes (3): XFAParser, XMLParserBase, skipWs()

### Community 51 - "auth/constants.ts"
Cohesion: 0.05
Nodes (57): updateRolePermissionsFormAction(), RolesSettingsPage(), RolesSettingsPageProps, saveRolePermissions(), EditSettingsUserPage(), EditSettingsUserPageProps, NewSettingsUserPage(), Header() (+49 more)

### Community 52 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, leaflet, next, nodemailer, pdf-lib, @pdf-lib/fontkit, pdf-to-printer, pdfjs-dist (+11 more)

### Community 53 - "customer-mapper.ts"
Cohesion: 0.06
Nodes (44): parseBulkContactPaste(), handleParsePreview(), parseBulkPaste(), ContactFormState, CustomerContactsPanelProps, emptyForm, roleChipClassNames, bulkContactColumnHeaders (+36 more)

### Community 54 - "structures/actions.ts"
Cohesion: 0.14
Nodes (26): assertDiametersHaveMolds(), createStructureTemplate(), createStructureTemplateOrThrow(), duplicateStructureTemplate(), handlePrismaError(), parseTemplatePayload(), resolvePriceListIdForTemplateSave(), saveRectPriceEntry() (+18 more)

### Community 55 - "bulk-load-planner.tsx"
Cohesion: 0.06
Nodes (58): DeliveryTicketLineInput, discardSavedLoadPlan(), PlannedLoadInput, saveLoadPlanForLater(), SavePlannedLoadsInput, buildRows(), BulkLoadPlanner(), addLoad() (+50 more)

### Community 57 - "customer-name-similarity.ts"
Cohesion: 0.36
Nodes (11): compactCustomerName(), compactSimilarity(), CustomerNameCandidate, getCustomerNameSimilarity(), jaccardSimilarity(), levenshteinDistance(), levenshteinRatio(), normalizeCustomerName() (+3 more)

### Community 64 - "rect-sheet-detail-view.tsx"
Cohesion: 0.09
Nodes (34): aboveFloorText(), fmtElevation(), InfoRow(), placementText(), RectSheetDetailView(), RectSheetDetailViewProps, Stat(), wholeInches() (+26 more)

### Community 65 - "quote-mapper.ts"
Cohesion: 0.05
Nodes (60): importJobStructuresFromConfigsOrThrow(), mapStructure(), needsDrillSheetWhere, ProductionPage(), structureInclude, QUOTE_LIST_SELECT, statusWhereFor(), createDrillSheetsFromQuoteOrThrow() (+52 more)

### Community 66 - "Handy Commands — Precast App"
Cohesion: 0.15
Nodes (13): App (Next.js), Browse data, Daily workflow, Database backups, Electron desktop client, Git / GitHub (optional), Handy Commands — Precast App, Office deployment (Windows server) (+5 more)

### Community 67 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, electron, electron-builder, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx (+8 more)

### Community 68 - "delivery-tickets/actions.ts"
Cohesion: 0.07
Nodes (36): assertQuoteLinkable(), buildLineCreates(), buildLinesPayload(), createDeliveryTicket(), DeliveryTicketActionResult, GenerateTicketSubmittalResult, parseDate(), resolveTicketCustomerId() (+28 more)

### Community 69 - "delivery-ticket-utils.ts"
Cohesion: 0.05
Nodes (70): AllDeliveryTicketsPage(), VALID_DELIVERY_STATUSES, DeliveryTicketDetailPage(), DeliveryTicketDetailPageProps, DeliveryTicketsPage(), EDITABLE_STATUSES, EmptyState(), ScheduleLoadsPage() (+62 more)

### Community 70 - "PsWasmCompiler"
Cohesion: 0.05
Nodes (25): ast_Parser, buildPostScriptWasmFunction(), encodeASCIIString(), lexer_Lexer, _nodesEqual(), parsePostScriptFunction(), PsArgNode, PsBinaryNode (+17 more)

### Community 71 - "quote-pdf-line-items.ts"
Cohesion: 0.08
Nodes (44): COL_DESC_WIDTH, COL_DESC_X, COL_ITEM_NUM_WIDTH, COL_ITEM_NUM_X, COL_QTY_WIDTH, COL_QTY_X, COL_TOTAL_WIDTH, COL_TOTAL_X (+36 more)

### Community 72 - "job-detail-mapper.ts"
Cohesion: 0.03
Nodes (122): searchContractorsForJob(), JobTabContent(), JobTabContentProps, JobDetailPage(), JobDetailPageProps, resolveTab(), VALID_TABS, convertTicketToInvoice() (+114 more)

### Community 73 - "delivery-ticket-detail-content.tsx"
Cohesion: 0.09
Nodes (30): generateDeliveryTicketSubmittalPackage(), updateDeliveryTicketStatus(), DeliveryTicketDetailContent(), DeliveryTicketDetailContentProps, formatLineType(), isBlank(), OptionalField(), paymentMethodLabel() (+22 more)

### Community 74 - "casting-utils.ts"
Cohesion: 0.13
Nodes (12): CastingAssemblyBomImportRow, castingAssemblyBomRoleOrder, castingAssemblyOptionalBomRoles, castingAssemblyRequiredBomRoles, CastingBomRowInput, CastingComponentLookup, CastingComponentOption, castingPieceRoleFormOptions (+4 more)

### Community 75 - "delivery-ticket-pdf-fill.ts"
Cohesion: 0.08
Nodes (46): blankOr(), buildDeliveryTicketFormData(), computeTotalPieces(), DbCustomer, DbDeliveryTicketForPdf, DbJob, DELIVERY_TICKET_PDF_INCLUDE, DeliveryTicketContentPage (+38 more)

### Community 76 - "navigateAfterAction"
Cohesion: 0.06
Nodes (44): GlobalError(), isStaleDeploymentError(), NotFound(), cancelTicketFromReconcile(), ProductCatalogSettingsPage(), BulkPasteForm(), handleImport(), DeleteCustomerButton() (+36 more)

### Community 77 - "SectionCard"
Cohesion: 0.05
Nodes (71): ensureYearSequencesAction(), getDocumentNumberingPreview(), syncAllJobFilesFromSettingsAction(), testJobsRootWriteAccessAction(), testStockSubmittalsRootWriteAccessAction(), updatePriceListSettings(), BillingSettingsPage(), BillingSettingsPageProps (+63 more)

### Community 78 - "BulkPasteForm"
Cohesion: 0.17
Nodes (13): findExistingProductCodesAction(), importProducts(), BulkPasteForm(), handleImport(), handleParsePreview(), lookUpExistingCodes(), formatMissingTaxonomySummary(), presetPreviewColumns() (+5 more)

### Community 79 - "import-rect-sheet-pdfs.ts"
Cohesion: 0.21
Nodes (15): rectTemplateVariantKey(), BLACK, dumpVariant(), ELEVATION_WALLS_X, enrichVariant(), main(), markersForVariant(), Rect (+7 more)

### Community 80 - "delivery-fulfillment.ts"
Cohesion: 0.06
Nodes (58): CandidateDraft, EmptyState(), mapDraftToCells(), PlanLoadsPage(), PlanLoadsPageProps, DraftLoadColumn, AdsPipeOption, allLineageIds() (+50 more)

### Community 81 - "inventory/page.tsx"
Cohesion: 0.03
Nodes (112): AGGREGATE_SORT_COLUMNS, CONTACT_SORT_COLUMNS, ContactSortColumn, CUSTOMER_SORT_FIELDS, CustomerSortColumn, CustomersPage(), isAggregateSortColumn(), loadCustomerAggregates() (+104 more)

### Community 82 - "randomId"
Cohesion: 0.06
Nodes (60): InventoryProductSearchOption, resolveReceivingCategory(), savePurchaseReceipt(), searchInventoryProducts(), mapOpenPurchaseOrders(), ReceivePage(), ReceivePageProps, FormTypeahead() (+52 more)

### Community 83 - "calibrate-rect-templates.ts"
Cohesion: 0.09
Nodes (25): Align, ALIGNMENTS, BLACK, calibrateVariant(), EXPLODED_SPECS, extractTextItems(), findItem(), HEADER_SPECS (+17 more)

### Community 84 - "AGENTS.md"
Cohesion: 0.38
Nodes (4): Codebase exploration: use graphify first, Prisma / Database Rules, Project context, This is NOT the Next.js you know

### Community 85 - "quote-utils.ts"
Cohesion: 0.10
Nodes (31): CustomStructureCostBreakdown(), addItem(), CustomStructureCostBreakdownProps, CustomStructureDetailBreakdown(), CustomStructurePricingFooter(), CustomStructurePricingFooterProps, buildCreateQuoteInput(), calculateQuoteTotals() (+23 more)

### Community 86 - "invoicing-service.ts"
Cohesion: 0.13
Nodes (20): removeAdsJointTypeSuffix(), removeTrailingRingHeightSuffix(), resolveLineDescription(), batchConvertDeliveredTicketsToInvoices(), BatchInvoiceConversionResult, CastingSetCharge, castingSetsStarted(), convertDeliveryTicketToInvoice() (+12 more)

### Community 87 - "XhtmlObject"
Cohesion: 0.12
Nodes (6): li, ol, Sup, ul, xhtml_P, XhtmlObject

### Community 88 - "._bindElement"
Cohesion: 0.07
Nodes (13): Binder, createDataNode(), createText(), DataHandler, interpolate(), Items, makeMap(), parseExpression() (+5 more)

### Community 89 - "purchase-orders/actions.ts"
Cohesion: 0.10
Nodes (31): createPurchaseOrder(), getPurchaseOrderForReceiving(), listOpenPurchaseOrdersForReceiving(), parseDate(), parseLinesFromFormData(), parseSaveInput(), revalidatePurchaseOrderPaths(), updatePurchaseOrder() (+23 more)

### Community 90 - "FormatError"
Cohesion: 0.02
Nodes (57): addHex(), Ascii85Stream, AsciiHexStream, BinaryCMapReader, BinaryCMapStream, BrotliStream, bytesToString(), CMapFactory (+49 more)

### Community 91 - "app_generated_prisma_client_prisma"
Cohesion: 0.11
Nodes (33): addCustomerContact(), BulkContactDbState, BulkContactImportRow, CONTACT_ROLES, CustomerContactInput, deleteCustomerContact(), importContacts(), importContactsOrThrow() (+25 more)

### Community 92 - "circular-structure-import.ts"
Cohesion: 0.20
Nodes (17): CircularImportDialog(), handlePasteParse(), CircularImportDialogProps, Cell, cellText(), circularGridFromTsv(), CircularImportIssue, CircularImportResult (+9 more)

### Community 93 - "settings/actions.ts"
Cohesion: 0.08
Nodes (50): checkJobsRootReadAccess(), clearAllCustomersFormAction(), clearAllCustomersOrThrow(), clearAllDeliveryTicketsFormAction(), clearAllDeliveryTicketsOrThrow(), clearAllJobsFormAction(), clearAllJobsOrThrow(), clearAllProductsFormAction() (+42 more)

### Community 94 - "plan-sheet-actions.ts"
Cohesion: 0.05
Nodes (53): GET(), RouteContext, openJobStructureSubmittalsFolderOrThrow(), persistVendorQuote(), getPlanSheetForOpen(), mapPlanSheetRow(), pathExists(), savePlanSheetMarkup() (+45 more)

### Community 95 - "quotes/actions.ts"
Cohesion: 0.05
Nodes (71): assertGalleyFamiliesExist(), computeQuoteFinancials(), createQuote(), CreateQuoteInput, CreateQuoteLineItemInput, DeleteQuoteResult, isQuoteNumberConflict(), listPriceListsForForm() (+63 more)

### Community 97 - "input.tsx"
Cohesion: 0.40
Nodes (3): inputClassName, InputProps, textareaClassName

### Community 98 - "Precast Ops desktop updates"
Cohesion: 0.40
Nodes (4): Precast Ops desktop updates, Publish a desktop update (from the dev PC), Verify (from any office PC), Which machine does what

### Community 99 - "rect-sheet-detail.ts"
Cohesion: 0.33
Nodes (11): RectSectionField, buildRectSheetFormValues(), buildRectSheetFormValuesForIdentity(), buildRectSheetFormValuesFromQuoteConfig(), decimalToInput(), emptyOpeningField(), nextId(), num() (+3 more)

### Community 100 - "bid-actions.ts"
Cohesion: 0.19
Nodes (18): addJobBidder(), awardJob(), generateQuotesFromMaster(), removeJobBidder(), buildContactMapForGenerate(), buildDefaultContactMap(), JobBiddingPanel(), handleAddBidder() (+10 more)

### Community 102 - "quote-pdf-fill.ts"
Cohesion: 0.18
Nodes (14): DbQuoteForPdf, QuoteContentPage, ADDRESS_FIELD_NAMES, buildQuotePageBytes(), fillAcroFormFields(), fitProjectAddressFields(), getQuoteContinuationTemplatePath(), getQuoteTemplatePath() (+6 more)

### Community 104 - "files/actions.ts"
Cohesion: 0.16
Nodes (28): ExplorerOpenResult, getJobFilesForBrowser(), openJobFile(), openJobFolderCategory(), revalidateFilesPaths(), syncAllFiles(), SyncAllFilesResult, syncJobFilesAction() (+20 more)

### Community 105 - "structure-workbook.tsx"
Cohesion: 0.08
Nodes (45): PlanSheetRecord, uploadPlanSheet(), DrillSheetTemplateOption, formatQuoteCurrency(), pipeSizesForMaterial(), StructureWorkbookDefaultsPanel(), StructureWorkbookDefaultsPanelProps, uniquePipeMaterials() (+37 more)

### Community 106 - "product-taxonomy.server.ts"
Cohesion: 0.20
Nodes (20): ensureTaxonomyForBulkImport(), fetchActiveProductTaxonomy(), resolveTaxonomiesByNamesForImport(), resolveTaxonomyByNamesForImport(), validateTaxonomySelection(), analyzeTaxonomyByNames(), buildCategoryFilterOptions(), buildSubcategoryFilterOptions() (+12 more)

### Community 108 - "generate-invoice-templates.ts"
Cohesion: 0.12
Nodes (25): CONT_TABLE_BOTTOM_Y, MAIN_TABLE_BOTTOM_Y, addTextField(), BLACK, BOTTOM_BOX, buildTemplate(), Ctx, drawBox() (+17 more)

### Community 110 - "send-actions.ts"
Cohesion: 0.06
Nodes (63): findSupersededBy(), getSendQuoteDefaults(), getSendQuoteEmailConfigured(), OpenOutlookDraftResult, openQuoteInOutlook(), sendQuote(), SendQuoteDefaults, SendQuoteInput (+55 more)

### Community 111 - "XhtmlNamespace"
Cohesion: 0.13
Nodes (5): Body, hl, Span, Sub, XhtmlNamespace

### Community 112 - "requirePermission"
Cohesion: 0.09
Nodes (38): BulkImportRow, checkBulkCustomerDbDuplicates(), createCustomer(), CUSTOMER_STATUSES, CustomerRecordInput, deleteCustomer(), findSimilarCustomers(), importCustomers() (+30 more)

### Community 114 - "react"
Cohesion: 0.04
Nodes (85): listJobFilesAction(), uploadJobFileAction(), EditJobPage(), EditJobPageProps, deleteProductDocumentAction(), openProductDocument(), openProductSubmittalsFolder(), scanAllProductSubmittalsAction() (+77 more)

### Community 115 - "structure-utils.ts"
Cohesion: 0.06
Nodes (42): JobStructureFormProps, CastingOption, createDiameter(), defaultFormValue, DiameterField, feetInchesHint(), moldOptionLabel(), RectPdfSetOption (+34 more)

### Community 117 - "quote-form-data.ts"
Cohesion: 0.11
Nodes (18): reloadQuoteFormPriceOptions(), collectRingOtherSubcategories(), formatJobAddress(), loadPipeProductsForQuoteForm(), loadQuoteFormPriceOptions(), mapPipeProductToQuoteOption(), mapServiceProductsToOptions(), QUOTE_PIPE_PRODUCT_SELECT (+10 more)

### Community 118 - "windows-explorer.ts"
Cohesion: 0.10
Nodes (34): ClientPathMapping, getClientPathMappings(), stripTrailingSeparators(), toClientOpenPath(), translateToClientPath(), assertDirectoryExists(), assertFileExists(), assertPathAccessible() (+26 more)

### Community 119 - "TextMeasure"
Cohesion: 0.26
Nodes (3): B, layoutText(), TextMeasure

### Community 120 - "price-list-service.ts"
Cohesion: 0.10
Nodes (39): BulkProductsPage(), EditProductPage(), EditProductPageProps, DetailField(), ProductDetailPage(), ProductDetailPageProps, NewProductPage(), buildProductOrderBy() (+31 more)

### Community 121 - "shipping-zones-manager.tsx"
Cohesion: 0.15
Nodes (24): createShippingZone(), deleteShippingZone(), revalidateShippingZonePaths(), setYardLocation(), ShippingZoneInput, updateShippingZone(), ValidatedZone, validateZoneInput() (+16 more)

### Community 122 - "Office deployment — single Windows server + UNC job folders"
Cohesion: 0.11
Nodes (18): Architecture, End-to-end smoke test, Firewall, Important behavior, Install prerequisites, Office deployment — single Windows server + UNC job folders, Ongoing maintenance, Phase 1 — Prepare the Windows server (+10 more)

### Community 123 - "Office rollout checklist"
Cohesion: 0.12
Nodes (17): 1. Server URL for the desktop app, 2. First install on each staff PC, 3. Staff expectations, 4. Role walkthrough (recommended), 5. Backups, 6. Support contacts, 7. Post-rollout verification (first week), Database (nightly recommended) (+9 more)

### Community 124 - "app_generated_prisma_client"
Cohesion: 0.07
Nodes (54): GET(), GET(), GET(), RouteContext, getDraftInvoiceEditorData(), EditDraftInvoicePage(), PageProps, InvoiceDetailPage() (+46 more)

### Community 125 - "reloadAfterAction"
Cohesion: 0.04
Nodes (76): uploadJobStructureDocumentAction(), bulkDeleteJobStructures(), setQuoteTaxExempt(), updateQuoteCustomerPo(), generateSubmittalPackage(), CollapsibleSectionCard(), CollapsibleSectionCardProps, DrillSheetPdfLink() (+68 more)

### Community 126 - "drill-sheets/pdf-actions.ts"
Cohesion: 0.12
Nodes (28): saveDeliverySchedulePdf(), generateDrillSheetPdf(), GenerateDrillSheetPdfResult, generateJobDrillSheetsPdf(), GenerateJobDrillSheetsPdfResult, generateRectSheetPdf(), SchedulePrintActions(), handleSave() (+20 more)

### Community 127 - "delivery-ticket-pdf-html.ts"
Cohesion: 0.38
Nodes (10): CompanyProfile, DeliveryTicketCopySettings, DeliveryTicketPdfView, addressBlockHtml(), buildDeliveryTicketPdfHtml(), escapeHtml(), optionalNote(), renderDeliveryTicketPage() (+2 more)

### Community 128 - ".get"
Cohesion: 0.03
Nodes (49): ButtonWidgetAnnotation, addPageDict(), appendIfJavaScriptDict(), parseNestedOrder(), parseOnOff(), parseOrder(), _collectAction(), collectActions() (+41 more)

### Community 129 - "getStringOption"
Cohesion: 0.06
Nodes (10): ContentArea, getFloat(), getInteger(), getKeyword(), getMeasurement(), getRatio(), getRelevant(), getStringOption() (+2 more)

### Community 130 - "delivery-schedule-pdf-html.ts"
Cohesion: 0.17
Nodes (20): formatWeight(), parseLoadSequence(), DeliveryScheduleTicket, JobDeliverySchedule, SCHEDULE_TICKET_SELECT, buildDeliverySchedulePdfHtml(), DeliveryScheduleVariant, escapeHtml() (+12 more)

### Community 131 - "seed.ts"
Cohesion: 0.17
Nodes (16): DEFAULT_APP_SETTINGS_DATA, DEFAULT_SEED_LOGO_PDF_PATH, decodeApiKey(), PrismaDevPayload, resolveDatabaseUrl(), resolvePrismaDevPayload(), resolveShadowDatabaseUrl(), databaseUrl (+8 more)

### Community 134 - "Deployment server info checklist"
Cohesion: 0.22
Nodes (9): Database, Deployment server info checklist, Electron client, File shares (UNC), Network, PDF generation, Post-deploy verification, Server (+1 more)

### Community 136 - "app-settings.ts"
Cohesion: 0.07
Nodes (38): AppSettingsView, DEFAULT_DELIVERY_TICKET_COPY1_TITLE, DEFAULT_DELIVERY_TICKET_COPY2_TITLE, DEFAULT_DELIVERY_TICKET_COPY3_TITLE, DEFAULT_DELIVERY_TICKET_FOOTER_TEXT, DEFAULT_DRIVERS, DEFAULT_ESTIMATORS, DEFAULT_PAYMENT_TERMS (+30 more)

### Community 137 - "Troubleshooting"
Cohesion: 0.33
Nodes (6): `P1001` — Can't reach database server, Password authentication failed, Port 3000 already in use, Prisma Studio — "Could not load schema metadata", Quote PDF — "Could not find Chrome" / browser not found, Troubleshooting

### Community 138 - "invoice-pdf-fill.ts"
Cohesion: 0.11
Nodes (25): formatPostalAddressLines(), blankOr(), buildInvoiceFormData(), DbInvoiceForPdf, formatCustomerAddress(), formatDateForPdf(), formatMoneyForPdf(), formatPageNumber() (+17 more)

### Community 139 - "structure-workbook-plan-takeoff.tsx"
Cohesion: 0.11
Nodes (27): pipeSizesForMaterial(), uniquePipeMaterials(), bearingFromDelta(), commitRow(), DragState, pdfToScreen(), PipePopup(), polarToScreenPoint() (+19 more)

### Community 141 - "Precast Ops"
Cohesion: 0.40
Nodes (5): Desktop shell (optional), Local development, Office deployment, Precast Ops, Project docs

### Community 142 - "bulk-attach-board.tsx"
Cohesion: 0.18
Nodes (19): approveStructureForProduction(), BulkAttachPage(), handleConfirm(), BulkAttachBoard(), getTile(), handleFiles(), renderTile(), selectMode() (+11 more)

### Community 150 - "stringToBytes"
Cohesion: 0.12
Nodes (8): ARCFourCipher, calculateMD5(), CipherTransform, CipherTransformFactory, PasswordException, stringToBytes(), utf8PasswordToBytes(), utf8StringToString()

### Community 151 - "printPdfUrl"
Cohesion: 0.07
Nodes (39): DeliveryTicketSubmittalPreviewPage(), DeliveryTicketSubmittalPreviewPageProps, printDeliveryTicketSubmittalsDirect(), DraftBatchPreviewPage(), generateQuotePdf(), GenerateQuotePdfResult, GenerateSubmittalPackageResult, renderPage() (+31 more)

### Community 152 - ".find"
Cohesion: 0.25
Nodes (3): FontFinder, makeObj(), stripQuotes()

### Community 154 - "calculateSHA512"
Cohesion: 0.07
Nodes (24): AES128Cipher, AES256Cipher, AESBaseCipher, calculate_sha256_ch(), calculate_sha256_littleSigma(), calculate_sha256_littleSigmaPrime(), calculate_sha256_maj(), calculate_sha256_sigma() (+16 more)

### Community 155 - "receiving-utils.ts"
Cohesion: 0.12
Nodes (30): InventoryReceiptsPage(), InventoryReceiptsPageProps, ReceivingPage(), accentBorderStyles, CategoryCardProps, ReceivingCategoryCard(), formatCastingPieceRoleLabel(), formatCalendarDateShort() (+22 more)

### Community 156 - "Builder"
Cohesion: 0.17
Nodes (3): Builder, Empty, UnknownNamespace

### Community 157 - "ref_fs"
Cohesion: 0.07
Nodes (20): dynamic, GET(), readBuildId(), CONTENT_TYPES, RouteContext, UPDATES_DIR, puppeteer, templatePath (+12 more)

### Community 158 - "ring-builder-modal.tsx"
Cohesion: 0.09
Nodes (49): updateRingBuilderSettingsFormAction(), saveRingBuilderSettings(), createDefaultHeightPoolRow(), createRowId(), formatRingBuilderUnitPrice(), HeightPoolRow, initOtherInputs(), OtherProductInput (+41 more)

### Community 159 - "structure-template-pdf-service.ts"
Cohesion: 0.40
Nodes (8): assertPathUnderRoot(), deleteTemplatePdf(), getStructureTemplatePdfsRoot(), readTemplatePdfBytes(), StructureTemplatePdfRecord, TemplatePdfVariant, main(), uniqueSetName()

### Community 160 - "job-structure-import-dialog.tsx"
Cohesion: 0.09
Nodes (32): JobStructureImportEntry, JobStructureImportResult, loadJobStructureImportOptions(), buildPreview(), Cell, detectShape(), ImportOptions, JobStructureImportButton() (+24 more)

### Community 161 - "SimpleDOMNode"
Cohesion: 0.15
Nodes (3): DatasetXMLParser, SimpleDOMNode, SimpleXMLParser

### Community 162 - "product-groups/page.tsx"
Cohesion: 0.14
Nodes (21): addProductGroupMemberFormAction(), addProductGroupMembersFormAction(), createProductGroupFormAction(), deleteProductGroupFormAction(), parseSortOrder(), removeProductGroupMemberFormAction(), reorderProductGroupMembers(), updateProductGroupFormAction() (+13 more)

### Community 165 - "main.mjs"
Cohesion: 0.06
Nodes (43): __dirname, getUserConfigPath(), loadConfig(), readJsonFile(), validateServerUrl(), buildApplicationMenu(), checkForNewServerBuild(), clearWebCache() (+35 more)

### Community 166 - "session-keep-alive.tsx"
Cohesion: 0.60
Nodes (5): keepSessionAlive(), recordPing(), SessionKeepAlive(), ping(), shouldPing()

### Community 167 - "draft-invoice-cover-html.ts"
Cohesion: 0.70
Nodes (4): buildDraftInvoiceCoverHtml(), escapeHtml(), formatDate(), money()

### Community 168 - "submittal-package.ts"
Cohesion: 0.10
Nodes (47): openProductDocumentOrThrow(), openProductSubmittalsFolderOrThrow(), getCompanyProfile(), getStockSubmittalsRoot(), getSubmittalsJobSubfolder(), assertPathUnderStockSubmittalsRoot(), assertProductExists(), buildSubmittalPackageBaseName() (+39 more)

### Community 169 - "job-sheet-import-actions.ts"
Cohesion: 0.15
Nodes (16): JobCustomStructureImportCandidate, JobSheetImportCandidate, JobSheetImportCandidates, loadJobSheetImportCandidates(), STATUS_LABELS, JobSheetImportDialog(), JobSheetImportDialogProps, DecimalLike (+8 more)

### Community 172 - ".push"
Cohesion: 0.03
Nodes (46): Annotation, CaretAnnotation, ChoiceWidgetAnnotation, CircleAnnotation, codePointIter(), core_utils_numberToString(), encodeToXmlString(), ErrorFont (+38 more)

### Community 173 - "ExclGroup"
Cohesion: 0.06
Nodes (9): addHTML(), Area, createLine(), ExclGroup, flushHTML(), getAvailableSpace(), getContainedChildren(), Subform (+1 more)

### Community 175 - "StringObject"
Cohesion: 0.02
Nodes (43): Amd, AppearanceFilter, Base, Certificate, config_Picture, connection_set_Uri, ConnectionSet, ConnectionSetNamespace (+35 more)

### Community 176 - "walk-ins-board.tsx"
Cohesion: 0.24
Nodes (14): MarkPickedUpControl(), handleConfirm(), BadgeVariant, CalledInPickupCard(), CompletedPickupCard(), dateLine(), itemsPaymentLine(), jobNameLine() (+6 more)

### Community 182 - "zone-map.tsx"
Cohesion: 0.28
Nodes (8): ZoneMap, ClickCapture(), FlyToPin(), ZoneMap(), ZoneMapProps, ResolvableZone, leaflet, react-leaflet

### Community 186 - "package.json"
Cohesion: 0.08
Nodes (24): eslintConfig, main, name, postcss, overrides, @hono/node-server, next, private (+16 more)

### Community 187 - "prisma.ts"
Cohesion: 0.03
Nodes (117): BulkCustomersPage(), BulkContactsPage(), EditCustomerPage(), EditCustomerPageProps, CustomerNotFound(), CustomerDetailPage(), CustomerDetailPageProps, NewCustomerPage() (+109 more)

### Community 188 - ".add"
Cohesion: 0.04
Nodes (24): CFFCompiler, CFFIndex, CFFOffsetTracker, Commands, compileCharString(), bezierCurveTo(), lineTo(), moveTo() (+16 more)

### Community 189 - "product-export.ts"
Cohesion: 0.11
Nodes (24): AdsPipeJointType, adsPipeJointTypeFormOptions, adsPipeJointTypeLabels, formatAdsPipeJointTypeLabel(), normalizeAdsPipeJointType(), formatCastingRoleLabel(), buildCustomersExportBuffer(), customerExportHeaders (+16 more)

### Community 192 - "BulkContactPasteForm"
Cohesion: 0.47
Nodes (4): checkBulkContactDbState(), BulkContactPasteForm(), handleParsePreview(), bulkContactRowKey()

### Community 196 - "custom-structure-import.ts"
Cohesion: 0.19
Nodes (14): Cell, cellText(), ColumnMap, customGridFromTsv(), CustomImportEntry, CustomImportIssue, CustomImportResult, CustomImportRow (+6 more)

### Community 198 - "outlook-draft.ts"
Cohesion: 0.31
Nodes (8): RFC-2047, base64Lines(), buildQuoteDraftEml(), encodeHeaderText(), QuoteDraftEmlInput, sanitizeFilename(), buildSample(), fakePdf

### Community 202 - "Datasets"
Cohesion: 0.20
Nodes (3): Datasets, datasets_Data, DatasetsNamespace

### Community 204 - "product-mapper.ts"
Cohesion: 0.14
Nodes (20): ProductRow, formatProductKindBadgeLabel(), categoryVariant(), documentTypeLabel(), formatDecimal(), formatDocumentDate(), formatFileSize(), formatYesNo() (+12 more)

### Community 208 - "contentDisposition"
Cohesion: 0.11
Nodes (31): GET(), parseCopyParam(), RouteContext, GET(), RouteContext, GET(), parseDateParam(), GET() (+23 more)

### Community 209 - "generate-circular-import-template.mjs"
Cohesion: 0.06
Nodes (33): handleFile(), handleFile(), StructureWorkbookOptions, xlsx, colWidths, EXAMPLE_ROWS, exampleSheet, HEADERS (+25 more)

### Community 210 - "pdf-text.ts"
Cohesion: 0.38
Nodes (6): CP1252_HIGH, fitPdfFieldFontSize(), isWinAnsi(), lastFontSize(), replaceLastFontSize(), WINANSI_REPLACEMENTS

### Community 227 - "rect-bulk-grid.tsx"
Cohesion: 0.07
Nodes (52): RectOpeningField, RectSheetFormValues, circularPayloadFromValues(), rectPayloadFromValues(), focusGridCell(), formatBrickInches(), formatElevation(), formatFeet() (+44 more)

### Community 242 - ".checkAndRepair"
Cohesion: 0.04
Nodes (38): adjustMapping(), adjustWidths(), Ai, amendFallbackToUnicode(), CFFFont, CompositeGlyph, Contour, convertCidString() (+30 more)

### Community 243 - "ConfigNamespace"
Cohesion: 0.01
Nodes (61): Acrobat, Acrobat7, AddSilentPrint, AddViewerPreferences, Agent, Change, Common, Compress (+53 more)

### Community 248 - "CalRGBCS"
Cohesion: 0.11
Nodes (4): CalGrayCS, CalRGBCS, DeviceCmykCS, LabCS

### Community 260 - "next"
Cohesion: 0.05
Nodes (92): ProductInventoryPageProps, CompactTable(), Home(), CastingSuppliersPageProps, ProductCatalogSettingsPageProps, VendorsPageProps, StructuresPage(), CustomerDetailContentProps (+84 more)

### Community 261 - "ColorSpace"
Cohesion: 0.05
Nodes (15): ColorSpace, ColorSpaceUtils, DefaultAppearanceEvaluator, DeviceGrayCS, DeviceRgbaCS, DeviceRgbCS, getB(), IccColorSpace (+7 more)

### Community 311 - "Phase 6 — Electron client (staff PCs)"
Cohesion: 0.25
Nodes (8): A. Server app updates (quotes, jobs, UI — most changes), B. Desktop shell updates (Electron auto-update), Build the installer, C. Server URL change only, Client updates (auto-update from server), Install on each desk PC, Local development with Electron, Phase 6 — Electron client (staff PCs)

### Community 315 - "warn"
Cohesion: 0.02
Nodes (31): AppearanceStreamEvaluator, Catalog, addPageError(), clearGlobalCaches(), CmykICCBasedCS, createValidAbsoluteUrl(), DatasetReader, decodeString() (+23 more)

### Community 330 - "allowScripts"
Cohesion: 0.25
Nodes (8): allowScripts, electron@35.7.5, esbuild@0.28.1, prisma@7.8.0, @prisma/engines@7.8.0, puppeteer@25.1.0, sharp@0.34.5, unrs-resolver@1.12.2

### Community 333 - "Security posture: internal, trusted-network tool"
Cohesion: 0.67
Nodes (3): Authentication today, Authorization, Security posture: internal, trusted-network tool

### Community 336 - "util_assert"
Cohesion: 0.10
Nodes (10): compileFontInfo(), writeBuffer(), convertBlackAndWhiteToRGBA(), convertToRGBA(), encodeStrings(), ImageResizer, PDFImage, toRomanNumerals() (+2 more)

## Knowledge Gaps
- **1362 isolated node(s):** `dynamic`, `RouteContext`, `RouteContext`, `RouteContext`, `RouteContext` (+1357 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 2406 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **53 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `util_shadow()` connect `warn` to `.get`, `pdf.worker.min.mjs`, `ColorSpace`, `.getOperatorList`, `.parse`, `stringToBytes`, `.createDocumentHandler`, `Jbig2Stream`, `.success`, `.push`, `XMLParserBase`, `.add`, `util_assert`, `randomId`, `._bindElement`, `FormatError`, `.checkAndRepair`, `ConfigNamespace`, `CalRGBCS`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `vitest` connect `prisma` to `rect-structure.ts`, `delivery-schedule-pdf-html.ts`, `app-settings.ts`, `invoice-pdf-fill.ts`, `delivery-ticket-editor.tsx`, `drill-sheet-template-pdf.ts`, `QuoteForm`, `printPdfUrl`, `receiving-utils.ts`, `galley-actions.ts`, `ring-builder-modal.tsx`, `users/actions.ts`, `job-structure-import-dialog.tsx`, `returnActionError`, `invoices/actions.ts`, `withDatabaseRetry`, `drill-sheet.ts`, `job-sheet-import-actions.ts`, `auth/constants.ts`, `customer-mapper.ts`, `structures/actions.ts`, `bulk-load-planner.tsx`, `package.json`, `prisma.ts`, `delivery-tickets/actions.ts`, `custom-structure-import.ts`, `delivery-ticket-utils.ts`, `outlook-draft.ts`, `job-detail-mapper.ts`, `quote-pdf-line-items.ts`, `delivery-ticket-pdf-fill.ts`, `delivery-fulfillment.ts`, `generate-circular-import-template.mjs`, `invoicing-service.ts`, `purchase-orders/actions.ts`, `plan-sheet-actions.ts`, `quotes/actions.ts`, `rect-bulk-grid.tsx`, `bid-actions.ts`, `send-actions.ts`, `requirePermission`, `react`, `windows-explorer.ts`, `price-list-service.ts`, `app_generated_prisma_client`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `next`, `app-settings.ts`, `rect-structure-workbook.ts`, `structure-workbook-plan-takeoff.tsx`, `delivery-ticket-editor.tsx`, `bulk-attach-board.tsx`, `QuoteForm`, `quote-form.tsx`, `drill-sheets/[id]/page.tsx`, `product-form.tsx`, `printPdfUrl`, `delivery-tickets/pdf-actions.ts`, `galley-actions.ts`, `ring-builder-modal.tsx`, `job-structure-import-dialog.tsx`, `drill-sheet-preview.tsx`, `product-groups/page.tsx`, `session-keep-alive.tsx`, `invoices/actions.ts`, `returnActionError`, `withDatabaseRetry`, `job-sheet-import-actions.ts`, `drill-sheet-form.tsx`, `shipping/actions.ts`, `walk-ins-board.tsx`, `auth/constants.ts`, `customer-mapper.ts`, `zone-map.tsx`, `bulk-load-planner.tsx`, `package.json`, `prisma.ts`, `delivery-tickets/actions.ts`, `delivery-ticket-utils.ts`, `job-detail-mapper.ts`, `delivery-ticket-detail-content.tsx`, `navigateAfterAction`, `SectionCard`, `inventory/page.tsx`, `randomId`, `circular-structure-import.ts`, `settings/actions.ts`, `rect-bulk-grid.tsx`, `structure-workbook.tsx`, `product-taxonomy.server.ts`, `send-actions.ts`, `requirePermission`, `structure-utils.ts`, `shipping-zones-manager.tsx`, `app_generated_prisma_client`, `reloadAfterAction`, `drill-sheets/pdf-actions.ts`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **What connects `dynamic`, `RouteContext`, `RouteContext` to the rest of the system?**
  _1362 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app/products/actions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07017543859649122 - nodes in this community are weakly interconnected._
- **Should `rect-structure.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0898989898989899 - nodes in this community are weakly interconnected._
- **Should `pdf.worker.min.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.008955956324377377 - nodes in this community are weakly interconnected._