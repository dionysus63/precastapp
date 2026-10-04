# Graph Report - precastapp  (2026-10-04)

## Corpus Check
- 758 files · ~480,325 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 3, .mdc 2, .example 1)

## Summary
- 8901 nodes · 26228 edges · 216 communities (169 shown, 47 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 226 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `46c87df7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app/products/actions.ts
- rect-structure.ts
- _
- ConfigNamespace
- TemplateNamespace
- .getOperatorList
- structure-workbook.ts
- rect-structure-workbook.ts
- ContentObject
- rect-template-pdf.ts
- DeliveryTicketEditor
- .getTextContent
- drill-sheet-template-pdf.ts
- QuoteForm
- quote-form.tsx
- company-logo.ts
- job-structure-workflow.ts
- invoice-pdf-data.ts
- products/bulk-paste-form.tsx
- product-kinds.ts
- compilerOptions
- BasePdfManager
- Annotation
- next
- Glyph
- app_generated_prisma_client_prisma
- confirm-dialog.tsx
- galley-actions.ts
- delivery-ticket-pdf-line-items.ts
- drain-ring-matrix-utils.ts
- submittal-package.ts
- drill-sheet-preview.tsx
- scripts
- job-detail-mapper.ts
- build
- .add
- import-rect-sheet-pdfs.ts
- quote-line-items-table.tsx
- daily-production-entry.tsx
- rect-sheet-detail-view.tsx
- drill-sheet.ts
- .success
- inventory/page.tsx
- FormatError
- import/actions.ts
- delivery-ticket-editor.tsx
- shipping/actions.ts
- XMLParserBase
- auth/constants.ts
- dependencies
- schedule/page.tsx
- structures/actions.ts
- bulk-load-planner.tsx
- postcss.config.mjs
- contact-actions.ts
- operations/actions.ts
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
- settings/products/page.tsx
- delivery-ticket-pdf-pickup.ts
- pipe-modal.tsx
- XmlObject
- delivery-fulfillment.ts
- job-structure-detail-mapper.ts
- purchase-receipt-form.tsx
- casting-utils.ts
- AGENTS.md
- walk-ins-board.tsx
- vitest
- production-board.tsx
- .push
- ChunkedStreamManager
- quotes/actions.ts
- .process
- product-export.ts
- zones.ts
- paginateQuoteLineItems
- calculateSHA256
- AnnotationBorderStyle
- input.tsx
- Precast Ops desktop updates
- ln
- GlobalColorSpaceCache
- .getUint16
- invoice-pdf-fill.ts
- app-settings.ts
- drawLineItemRow
- product-form.tsx
- generate-invoice-templates.ts
- send-actions.ts
- XhtmlObject
- schedule-loads-editor.tsx
- react
- inventory-service.ts
- plan-sheet-actions.ts
- windows-explorer.ts
- bulk-attach-board.tsx
- app_generated_prisma_client
- quote-utils.ts
- Office deployment — single Windows server + UNC job folders
- Office rollout checklist
- prisma.ts
- reloadAfterAction
- printPdfUrl
- price-list-service.ts
- .get
- LocaleSetNamespace
- delivery-schedule-pdf-html.ts
- rich-text.ts
- Deployment server info checklist
- delivery-ticket-pdf-html.ts
- Troubleshooting
- .constructor
- structure-workbook-plan-takeoff.tsx
- Precast Ops
- ProductDocumentsSection
- .constructor
- BasePDFStream
- calculateSHA512
- pdfjs-dist
- drill-sheet-preview-content.tsx
- receiving-utils.ts
- FontFinder
- render-example-sheets.ts
- ring-builder-modal.tsx
- JpegImage
- session.ts
- draft-invoice-cover-html.ts
- customer-mapper.ts
- delivery-ticket-submittal-preview-content.tsx
- quote-preview-content.tsx
- main.mjs
- lexer_Lexer
- quote-pdf-line-items.test.ts
- product-submittals-service.ts
- SimpleGlyph
- test-db.ts
- TextState
- Dict
- ExclGroup
- ChunkedStream
- StringObject
- invoice-mapper.ts
- Stream
- .#Se
- NullOptimizer
- package.json
- DashboardShell
- BasePDFStreamReader
- DeviceGrayCS
- print-pdf-url.ts
- drill-sheets/pdf-actions.ts
- job-folders.ts
- custom-structure-import.ts
- CMap
- delivery-tickets/actions.ts
- product-mapper.ts
- delivery-ticket-pdf-data.ts
- DeviceRgbCS
- job-structure-import-dialog.tsx
- rect-bulk-grid.tsx
- .checkAndRepair
- XFAObject
- LabCS
- xdp_Xdp
- ._hash
- SectionCard
- ColorSpace
- customer-name-similarity.ts
- SingleIntersector
- process-app-icon.ps1
- unreachable
- Color
- Phase 6 — Electron client (staff PCs)
- warn
- CalRGBCS
- allowScripts
- Security posture: internal, trusted-network tool
- assert
- ta

## God Nodes (most connected - your core abstractions)
1. `_` - 1180 edges
2. `withDatabaseRetry()` - 349 edges
3. `requirePermission()` - 335 edges
4. `next` - 209 edges
5. `XFAObject` - 206 edges
6. `SectionCard()` - 195 edges
7. `warn()` - 173 edges
8. `DashboardShell()` - 162 edges
9. `react` - 152 edges
10. `ConfigNamespace` - 141 edges

## Surprising Connections (you probably didn't know these)
- `Authentication today` --references--> `signInWithPassword()`  [INFERRED]
  AGENTS.md → app/login/actions.ts
- `Quote → JobStructure linking` --references--> `linkJobStructuresFromQuote()`  [INFERRED]
  docs/STRUCTURE_PRODUCTION_WORKFLOW.md → lib/job-structure-workflow.ts
- `handleDelete()` --calls--> `deleteCustomer()`  [EXTRACTED]
  components/customers/delete-customer-button.tsx → app/customers/actions.ts
- `handleImport()` --calls--> `importCustomers()`  [EXTRACTED]
  components/customers/bulk-paste-form.tsx → app/customers/actions.ts
- `handleDiscardSavedPlan()` --calls--> `discardSavedLoadPlan()`  [EXTRACTED]
  components/delivery-tickets/bulk-load-planner.tsx → app/delivery-tickets/actions.ts

## Import Cycles
- None detected.

## Communities (216 total, 47 thin omitted)

### Community 0 - "app/products/actions.ts"
Cohesion: 0.08
Nodes (46): parseCustomerFormData(), parseJobFormData(), parseJobUpdateFormData(), assertAllAssemblyComponentCodesExist(), BulkImportRow, bulkImportUpdateData(), collectAssemblyBomImportRows(), collectReferencedComponentCodes() (+38 more)

### Community 1 - "rect-structure.ts"
Cohesion: 0.09
Nodes (39): SumpMode, annotateRectOpeningSections(), ComputedRectSection, computeHorizontalGeometry(), computeRectDefaultSumpFeet(), computeRectPricing(), computeRectStructure(), computeRectWallHeightFeet() (+31 more)

### Community 2 - "_"
Cohesion: 0.01
Nodes (326): _, 1072(), 1108(), 1148(), 116(), 1181(), 1291(), 1385() (+318 more)

### Community 3 - "ConfigNamespace"
Cohesion: 0.01
Nodes (84): Acrobat, Acrobat7, ADBE_JSConsole, ADBE_JSDebugger, AddSilentPrint, AddViewerPreferences, AdjustData, AdobeExtensionLevel (+76 more)

### Community 5 - "TemplateNamespace"
Cohesion: 0.01
Nodes (70): AppearanceFilter, Barcode, Bind, Border, Break, BreakAfter, BreakBefore, Calculate (+62 more)

### Community 6 - ".getOperatorList"
Cohesion: 0.03
Nodes (36): 4576(), addCachedImageOps(), adjustWidths(), BaseLocalCache, CheckedOperatorList, ColorSpaceUtils, EvalState, fetchBinaryData() (+28 more)

### Community 7 - "structure-workbook.ts"
Cohesion: 0.06
Nodes (76): JobSheetImportCandidate, PlanSheetRecord, savePlanSheetMarkup(), DrillSheetTemplateOption, JobSheetImportDialog(), JobSheetImportDialogProps, CircularImportDialogProps, pipeSizesForMaterial() (+68 more)

### Community 9 - "rect-structure-workbook.ts"
Cohesion: 0.06
Nodes (72): loadJobSheetImportCandidates(), completeRectDrillSheets(), RectSheetCastingOption, RectSheetOpeningSizeOption, RectSheetTemplateOption, CompleteDrillSheetEntry, CompleteDrillSheetsClient(), handleCreate() (+64 more)

### Community 10 - "ContentObject"
Cohesion: 0.02
Nodes (26): handleDeliverAll(), AlwaysEmbed, BehaviorOverride, BooleanElement, ContentObject, createText(), DateElement, DateTime (+18 more)

### Community 11 - "rect-template-pdf.ts"
Cohesion: 0.04
Nodes (77): buildRectSheetPdfBytes(), RectSheetPdfBuildResult, sectionJointHeightsFeet(), baseOffsetText(), BLACK, buildFlaps(), buildRectSheetFieldMap(), CalloutLayout (+69 more)

### Community 12 - "DeliveryTicketEditor"
Cohesion: 0.06
Nodes (52): getQuoteFulfillmentWithOpenLoads(), DeliveryTicketEditor(), addExtraCustomLine(), addExtraProduct(), addWalkInLine(), applyAutoRingAssignment(), applyPickupListPrices(), buildPayload() (+44 more)

### Community 13 - ".getTextContent"
Cohesion: 0.07
Nodes (23): Commands, CompiledFont, FontRendererFactory, getSubroutineBias(), lookupCmap(), parseCff(), buildPath(), addFakeSpaces() (+15 more)

### Community 14 - "drill-sheet-template-pdf.ts"
Cohesion: 0.05
Nodes (61): CONTENT_TYPES, RouteContext, UPDATES_DIR, DrillSheetPreviewMeta, ComputedOpening, flattenPdfForms(), applyTemplateFieldFonts(), baseSectionHeightFeet() (+53 more)

### Community 15 - "QuoteForm"
Cohesion: 0.06
Nodes (52): loadJobCustomStructureImportCandidates(), toPlainNumberString(), createDefaultCustomStructureRow(), createLineId(), QuoteForm(), addCategoryLine(), addLineItem(), addLineItems() (+44 more)

### Community 16 - "quote-form.tsx"
Cohesion: 0.04
Nodes (47): QuoteSaveDestination, JobCustomStructureImportCandidate, AddLineModalType, CustomStructureRow, FlashMessage, QuoteFormProps, chipClassName(), StagedStockProduct (+39 more)

### Community 17 - "company-logo.ts"
Cohesion: 0.07
Nodes (45): GET(), DEFAULT_APP_SETTINGS_DATA, COMPANY_LOGO_FILENAME, DEFAULT_SEED_LOGO_PDF_PATH, getCompanyLogoPath(), hasCompanyLogo(), pathExists(), convertPdfToPng() (+37 more)

### Community 18 - "job-structure-workflow.ts"
Cohesion: 0.04
Nodes (70): addJobBidder(), awardJob(), generateQuotesFromMaster(), removeJobBidder(), CreateQuoteInput, buildContactMapForGenerate(), buildDefaultContactMap(), JobBiddingPanel() (+62 more)

### Community 19 - "invoice-pdf-data.ts"
Cohesion: 0.18
Nodes (16): removeAdsJointTypeSuffix(), removeTrailingRingHeightSuffix(), splitMultilineAddress(), blankOr(), buildInvoiceFormData(), DbInvoiceForPdf, formatCustomerAddress(), formatDateForPdf() (+8 more)

### Community 20 - "products/bulk-paste-form.tsx"
Cohesion: 0.07
Nodes (39): findExistingProductCodesAction(), BulkPasteForm(), handleImport(), handleParsePreview(), lookUpExistingCodes(), BulkPasteFormProps, formatMissingTaxonomySummary(), parseBulkPaste() (+31 more)

### Community 21 - "product-kinds.ts"
Cohesion: 0.08
Nodes (31): parseCastingBomPayload(), handleRingDiameterChange(), parseAdsPipeJointType(), parseCastingPieceRole(), assertSanitaryDrainRingAllowed(), diameterSupportsSanitaryDrainRing(), DRAIN_RING_SANITARY_DIAMETERS, drainRingStyleFormOptions (+23 more)

### Community 22 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 23 - "BasePdfManager"
Cohesion: 0.06
Nodes (13): BasePdfManager, LocalPdfManager, NetworkPdfManager, WorkerMessageHandler, ensureNotTerminated(), finishWorkerTask(), loadDocument(), setupDoc() (+5 more)

### Community 24 - "Annotation"
Cohesion: 0.05
Nodes (9): Annotation, DataHandler, IndexedCS, MathClamp(), parsePostScriptFunction(), PDFFunction, PopupAnnotation, toNumberArray() (+1 more)

### Community 25 - "next"
Cohesion: 0.04
Nodes (85): PageProps, createDrillSheet(), createRectSheet(), deleteDrillSheet(), updateDrillSheet(), updateRectSheet(), upgradeRectSheetFromPlaceholder(), NewDrillSheetPage() (+77 more)

### Community 26 - "Glyph"
Cohesion: 0.12
Nodes (4): CompositeGlyph, GlyfTable, Glyph, GlyphHeader

### Community 27 - "app_generated_prisma_client_prisma"
Cohesion: 0.07
Nodes (46): BulkImportRow, createCustomer(), CUSTOMER_STATUSES, CustomerRecordInput, deleteCustomer(), findSimilarCustomers(), importCustomers(), ImportCustomersResult (+38 more)

### Community 28 - "confirm-dialog.tsx"
Cohesion: 0.11
Nodes (21): GlobalError(), isStaleDeploymentError(), RootLayout(), NotFound(), ResetPasswordButton(), ResetPasswordButtonProps, AppProviders(), Button() (+13 more)

### Community 29 - "galley-actions.ts"
Cohesion: 0.14
Nodes (25): injectGalleyFamilyOptions(), applyGalleyBreakdown(), ApplyGalleyBreakdownResult, BREAKDOWN_STATUSES, BreakdownDialog(), submit(), formatMixSummary(), GalleyBreakdownBanner() (+17 more)

### Community 30 - "delivery-ticket-pdf-line-items.ts"
Cohesion: 0.10
Nodes (33): COL_DESC_WIDTH, COL_DESC_X, COL_ITEM_NUM_WIDTH, COL_ITEM_NUM_X, COL_QTY_WIDTH, COL_QTY_X, DEFAULT_TABLE_LAYOUT, DeliveryTicketTableLayout (+25 more)

### Community 31 - "drain-ring-matrix-utils.ts"
Cohesion: 0.07
Nodes (38): DrainRingMatrixRows(), DrainRingMatrixRowsProps, DrainRingStyleTable(), DrainRingStyleTableProps, FEET_STAT_COLUMNS, ringStockClassName(), ringStockLabel(), allocateRingsAcrossPools() (+30 more)

### Community 32 - "submittal-package.ts"
Cohesion: 0.08
Nodes (54): DeliveryTicketPdfPreviewResult, generateDeliveryTicketPdf(), GenerateDeliveryTicketPdfResult, getDeliveryTicketPdfPreviewBase64(), loadTicketForPdf(), PrintDeliveryTicketDirectResult, saveDeliverySchedulePdf(), SaveDeliverySchedulePdfResult (+46 more)

### Community 33 - "drill-sheet-preview.tsx"
Cohesion: 0.11
Nodes (41): CalcRow(), DrillSheetPreview(), DrillSheetPreviewProps, feet(), HeaderRow(), PlanDiagram(), PreviewPanel(), angleToClockPosition() (+33 more)

### Community 34 - "scripts"
Cohesion: 0.11
Nodes (19): scripts, build, db:seed, db:sync-files, deploy:build, deploy:check, deploy:start, deploy:update (+11 more)

### Community 35 - "job-detail-mapper.ts"
Cohesion: 0.03
Nodes (124): updateJobStatusAction(), listCustomersForBidList(), JobTabContent(), JobTabContentProps, JobDetailPage(), JobDetailPageProps, resolveTab(), VALID_TABS (+116 more)

### Community 36 - "build"
Cohesion: 0.11
Nodes (18): build, appId, directories, extraResources, icon, nsis, productName, publish (+10 more)

### Community 37 - ".add"
Cohesion: 0.03
Nodes (25): CFF, CFFCharset, CFFCompiler, CFFDict, CFFFDSelect, CFFHeader, CFFIndex, CFFOffsetTracker (+17 more)

### Community 38 - "import-rect-sheet-pdfs.ts"
Cohesion: 0.08
Nodes (50): createSheetPdfSetAction(), deleteSheetPdfSetAction(), deleteSheetPdfSetFileAction(), parseBooleanField(), renameSheetPdfSetAction(), revalidate(), uploadSheetPdfSetFileAction(), SHAPE_LABELS (+42 more)

### Community 39 - "quote-line-items-table.tsx"
Cohesion: 0.09
Nodes (34): CustomStructureCostBreakdown(), addItem(), CustomStructureCostBreakdownProps, CustomStructureDetailBreakdown(), CustomStructurePricingFooter(), CustomStructurePricingFooterProps, autoResizeTextarea(), CellKeyDownHandler (+26 more)

### Community 40 - "daily-production-entry.tsx"
Cohesion: 0.17
Nodes (16): saveDailyProductionDay(), DailyProductionPage(), DailyProductionPageProps, DailyProductionEntry(), save(), DailyProductionEntryProps, localToday(), shiftDate() (+8 more)

### Community 41 - "rect-sheet-detail-view.tsx"
Cohesion: 0.10
Nodes (30): aboveFloorText(), fmtElevation(), InfoRow(), placementText(), RectSheetDetailView(), RectSheetDetailViewProps, Stat(), wholeInches() (+22 more)

### Community 42 - "drill-sheet.ts"
Cohesion: 0.07
Nodes (38): annotateOpeningSections(), buildSolverHoles(), compareCost(), computeBaseTopToOpeningBottomInches(), computeDefaultSumpFeet(), computeDrillSheet(), ComputedSection, ComputedWeights (+30 more)

### Community 43 - ".success"
Cohesion: 0.04
Nodes (41): applyAssist(), Arc, ariaLabel(), bf, Caption, CheckButton, checkDimensions(), ChoiceList (+33 more)

### Community 44 - "inventory/page.tsx"
Cohesion: 0.03
Nodes (124): AGGREGATE_SORT_COLUMNS, CONTACT_SORT_COLUMNS, ContactSortColumn, CUSTOMER_SORT_FIELDS, CustomerSortColumn, CustomersPage(), isAggregateSortColumn(), loadCustomerAggregates() (+116 more)

### Community 45 - "FormatError"
Cohesion: 0.04
Nodes (30): clearGlobalCaches(), Cmd, DatasetReader, decodeString(), EvaluatorPreprocessor, expectInt(), expectString(), extendCMap() (+22 more)

### Community 46 - "import/actions.ts"
Cohesion: 0.11
Nodes (35): buildCastingResolver(), CastingResolution, importPipeOpenings(), importRectOpenings(), ImportRowInput, ImportRowMessage, importStructureTemplates(), importTemplates() (+27 more)

### Community 47 - "delivery-ticket-editor.tsx"
Cohesion: 0.03
Nodes (93): saveProductionEntry(), FormTypeahead(), closeDropdown(), handleContainerBlur(), handleKeyDown(), handleSelect(), FormTypeaheadProps, DeliveryTicketEditorProps (+85 more)

### Community 48 - "shipping/actions.ts"
Cohesion: 0.12
Nodes (26): lookupShippingRate(), lookupShippingRateAtPoint(), resolveShippingRateForPoint(), ShippingLookupResult, ShippingLookupSuccess, AddressAutocomplete(), closeDropdown(), handleContainerBlur() (+18 more)

### Community 50 - "XMLParserBase"
Cohesion: 0.06
Nodes (7): DatasetXMLParser, MetadataParser, SimpleDOMNode, SimpleXMLParser, XFAParser, XMLParserBase, skipWs()

### Community 51 - "auth/constants.ts"
Cohesion: 0.06
Nodes (56): updateRolePermissionsFormAction(), RolesSettingsPage(), RolesSettingsPageProps, saveRolePermissions(), EditSettingsUserPage(), NewSettingsUserPage(), HeaderProps, NAV_ICON_PATHS (+48 more)

### Community 52 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, leaflet, next, nodemailer, pdf-lib, @pdf-lib/fontkit, pdf-to-printer, pdfjs-dist (+11 more)

### Community 53 - "schedule/page.tsx"
Cohesion: 0.09
Nodes (32): GET(), parseVariant(), RouteContext, AllDeliveryTicketsPage(), startOfToday(), VALID_DELIVERY_STATUSES, DeliveryTicketDetailPage(), DeliveryTicketDetailPageProps (+24 more)

### Community 54 - "structures/actions.ts"
Cohesion: 0.07
Nodes (47): assertDiametersHaveMolds(), createStructureTemplate(), deleteStructureTemplate(), duplicateStructureTemplate(), handlePrismaError(), loadCastingProductOptions(), parseTemplatePayload(), resolvePriceListIdForTemplateSave() (+39 more)

### Community 55 - "bulk-load-planner.tsx"
Cohesion: 0.07
Nodes (50): DeliveryTicketLineInput, PlannedLoadInput, savePlannedLoads(), SavePlannedLoadsInput, buildRows(), BulkLoadPlanner(), addLoad(), autoRingCount() (+42 more)

### Community 57 - "contact-actions.ts"
Cohesion: 0.13
Nodes (29): addCustomerContact(), BulkContactDbState, BulkContactImportRow, CONTACT_ROLES, CustomerContactInput, deleteCustomerContact(), importContacts(), ImportContactsResult (+21 more)

### Community 64 - "operations/actions.ts"
Cohesion: 0.06
Nodes (66): computeInvoiceFinancials(), deleteDraftInvoice(), DraftInvoiceLineInput, EDITABLE_INVOICE_STATUSES, finalizeInvoices(), getInvoiceTabCounts(), InvoiceListRow, listInvoicesForPage() (+58 more)

### Community 65 - "quote-mapper.ts"
Cohesion: 0.09
Nodes (33): mapStructure(), needsDrillSheetWhere, ProductionPage(), structureInclude, createDrillSheetsFromQuote(), ProductionQueueItem, formatDateShort(), resolveCreateDrillSheetHref() (+25 more)

### Community 66 - "Handy Commands — Precast App"
Cohesion: 0.15
Nodes (13): App (Next.js), Browse data, Daily workflow, Database backups, Electron desktop client, Git / GitHub (optional), Handy Commands — Precast App, Office deployment (Windows server) (+5 more)

### Community 67 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, electron, electron-builder, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx (+8 more)

### Community 68 - "withDatabaseRetry"
Cohesion: 0.04
Nodes (101): RouteContext, GET(), RouteContext, GET(), parseDateParam(), GET(), parseDateParam(), GET() (+93 more)

### Community 69 - "delivery-ticket-utils.ts"
Cohesion: 0.07
Nodes (37): deliveryDateFilterOptions, DeliveryFilterOptions, deliveryTicketCustomerOptions, DeliveryTicketDetailLineItem, DeliveryTicketDetailView, deliveryTicketDriverOptions, DeliveryTicketFormLineItem, deliveryTicketInputClassName (+29 more)

### Community 70 - "PsWasmCompiler"
Cohesion: 0.06
Nodes (23): ast_Parser, buildPostScriptWasmFunction(), encodeASCIIString(), _nodesEqual(), Ps, PsArgNode, PsBinaryNode, PsBlock (+15 more)

### Community 71 - "quote-pdf-line-items.ts"
Cohesion: 0.12
Nodes (26): COL_DESC_WIDTH, COL_DESC_X, COL_ITEM_NUM_X, COL_QTY_WIDTH, COL_QTY_X, COL_TOTAL_WIDTH, COL_TOTAL_X, COL_UNIT_PRICE_WIDTH (+18 more)

### Community 72 - "rect-sheet-detail.ts"
Cohesion: 0.12
Nodes (26): DrillSheetDetailPage(), DrillSheetDetailPageProps, loadJobSheetNav(), RectSheetDetail(), DeleteDrillSheetButton(), DeleteDrillSheetButtonProps, DrillSheetJobNav(), JobSheetNavEntry (+18 more)

### Community 73 - "casting-ticket-lines.ts"
Cohesion: 0.23
Nodes (8): CastingCollapseMeta, CastingCollapsibleLine, CastingExplodeComponent, CastingExplodedPiece, collapseCastingTicketLines(), perSetByProduct(), setWeightFor(), META

### Community 74 - "settings/actions.ts"
Cohesion: 0.11
Nodes (38): clearAllCustomersFormAction(), clearAllDeliveryTicketsFormAction(), clearAllJobsFormAction(), clearAllProductsFormAction(), clearAllQuotesFormAction(), clearAllStructuresFormAction(), createPriceList(), createPriceListFormAction() (+30 more)

### Community 75 - "delivery-ticket-pdf-fill.ts"
Cohesion: 0.16
Nodes (24): GET(), parseCopyParam(), DbDeliveryTicketForPdf, buildContentPageBytes(), buildCopyPdfBytes(), fillAcroFormFields(), fitTermsField(), generateDeliveryTicketCopyPdfBytes() (+16 more)

### Community 76 - "settings/products/page.tsx"
Cohesion: 0.22
Nodes (18): createProductCategoryFormAction(), createProductSubcategoryFormAction(), deleteProductCategory(), deleteProductSubcategory(), revalidateProductTaxonomyPaths(), updateProductCategoryFormAction(), updateProductSubcategoryFormAction(), ProductCatalogSettingsPage() (+10 more)

### Community 77 - "delivery-ticket-pdf-pickup.ts"
Cohesion: 0.14
Nodes (17): FONT_SIZE, LINE_HEIGHT, ROW_PADDING, wrapText(), applyPickupTicketArtwork(), BAND_CAPTIONS, BAND_COLS, BLACK (+9 more)

### Community 78 - "pipe-modal.tsx"
Cohesion: 0.13
Nodes (27): createDefaultQuoteRow(), createRowId(), PipeModal(), handleAddQuoteLines(), handleAddUnitPricesToDescription(), handleClose(), resetModal(), PipeModalMode (+19 more)

### Community 79 - "XmlObject"
Cohesion: 0.04
Nodes (9): Builder, Datasets, datasets_Data, DatasetsNamespace, Empty, Root, UnknownNamespace, XFAAttribute (+1 more)

### Community 80 - "delivery-fulfillment.ts"
Cohesion: 0.11
Nodes (35): AdsPipeOption, allLineageIds(), buildFulfillmentFromContext(), buildQuoteLineLineageMap(), buildScheduledFromContext(), DbClient, DELIVERED_TICKET_STATUS, drainRingCatalogKey() (+27 more)

### Community 81 - "job-structure-detail-mapper.ts"
Cohesion: 0.14
Nodes (18): buildWorkflowSteps(), deriveNeedsDrillSheet(), formatDate(), formatFileSize(), formatQuantity(), JobStructureDetailView, JobStructureDocumentRow, JobStructureWithRelations (+10 more)

### Community 82 - "purchase-receipt-form.tsx"
Cohesion: 0.09
Nodes (29): AssemblyOption, createRow(), prefillRowsFromPurchaseOrder(), ProductOption, PurchaseReceiptForm(), addLine(), handleSelectPurchaseOrder(), handleSubmit() (+21 more)

### Community 83 - "casting-utils.ts"
Cohesion: 0.13
Nodes (16): buildCastingBomFromProductCodes(), CastingAssemblyBomImportRow, castingAssemblyBomRoleOrder, castingAssemblyOptionalBomRoles, castingAssemblyRequiredBomRoles, CastingBomRowInput, CastingComponentLookup, CastingComponentOption (+8 more)

### Community 84 - "AGENTS.md"
Cohesion: 0.38
Nodes (4): Codebase exploration: use graphify first, Prisma / Database Rules, Project context, This is NOT the Next.js you know

### Community 85 - "walk-ins-board.tsx"
Cohesion: 0.28
Nodes (12): BadgeVariant, CalledInPickupCard(), CompletedPickupCard(), dateLine(), itemsPaymentLine(), jobNameLine(), paymentLabel(), PickupCardBody() (+4 more)

### Community 86 - "vitest"
Cohesion: 0.10
Nodes (19): BatchInvoiceConversionResult, CastingSetCharge, castingSetsStarted(), convertDeliveryTicketToInvoice(), InvoiceAlreadyExistsError, invoiceDueDateFromDelivery(), mapDeliveryLineTypeToInvoiceLineType(), maybeCreatePayNowInvoiceForTicket() (+11 more)

### Community 87 - "production-board.tsx"
Cohesion: 0.14
Nodes (22): approveStructureForProduction(), markStructureMade(), revalidateStructurePaths(), startStructureProduction(), submitStructureForApproval(), DrillSheetPdfLink(), JobStructureDetailContent(), runAction() (+14 more)

### Community 88 - ".push"
Cohesion: 0.09
Nodes (16): addChildren(), Binder, buildHuffmanTable(), createDataNode(), ea, encodeToXmlString(), escapePDFName(), Items (+8 more)

### Community 90 - "quotes/actions.ts"
Cohesion: 0.10
Nodes (32): assertGalleyFamiliesExist(), computeQuoteFinancials(), createQuote(), CreateQuoteLineItemInput, deleteQuote(), DeleteQuoteResult, isQuoteNumberConflict(), parseOptionalDate() (+24 more)

### Community 91 - ".process"
Cohesion: 0.10
Nodes (8): addHex(), BinaryCMapReader, BinaryCMapStream, createBuiltInCMap(), hexToInt(), hexToStr(), IdentityCMap, incHex()

### Community 92 - "product-export.ts"
Cohesion: 0.13
Nodes (17): AdsPipeJointType, adsPipeJointTypeFormOptions, adsPipeJointTypeLabels, formatAdsPipeJointTypeLabel(), normalizeAdsPipeJointType(), loadAdsPipeCatalogByLine(), needsAdsPipeSubstitute(), formatOptionalDecimal() (+9 more)

### Community 93 - "zones.ts"
Cohesion: 0.18
Nodes (14): ShippingZonesPage(), ZoneListItem, ClickCapture(), FlyToPin(), ZoneMap(), ZoneMapProps, LatLng, parsePolygonRing() (+6 more)

### Community 94 - "paginateQuoteLineItems"
Cohesion: 0.40
Nodes (4): availableHeight(), paginateQuoteLineItems(), suffixFitsMain(), mockFont

### Community 95 - "calculateSHA256"
Cohesion: 0.36
Nodes (8): calculate_sha256_ch(), calculate_sha256_littleSigma(), calculate_sha256_littleSigmaPrime(), calculate_sha256_maj(), calculate_sha256_sigma(), calculate_sha256_sigmaPrime(), calculateSHA256(), rotr()

### Community 97 - "input.tsx"
Cohesion: 0.40
Nodes (3): inputClassName, InputProps, textareaClassName

### Community 98 - "Precast Ops desktop updates"
Cohesion: 0.40
Nodes (4): Precast Ops desktop updates, Publish a desktop update (from the dev PC), Verify (from any office PC), Which machine does what

### Community 99 - "ln"
Cohesion: 0.12
Nodes (10): AbortException, DNLMarkerError, EOIMarkerError, ln, MessageHandler, ParserEOFException, PasswordException, ResponseException (+2 more)

### Community 101 - ".getUint16"
Cohesion: 0.20
Nodes (16): buildComponentData(), decodeScan(), decodeBlock(), decodeHuffman(), decodeMcu(), readBit(), receive(), receiveAndExtend() (+8 more)

### Community 102 - "invoice-pdf-fill.ts"
Cohesion: 0.08
Nodes (38): InvoiceContentPage, buildInvoicePageBytes(), drawDraftWatermark(), ensureInvoiceTemplateExists(), fillAcroFormFields(), getInvoiceContinuationTemplatePath(), getInvoiceTemplatePath(), readInvoiceContinuationTemplateBytes() (+30 more)

### Community 104 - "app-settings.ts"
Cohesion: 0.05
Nodes (58): DeliveryTicketPreviewPage(), DeliveryTicketPreviewPageProps, PREVIEW_ORIGINS, DeliveryTicketSubmittalPreviewPage(), DeliveryTicketSubmittalPreviewPageProps, geistMono, geistSans, generateMetadata() (+50 more)

### Community 105 - "drawLineItemRow"
Cohesion: 0.31
Nodes (10): drawCenteredInColumn(), drawLineItemRow(), drawRightAlignedInColumn(), drawRowSeparator(), drawTextAt(), drawTextUnderline(), measureDescriptionLines(), measureRowHeight() (+2 more)

### Community 106 - "product-form.tsx"
Cohesion: 0.09
Nodes (35): CastingComponentPickerOption, CastingSupplierOption, drainRingDiameterOptions, ProductForm(), handleCategoryChange(), handleProductKindChange(), handleProductTypeChange(), ProductFormProps (+27 more)

### Community 108 - "generate-invoice-templates.ts"
Cohesion: 0.13
Nodes (23): addTextField(), BLACK, BOTTOM_BOX, buildTemplate(), Ctx, drawBox(), drawCenteredText(), drawLine() (+15 more)

### Community 110 - "send-actions.ts"
Cohesion: 0.06
Nodes (62): findSupersededBy(), getSendQuoteDefaults(), getSendQuoteEmailConfigured(), OpenOutlookDraftResult, openQuoteInOutlook(), sendQuote(), SendQuoteDefaults, SendQuoteInput (+54 more)

### Community 111 - "XhtmlObject"
Cohesion: 0.04
Nodes (22): a, B, Body, br, Button, fixURL(), Html, _i (+14 more)

### Community 112 - "schedule-loads-editor.tsx"
Cohesion: 0.12
Nodes (13): deliveryTicketStatusFlow, deliveryTicketStatusLabels, pickFields(), SCHEDULE_FIELD_KEYS, ScheduleFields, ScheduleLoadsEditor(), ScheduleLoadsEditorProps, ScheduleTicketRow (+5 more)

### Community 114 - "react"
Cohesion: 0.06
Nodes (56): listJobFilesAction(), revalidateFilesPaths(), syncJobFilesAction(), uploadJobFileAction(), createJobFolder(), openJobFolder(), DrillSheetPdfButtonProps, JobDrillSheetsPdfButtons() (+48 more)

### Community 115 - "inventory-service.ts"
Cohesion: 0.15
Nodes (14): cancelDeliveredTicket(), markDeliveryTicketDelivered(), applyInboundStockChanges(), applyStockChange(), applyStructureProductionLines(), DbClient, deductInventoryForDeliveredTicket(), InboundStockChange (+6 more)

### Community 117 - "plan-sheet-actions.ts"
Cohesion: 0.09
Nodes (47): GET(), RouteContext, ExplorerOpenResult, getJobFilesForBrowser(), openJobFile(), openJobFolderCategory(), syncAllFiles(), SyncAllFilesResult (+39 more)

### Community 118 - "windows-explorer.ts"
Cohesion: 0.10
Nodes (34): ClientPathMapping, getClientPathMappings(), stripTrailingSeparators(), toClientOpenPath(), translateToClientPath(), assertDirectoryExists(), assertFileExists(), assertPathAccessible() (+26 more)

### Community 119 - "bulk-attach-board.tsx"
Cohesion: 0.22
Nodes (14): uploadStructureSubmittalFile(), BulkAttachBoard(), getTile(), handleFiles(), renderTile(), setTile(), tileKey(), BulkAttachJobGroup (+6 more)

### Community 120 - "app_generated_prisma_client"
Cohesion: 0.09
Nodes (27): GET(), GET(), GET(), RouteContext, getDraftInvoiceEditorData(), EditDraftInvoicePage(), PageProps, InvoiceDetailPage() (+19 more)

### Community 121 - "quote-utils.ts"
Cohesion: 0.12
Nodes (23): buildCreateQuoteInput(), calculateQuoteTotals(), formatQuoteWeight(), formatQuoteYards(), getLineItemTotal(), parseQuoteNumber(), quoteCompactInputClassName, quoteReadOnlyClassName (+15 more)

### Community 122 - "Office deployment — single Windows server + UNC job folders"
Cohesion: 0.11
Nodes (18): Architecture, End-to-end smoke test, Firewall, Important behavior, Install prerequisites, Office deployment — single Windows server + UNC job folders, Ongoing maintenance, Phase 1 — Prepare the Windows server (+10 more)

### Community 123 - "Office rollout checklist"
Cohesion: 0.12
Nodes (17): 1. Server URL for the desktop app, 2. First install on each staff PC, 3. Staff expectations, 4. Role walkthrough (recommended), 5. Backups, 6. Support contacts, 7. Post-rollout verification (first week), Database (nightly recommended) (+9 more)

### Community 124 - "prisma.ts"
Cohesion: 0.18
Nodes (15): decimal(), DiameterConfigPayload, parseDiameterConfigPayload(), parsePrice(), saveStructureDiameterConfigs(), clientHasAppSettingsFields(), createPool(), createPrismaClient() (+7 more)

### Community 125 - "reloadAfterAction"
Cohesion: 0.03
Nodes (99): updateDeliveryTicketStatus(), uploadJobStructureDocumentAction(), bulkSetJobStructureStatuses(), BulkStructureStatus, convertTicketToInvoice(), linkStructuresForWonQuote(), markAllJobStructuresSubmitted(), setQuoteTaxExempt() (+91 more)

### Community 126 - "printPdfUrl"
Cohesion: 0.23
Nodes (13): printDeliveryTicketDirect(), DeliveryTicketPdfCanvasPreview(), DeliveryTicketPdfCanvasPreviewProps, getDeliveryTicketPreviewPrintUrl(), DeliveryTicketPreviewContent(), handlePrint(), openPrintWindow(), printCopies() (+5 more)

### Community 127 - "price-list-service.ts"
Cohesion: 0.09
Nodes (43): listStockProductsForTicket(), EDIT_ORIGINS, EditDeliveryTicketPage(), EditDeliveryTicketPageProps, NewDeliveryTicketPage(), NewDeliveryTicketPageProps, TICKET_ORIGINS, listJobsWithQuotes() (+35 more)

### Community 128 - ".get"
Cohesion: 0.03
Nodes (41): 7416(), 9835(), AnnotationFactory, ao, appendIfJavaScriptDict(), addPageDict(), parseNestedOrder(), parseOnOff() (+33 more)

### Community 129 - "LocaleSetNamespace"
Cohesion: 0.03
Nodes (24): CalendarSymbols, CurrencySymbol, CurrencySymbols, DatePattern, DatePatterns, Day, DayNames, Era (+16 more)

### Community 130 - "delivery-schedule-pdf-html.ts"
Cohesion: 0.20
Nodes (18): formatWeight(), DeliveryScheduleTicket, JobDeliverySchedule, buildDeliverySchedulePdfHtml(), DeliveryScheduleVariant, escapeHtml(), formatDeliveryAddress(), formatFriendlyDate() (+10 more)

### Community 131 - "rich-text.ts"
Cohesion: 0.14
Nodes (23): handleAddCustomStructure(), RichTextEditor(), applyCommand(), emitChange(), handlePaste(), RichTextEditorProps, getCompanyLogoDataUri(), buildQuotePdfHtml() (+15 more)

### Community 134 - "Deployment server info checklist"
Cohesion: 0.22
Nodes (9): Database, Deployment server info checklist, Electron client, File shares (UNC), Network, PDF generation, Post-deploy verification, Server (+1 more)

### Community 136 - "delivery-ticket-pdf-html.ts"
Cohesion: 0.35
Nodes (11): CompanyProfile, DeliveryTicketCopySettings, DeliveryTicketPdfView, getDeliveryTicketCopyTitles(), addressBlockHtml(), buildDeliveryTicketPdfHtml(), escapeHtml(), optionalNote() (+3 more)

### Community 137 - "Troubleshooting"
Cohesion: 0.33
Nodes (6): `P1001` — Can't reach database server, Password authentication failed, Port 3000 already in use, Prisma Studio — "Could not load schema metadata", Quote PDF — "Could not find Chrome" / browser not found, Troubleshooting

### Community 138 - ".constructor"
Cohesion: 0.15
Nodes (8): BaseShading, buildMeshVertexData(), DummyShading, FunctionBasedShading, getB(), MeshShading, MeshStreamReader, RadialAxialShading

### Community 139 - "structure-workbook-plan-takeoff.tsx"
Cohesion: 0.09
Nodes (32): pipeSizesForMaterial(), uniquePipeMaterials(), bearingFromDelta(), commitRow(), DragState, pdfToScreen(), PipePopup(), polarToScreenPoint() (+24 more)

### Community 141 - "Precast Ops"
Cohesion: 0.40
Nodes (5): Desktop shell (optional), Local development, Office deployment, Precast Ops, Project docs

### Community 142 - "ProductDocumentsSection"
Cohesion: 0.20
Nodes (15): deleteProductDocumentAction(), openProductDocument(), openProductSubmittalsFolder(), revalidateProductPaths(), scanProductDocumentsAction(), uploadProductDocumentAction(), InventorySubmittalsCell(), handleOpen() (+7 more)

### Community 150 - ".constructor"
Cohesion: 0.21
Nodes (4): ARCFourCipher, calculateMD5(), CipherTransformFactory, writeObject()

### Community 151 - "BasePDFStream"
Cohesion: 0.12
Nodes (4): BasePDFStream, PDFWorkerStream, PDFWorkerStreamRangeReader, PDFWorkerStreamReader

### Community 152 - "calculateSHA512"
Cohesion: 0.32
Nodes (8): calculateSHA512(), ch(), littleSigma(), littleSigmaPrime(), maj(), sigma(), sigmaPrime(), Word64

### Community 153 - "pdfjs-dist"
Cohesion: 0.18
Nodes (10): DraftBatchPreviewPage(), renderPage(), renderPage(), DraftBatchPreviewContent(), loadDocument(), renderPage(), loadPdf(), pdfjs-dist (+2 more)

### Community 154 - "drill-sheet-preview-content.tsx"
Cohesion: 0.22
Nodes (11): DrillSheetPdfCanvasPreview(), loadPdf(), DrillSheetPdfCanvasPreviewProps, DrillSheetPdfPreviewInfo, getDrillSheetPreviewPrintUrl(), LoadedPdf, DrillSheetPreviewContent(), handleGeneratePdf() (+3 more)

### Community 155 - "receiving-utils.ts"
Cohesion: 0.09
Nodes (40): InventoryProductSearchOption, resolveReceivingCategory(), saveInventoryAdjustment(), savePurchaseReceipt(), InventoryReceiptsPage(), InventoryReceiptsPageProps, ReceivingPage(), mapOpenPurchaseOrders() (+32 more)

### Community 156 - "FontFinder"
Cohesion: 0.16
Nodes (4): FontFinder, FontInfo, FontSelector, makeObj()

### Community 157 - "render-example-sheets.ts"
Cohesion: 0.23
Nodes (10): puppeteer, findBrowser(), HTML_PATH, main(), EXAMPLES, findBrowser(), HTML(), main() (+2 more)

### Community 158 - "ring-builder-modal.tsx"
Cohesion: 0.07
Nodes (55): updateRingBuilderSettingsFormAction(), saveRingBuilderSettings(), createDefaultHeightPoolRow(), createRowId(), formatRingBuilderUnitPrice(), HeightPoolRow, initOtherInputs(), OtherProductInput (+47 more)

### Community 160 - "session.ts"
Cohesion: 0.07
Nodes (50): getActiveLoginUsers(), getActiveUserForLogin(), LoginUserOption, parsePasswordFields(), signInWithPassword(), signOut(), LoginPage(), ProfilePage() (+42 more)

### Community 161 - "draft-invoice-cover-html.ts"
Cohesion: 0.29
Nodes (9): getCompanyProfile(), buildDraftInvoiceCoverHtml(), escapeHtml(), formatDate(), money(), buildSubmittalCoverHtml(), escapeHtml(), SubmittalCoverData (+1 more)

### Community 162 - "customer-mapper.ts"
Cohesion: 0.04
Nodes (62): checkBulkCustomerDbDuplicates(), checkBulkContactDbState(), BulkContactPasteForm(), handleParsePreview(), parseBulkContactPaste(), BulkPasteForm(), handleImport(), handleParsePreview() (+54 more)

### Community 163 - "delivery-ticket-submittal-preview-content.tsx"
Cohesion: 0.38
Nodes (8): printDeliveryTicketSubmittalsDirect(), DeliveryTicketSubmittalPdfCanvasPreview(), DeliveryTicketSubmittalPdfCanvasPreviewProps, getDeliveryTicketSubmittalPreviewPrintUrl(), DeliveryTicketSubmittalPreviewContent(), handlePrint(), openPrintWindow(), DeliveryTicketSubmittalPreviewContentProps

### Community 164 - "quote-preview-content.tsx"
Cohesion: 0.36
Nodes (8): generateQuotePdf(), getQuotePreviewPrintUrl(), QuotePdfCanvasPreview(), QuotePdfCanvasPreviewProps, QuotePreviewContent(), handleGeneratePdf(), handlePrint(), QuotePreviewContentProps

### Community 165 - "main.mjs"
Cohesion: 0.07
Nodes (39): __dirname, getUserConfigPath(), loadConfig(), readJsonFile(), validateServerUrl(), buildApplicationMenu(), createWindow(), __dirname (+31 more)

### Community 167 - "quote-pdf-line-items.test.ts"
Cohesion: 0.25
Nodes (4): COL_ITEM_NUM_WIDTH, MAIN_TABLE_LAYOUT, QuoteDrawLineItem, QuoteLineItemPageSlice

### Community 168 - "product-submittals-service.ts"
Cohesion: 0.11
Nodes (37): getStockSubmittalsRoot(), pathExists(), resolveUniqueFilePath(), sanitizeFileName(), assertJobStructureWithFolder(), DOCUMENT_TYPE_LABELS, getJobStructureSubmittalDir(), JOB_STRUCTURE_SUBMITTAL_DOCUMENT_TYPES (+29 more)

### Community 170 - "test-db.ts"
Cohesion: 0.46
Nodes (4): globalSetup(), url, assertIsTestDatabaseUrl(), getTestDatabaseUrl()

### Community 172 - "Dict"
Cohesion: 0.03
Nodes (44): ButtonWidgetAnnotation, CaretAnnotation, ChoiceWidgetAnnotation, CircleAnnotation, createImage(), createImageDict(), createPNGLikeImage(), createRawImage() (+36 more)

### Community 173 - "ExclGroup"
Cohesion: 0.04
Nodes (14): addHTML(), Area, createLine(), Draw, ExclGroup, Field, flushHTML(), getAvailableSpace() (+6 more)

### Community 175 - "StringObject"
Cohesion: 0.02
Nodes (39): Amd, Base, Certificate, config_Picture, connection_set_Uri, ConnectionSet, ConnectionSetNamespace, Creator (+31 more)

### Community 176 - "invoice-mapper.ts"
Cohesion: 0.53
Nodes (5): formatDate(), formatMoney(), InvoiceDetailView, mapDbInvoiceToDetailView(), statusVariant()

### Community 179 - "Stream"
Cohesion: 0.03
Nodes (33): Ascii85Stream, AsciiHexStream, BrotliStream, bytesToString(), CCITTFaxStream, parseOperand(), CipherTransform, DecodeStream (+25 more)

### Community 186 - "package.json"
Cohesion: 0.08
Nodes (25): eslintConfig, main, name, postcss, overrides, @hono/node-server, next, private (+17 more)

### Community 187 - "DashboardShell"
Cohesion: 0.05
Nodes (62): BulkCustomersPage(), BulkContactsPage(), EditCustomerPage(), EditCustomerPageProps, CustomerNotFound(), CustomerDetailPage(), CustomerDetailPageProps, NewCustomerPage() (+54 more)

### Community 192 - "print-pdf-url.ts"
Cohesion: 0.21
Nodes (12): listPrintersForClient(), printServerPdfForClient(), ServerPrintResult, attachHiddenIframe(), cleanupAfterPrint(), pickPrinter(), printBlobAsPdfFrame(), printViaServerWithPicker() (+4 more)

### Community 193 - "drill-sheets/pdf-actions.ts"
Cohesion: 0.08
Nodes (31): GET(), rectPreviewResponse(), RouteContext, DrillSheetPreviewPage(), DrillSheetPreviewPageProps, GenerateDrillSheetPdfResult, GenerateJobDrillSheetsPdfResult, buildDrillSheetDetail() (+23 more)

### Community 194 - "job-folders.ts"
Cohesion: 0.22
Nodes (13): getJobSubfolders(), JOB_SUBFOLDERS, JOBS_ROOT, PURCHASE_ORDERS_CATEGORY, STOCK_SUBMITTALS_ROOT, TAX_EXEMPT_CERT_CATEGORY, buildJobFolderBaseName(), createJobFoldersForJob() (+5 more)

### Community 196 - "custom-structure-import.ts"
Cohesion: 0.14
Nodes (20): importCustomJobStructures(), JobStructureImportResult, JobCustomStructureImportButton(), handleFile(), handleImport(), parseGrid(), Cell, cellText() (+12 more)

### Community 203 - "delivery-tickets/actions.ts"
Cohesion: 0.08
Nodes (34): assertQuoteLinkable(), buildLineCreates(), buildLinesPayload(), createDeliveryTicket(), DeliveryTicketActionResult, DeliveryTicketJobSearchOption, generateDeliveryTicketSubmittalPackage(), GenerateTicketSubmittalResult (+26 more)

### Community 204 - "product-mapper.ts"
Cohesion: 0.14
Nodes (20): ProductRow, formatProductKindBadgeLabel(), categoryVariant(), documentTypeLabel(), formatDecimal(), formatDocumentDate(), formatFileSize(), formatYesNo() (+12 more)

### Community 205 - "delivery-ticket-pdf-data.ts"
Cohesion: 0.15
Nodes (22): blankOr(), buildDeliveryTicketFormData(), computeTotalPieces(), DbCustomer, DbJob, DeliveryTicketContentPage, DeliveryTicketPdfFillOptions, DeliveryTicketPdfLineItem (+14 more)

### Community 209 - "job-structure-import-dialog.tsx"
Cohesion: 0.04
Nodes (77): importJobStructuresFromConfigs(), JobStructureImportEntry, buildPreview(), Cell, detectShape(), ImportOptions, JobStructureImportButton(), handleFile() (+69 more)

### Community 227 - "rect-bulk-grid.tsx"
Cohesion: 0.07
Nodes (53): BulkSheetRowInput, BulkSheetRowResult, RectOpeningField, RectSheetFormValues, circularPayloadFromValues(), rectPayloadFromValues(), focusGridCell(), formatBrickInches() (+45 more)

### Community 242 - ".checkAndRepair"
Cohesion: 0.04
Nodes (38): 2360(), adjustMapping(), amendFallbackToUnicode(), applyStandardFontGlyphMap(), buildToFontChar(), CFFFont, compileFontInfo(), convertCidString() (+30 more)

### Community 243 - "XFAObject"
Cohesion: 0.01
Nodes (45): Agent, Assist, BatchOutput, BindItems, Bookend, Cache, Common, Compress (+37 more)

### Community 248 - "LabCS"
Cohesion: 0.13
Nodes (3): CalGrayCS, DeviceCmykCS, LabCS

### Community 256 - "._hash"
Cohesion: 0.11
Nodes (8): AES128Cipher, AES256Cipher, AESBaseCipher, calculateSHA384(), NullCipher, PDF17, PDF20, PDFBase

### Community 260 - "SectionCard"
Cohesion: 0.04
Nodes (121): UpdateTicketDriverResult, ProductInventoryPage(), ProductInventoryPageProps, getQuoteFulfillmentForTicket(), CompactTable(), Home(), BillingSettingsPage(), BillingSettingsPageProps (+113 more)

### Community 261 - "ColorSpace"
Cohesion: 0.10
Nodes (4): AlternateCS, ColorSpace, DeviceRgbaCS, PatternCS

### Community 267 - "customer-name-similarity.ts"
Cohesion: 0.33
Nodes (12): compactCustomerName(), compactSimilarity(), CustomerNameCandidate, findSimilarCustomers(), getCustomerNameSimilarity(), jaccardSimilarity(), levenshteinDistance(), levenshteinRatio() (+4 more)

### Community 281 - "unreachable"
Cohesion: 0.08
Nodes (4): BasePDFStreamRangeReader, BaseStream, Pattern, unreachable()

### Community 311 - "Phase 6 — Electron client (staff PCs)"
Cohesion: 0.25
Nodes (8): A. Server app updates (quotes, jobs, UI — most changes), B. Desktop shell updates (Electron auto-update), Build the installer, C. Server URL change only, Client updates (auto-update from server), Install on each desk PC, Local development with Electron, Phase 6 — Electron client (staff PCs)

### Community 315 - "warn"
Cohesion: 0.03
Nodes (22): AppearanceStreamEvaluator, Catalog, addPageError(), CmykICCBasedCS, createValidAbsoluteUrl(), FeatureTest, generateFont(), getFamilyName() (+14 more)

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
Cohesion: 0.08
Nodes (19): 616(), 8745(), 9504(), 9565(), fetchSync(), getUint8ArrayMemory0(), JBig2CCITTFaxImage, Jbig2Error (+11 more)

## Knowledge Gaps
- **1336 isolated node(s):** `RouteContext`, `RouteContext`, `RouteContext`, `RouteContext`, `RouteContext` (+1331 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 2401 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **47 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `_` connect `_` to `.get`, `._hash`, `LocaleSetNamespace`, `ConfigNamespace`, `ColorSpace`, `.getOperatorList`, `TemplateNamespace`, `ContentObject`, `.constructor`, `DeliveryTicketEditor`, `.getTextContent`, `SingleIntersector`, `.constructor`, `BasePdfManager`, `Annotation`, `BasePDFStream`, `unreachable`, `calculateSHA512`, `Glyph`, `FontFinder`, `JpegImage`, `Color`, `.add`, `lexer_Lexer`, `SimpleGlyph`, `.success`, `Dict`, `ExclGroup`, `ChunkedStream`, `StringObject`, `FormatError`, `TextState`, `XMLParserBase`, `Stream`, `.#Se`, `NullOptimizer`, `warn`, `BasePDFStreamReader`, `DeviceGrayCS`, `CalRGBCS`, `PsWasmCompiler`, `CMap`, `XmlObject`, `assert`, `DeviceRgbCS`, `purchase-receipt-form.tsx`, `.push`, `ChunkedStreamManager`, `.process`, `ta`, `calculateSHA256`, `AnnotationBorderStyle`, `ln`, `GlobalColorSpaceCache`, `.getUint16`, `XhtmlObject`, `.checkAndRepair`, `XFAObject`, `LabCS`, `xdp_Xdp`?**
  _High betweenness centrality (0.381) - this node is a cross-community bridge._
- **Why does `SectionCard()` connect `SectionCard` to `structure-workbook.ts`, `rect-structure-workbook.ts`, `DeliveryTicketEditor`, `ProductDocumentsSection`, `QuoteForm`, `quote-form.tsx`, `job-structure-workflow.ts`, `products/bulk-paste-form.tsx`, `receiving-utils.ts`, `session.ts`, `customer-mapper.ts`, `job-detail-mapper.ts`, `import-rect-sheet-pdfs.ts`, `daily-production-entry.tsx`, `rect-sheet-detail-view.tsx`, `inventory/page.tsx`, `import/actions.ts`, `delivery-ticket-editor.tsx`, `shipping/actions.ts`, `auth/constants.ts`, `contact-actions.ts`, `DashboardShell`, `operations/actions.ts`, `delivery-ticket-utils.ts`, `settings/products/page.tsx`, `purchase-receipt-form.tsx`, `production-board.tsx`, `send-actions.ts`, `react`, `reloadAfterAction`, `price-list-service.ts`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `buildPayload()` connect `DeliveryTicketEditor` to `casting-ticket-lines.ts`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **What connects `RouteContext`, `RouteContext`, `RouteContext` to the rest of the system?**
  _1336 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app/products/actions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07547169811320754 - nodes in this community are weakly interconnected._
- **Should `rect-structure.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `_` be split into smaller, more focused modules?**
  _Cohesion score 0.011091695296765786 - nodes in this community are weakly interconnected._